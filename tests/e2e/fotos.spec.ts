import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { USUARIOS_DEV } from "../ambiente";
import { jpegComGps, metadadosRestantes } from "../imagens";
import { pngRuidoso } from "./arquivos";
import { AMBIENTE, NO_PREVIEW, site, sql } from "./alvo";

// Fase 7 no celular (390x844): o gestor cadastra um atrativo com fotos (tirar foto e da
// galeria), legendas, crédito, capa e ordem; a foto publicada sai sem EXIF nem GPS e com até
// 2000 px; o visitante vê a capa na lista e a galeria em tela cheia (teclado, deslizar, Esc).

const PALMEIROPOLIS = site("palmeiropolis");
const SUF = randomBytes(3).toString("hex");
const NOME = `[E2E] Cachoeira das Fotos ${SUF}`;
const PRESTADOR = `[E2E] Pousada das Fotos ${SUF}`;
const LEGENDA_CAPA = `Poço principal visto da trilha ${SUF}`;
const CREDITO = "Secretaria de Turismo [E2E]";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function graves(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id}: ${v.nodes.length}`);
}

function alerta(page: Page, texto: string | RegExp) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: texto });
}

async function entrar(page: Page) {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPalmeiropolis);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Caminhos das fotos do cadastro, na ordem da galeria (capa primeiro). */
function ordemNoBanco(coluna: string, id: string) {
  return sql(`select string_agg(caminho, ',' order by ordem) from public.fotos where ${coluna} = '${id}'`).split(",").filter(Boolean);
}

const urlPublica = (caminho: string) => `${AMBIENTE.url}/storage/v1/object/public/publico/${caminho}`;

test.describe("fotos de cadastro", () => {
  test("celular: cadastro com fotos até a galeria pública, sem EXIF nem GPS", async ({ page }) => {
    await entrar(page);

    // Atrativo com descrição em dois parágrafos.
    await page.goto(`${PALMEIROPOLIS}/admin/atrativos/novo`);
    await page.getByLabel("Nome do atrativo").fill(NOME);
    await page.getByLabel("Categoria").selectOption("natureza");
    await page.getByLabel("Descrição").fill("Primeiro parágrafo sobre o poço.\n\nSegundo parágrafo com a melhor época.");
    await page.getByRole("button", { name: "Criar atrativo" }).click();
    await expect(page).toHaveURL(/\/admin\/atrativos\/[0-9a-f-]{36}\?criado=1$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;

    await page.getByRole("link", { name: /Adicionar fotos/ }).click();
    await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/atrativos/${id}/fotos`);
    await expect(page.getByText(`Atrativo · ${NOME}`)).toBeVisible();
    await expect(page.getByText("0 de 12")).toBeVisible();
    await expect(page.getByText("Nenhuma foto ainda.")).toBeVisible();
    expect(await graves(page)).toEqual([]);

    // "Tirar foto": câmera traseira; o arquivo de teste tem EXIF com GPS, 3000x2000.
    const camera = page.getByLabel("Tirar foto");
    await expect(camera).toHaveAttribute("capture", "environment");
    const comGps = await jpegComGps(3000, 2000);
    await camera.setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: comGps });
    await expect(page.getByText("1 de 12")).toBeVisible({ timeout: NO_PREVIEW ? 60_000 : 20_000 });

    // "Da galeria": duas fotos de uma vez.
    await page.getByLabel("Da galeria").setInputFiles([
      { name: "trilha.png", mimeType: "image/png", buffer: pngRuidoso(640, 480) },
      { name: "descanso.png", mimeType: "image/png", buffer: pngRuidoso(480, 640) },
    ]);
    await expect(page.getByText("3 de 12")).toBeVisible({ timeout: NO_PREVIEW ? 60_000 : 20_000 });
    await expect(page.getByRole("status").filter({ hasText: "2 fotos enviadas" })).toBeVisible();

    // A foto publicada (capa) não tem EXIF nem GPS e tem no máximo 2000 px.
    const ordem = ordemNoBanco("atrativo_id", id);
    expect(ordem).toHaveLength(3);
    expect(ordem.every((c) => /\/fotos\/[0-9a-f-]{36}\.webp$/.test(c))).toBe(true);
    const publicada = await page.request.get(urlPublica(ordem[0]));
    expect(publicada.status()).toBe(200);
    const bytes = await publicada.body();
    const m = await sharp(bytes).metadata();
    const restantes = await metadadosRestantes(bytes);
    console.log(
      `original: ${comGps.length} bytes, 3000x2000, EXIF com GPS ${JSON.stringify(await metadadosRestantes(comGps))} | ` +
        `publicada: ${bytes.length} bytes, ${m.width}x${m.height} ${m.format}, metadados restantes: ${JSON.stringify(restantes)}`,
    );
    expect(restantes).toEqual([]);
    expect(m.format).toBe("webp");
    expect([m.width, m.height]).toEqual([2000, 1333]);
    // Nenhum original fica guardado depois do tratamento.
    expect(sql(`select count(*) from storage.objects where bucket_id = 'originais' and name like '%' || (select id from public.municipios where slug = 'palmeiropolis') || '%'`)).toBe("0");

    // Legenda só na capa; crédito para todas.
    await page.getByLabel("Legenda", { exact: true }).fill(LEGENDA_CAPA);
    await page.getByLabel("Crédito das fotos").fill(CREDITO);
    await page.getByRole("button", { name: "Salvar fotos" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Fotos salvas." })).toBeVisible();
    expect(sql(`select count(*) from public.fotos where atrativo_id = '${id}' and credito = '${CREDITO}'`)).toBe("3");

    // Ordem com botões: a foto 3 vira capa; depois a foto 2 (antiga capa) desce.
    await page.getByRole("listitem").filter({ has: page.getByLabel("Legenda da foto 3") }).getByRole("button", { name: "Tornar capa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Capa trocada." })).toBeVisible();
    expect(ordemNoBanco("atrativo_id", id)).toEqual([ordem[2], ordem[0], ordem[1]]);
    await expect(page.getByRole("button", { name: "Mover a foto 2 para cima" })).toBeDisabled();
    await page.getByRole("button", { name: "Mover a foto 2 para baixo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Foto movida para a posição 3." })).toBeVisible();
    expect(ordemNoBanco("atrativo_id", id)).toEqual([ordem[2], ordem[1], ordem[0]]);
    // A legenda digitada acompanha a foto (agora a 3ª), não a posição.
    await expect(page.getByLabel("Legenda da foto 3")).toHaveValue(LEGENDA_CAPA);
    // Sem legenda, o texto alternativo é "Foto N de <nome>".
    await expect(page.getByRole("img", { name: `Foto 1 de ${NOME}` })).toBeVisible();
    // E volta a ser a capa.
    await page.getByRole("listitem").filter({ has: page.getByLabel("Legenda da foto 3") }).getByRole("button", { name: "Tornar capa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Capa trocada." })).toBeVisible();
    expect(ordemNoBanco("atrativo_id", id)).toEqual([ordem[0], ordem[2], ordem[1]]);
    expect(await graves(page)).toEqual([]);

    await page.getByRole("link", { name: "Voltar ao cadastro" }).click();
    await expect(page.getByText("3 de 12 fotos")).toBeVisible();
    await page.getByRole("button", { name: "Publicar no portal" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Publicado." })).toBeVisible();

    // Visitante: capa no card da lista.
    const visitante = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "pt-BR" });
    const v = await visitante.newPage();
    await v.goto(`${PALMEIROPOLIS}/atrativos`);
    const card = v.getByRole("main").getByRole("link", { name: new RegExp(NOME.replace(/[[\]]/g, "\\$&")) });
    await expect(card.locator(`img[alt="${LEGENDA_CAPA}"]`)).toBeVisible();
    await card.click();

    // Detalhe (tela "Atrativo · capa e galeria").
    await expect(v.getByRole("heading", { level: 1, name: NOME })).toBeVisible();
    await expect(v.getByRole("region", { name: "Sobre" }).locator("p")).toHaveCount(2);
    await expect(v.getByRole("region", { name: "Fotos" }).getByRole("button")).toHaveCount(4); // "Ver todas" + 3 miniaturas
    expect(await graves(v)).toEqual([]);

    // Galeria em tela cheia pelo teclado: Enter no botão "3 fotos", setas, Esc devolve o foco.
    const abrir = v.getByRole("button", { name: /^3 fotos/ });
    await abrir.focus();
    await v.keyboard.press("Enter");
    const galeria = v.getByRole("dialog", { name: `Galeria de fotos de ${NOME}` });
    await expect(galeria).toBeVisible();
    await expect(galeria.getByText("1 de 3")).toBeVisible();
    await expect(galeria.getByRole("img", { name: LEGENDA_CAPA })).toBeVisible();
    await expect(galeria.getByText(`Foto: ${CREDITO}`)).toBeVisible();
    await expect(galeria.getByRole("button", { name: "Foto anterior" })).toBeDisabled();
    expect(await graves(v)).toEqual([]);
    await v.keyboard.press("ArrowRight");
    await expect(galeria.getByText("2 de 3")).toBeVisible();
    await expect(galeria.getByRole("img", { name: `Foto 2 de ${NOME}` })).toBeVisible();

    // Deslizar o dedo para a esquerda: próxima foto.
    const area = await galeria.getByRole("img", { name: `Foto 2 de ${NOME}` }).boundingBox();
    await v.mouse.move(area!.x + area!.width * 0.8, area!.y + area!.height / 2);
    await v.mouse.down();
    await v.mouse.move(area!.x + area!.width * 0.2, area!.y + area!.height / 2, { steps: 5 });
    await v.mouse.up();
    await expect(galeria.getByText("3 de 3")).toBeVisible();
    await expect(galeria.getByRole("button", { name: "Próxima foto" })).toBeDisabled();
    await galeria.getByRole("button", { name: "Ver foto 1 de 3" }).click();
    await expect(galeria.getByText("1 de 3")).toBeVisible();

    await v.keyboard.press("Escape");
    await expect(galeria).toBeHidden();
    await expect(abrir).toBeFocused();
    console.log("galeria: Enter abre em 1 de 3, seta → 2 de 3, deslizar → 3 de 3, miniatura → 1 de 3, Esc fecha e devolve o foco");

    // Miniatura da faixa abre na foto escolhida; o botão de fechar também funciona.
    await v.getByRole("region", { name: "Fotos" }).getByRole("button", { name: /Foto 3 de 3, ampliar/ }).click();
    await expect(galeria.getByText("3 de 3")).toBeVisible();
    await galeria.getByRole("button", { name: "Fechar galeria" }).click();
    await expect(galeria).toBeHidden();
    await visitante.close();
  });

  test("limite de 12 fotos por cadastro, no servidor", async ({ page }) => {
    await entrar(page);
    const municipio = sql("select id from public.municipios where slug = 'palmeiropolis'");
    const id = sql(`insert into public.atrativos (municipio_id, nome, categoria) values ('${municipio}', '[E2E] Atrativo cheio ${SUF}', 'natureza') returning id`).split("\n")[0];
    // 11 fotos já registradas (sem arquivo: o teste é sobre a contagem).
    sql(`insert into public.fotos (municipio_id, caminho, atrativo_id)
         select '${municipio}', '${municipio}/fotos/' || gen_random_uuid() || '.webp', '${id}' from generate_series(1, 11)`);

    await page.goto(`${PALMEIROPOLIS}/admin/atrativos/${id}/fotos`);
    await expect(page.getByText("11 de 12")).toBeVisible();
    await page.getByLabel("Da galeria").setInputFiles([
      { name: "decima-segunda.png", mimeType: "image/png", buffer: pngRuidoso(320, 240) },
      { name: "decima-terceira.png", mimeType: "image/png", buffer: pngRuidoso(320, 240) },
    ]);
    await expect(alerta(page, "decima-terceira.png não foi enviado. Este cadastro já tem 12 fotos, o máximo.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("12 de 12")).toBeVisible();
    await expect(page.getByLabel("Da galeria")).toBeDisabled();
    await expect(page.getByLabel("Tirar foto")).toBeDisabled();
    await expect(page.getByText("Este cadastro chegou a 12 fotos, o máximo.")).toBeVisible();
    expect(sql(`select count(*) from public.fotos where atrativo_id = '${id}'`)).toBe("12");
    console.log("limite: 11 + 2 enviadas → a 12ª entra, a 13ª é recusada pelo servidor; banco com 12");
  });

  test("tipo e tamanho inválidos são recusados pelo servidor", async ({ page }) => {
    await entrar(page);
    const municipio = sql("select id from public.municipios where slug = 'palmeiropolis'");
    const id = sql(`insert into public.eventos (municipio_id, titulo, inicio, fim) values ('${municipio}', '[E2E] Evento fotos ${SUF}', now() + interval '3 days', now() + interval '3 days 4 hours') returning id`).split("\n")[0];
    await page.goto(`${PALMEIROPOLIS}/admin/eventos/${id}/fotos`);
    const galeria = page.getByLabel("Da galeria");
    // O navegador não filtra: arquivos com nome e tipo de foto, conteúdo errado.
    await galeria.setInputFiles({ name: "VID_0098.jpg", mimeType: "image/jpeg", buffer: Buffer.from("ftypqt  isto é um vídeo, não uma foto") });
    await expect(alerta(page, "VID_0098.jpg não foi enviado. Tipo de arquivo não aceito. Envie fotos JPG, PNG ou WebP até 10 MB.")).toBeVisible();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await galeria.setInputFiles({ name: "desenho.png", mimeType: "image/png", buffer: svg });
    await expect(alerta(page, "desenho.png não foi enviado. Tipo de arquivo não aceito.")).toBeVisible();
    const grande = Buffer.alloc(11 * 1024 * 1024);
    grande.set([0xff, 0xd8, 0xff, 0xe0]);
    await galeria.setInputFiles({ name: "enorme.jpg", mimeType: "image/jpeg", buffer: grande });
    await expect(alerta(page, "enorme.jpg não foi enviado. O arquivo tem 11 MB e o limite é 10 MB.")).toBeVisible();
    // Assinatura de JPEG, mas conteúdo corrompido: o tratamento recusa.
    const corrompido = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(40_000)]);
    await galeria.setInputFiles({ name: "corrompida.jpg", mimeType: "image/jpeg", buffer: corrompido });
    await expect(alerta(page, "corrompida.jpg não foi enviado. Não conseguimos abrir esta imagem.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("0 de 12")).toBeVisible();
    expect(sql(`select count(*) from public.fotos where evento_id = '${id}'`)).toBe("0");
    expect(sql(`select count(*) from storage.objects where bucket_id = 'originais' and name like '${municipio}/%'`)).toBe("0");
  });

  test("prestador e atividade: descrição com parágrafos, capa na lista e detalhe público", async ({ page }) => {
    await entrar(page);
    await page.goto(`${PALMEIROPOLIS}/admin/prestadores/novo`);
    await page.getByLabel("Nome público").fill(PRESTADOR);
    await page.getByLabel("Categoria").selectOption("hospedagem");
    await page.getByLabel("Situação na rede").selectOption("participante");
    await page.getByRole("button", { name: "Criar prestador" }).click();
    await expect(page).toHaveURL(/\/admin\/prestadores\/[0-9a-f-]{36}\?criado=1$/);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    const descricao = page.getByLabel("Descrição");
    await expect(descricao).toHaveAttribute("maxlength", "2000");
    await descricao.fill("Pousada familiar à beira do rio.\n\nCafé da manhã com produtos da região.");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();

    await page.getByRole("link", { name: /Adicionar fotos/ }).click();
    await page.getByLabel("Da galeria").setInputFiles({ name: "fachada.png", mimeType: "image/png", buffer: pngRuidoso(800, 600) });
    await expect(page.getByText("1 de 12")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Voltar ao cadastro" }).click();
    await page.getByRole("button", { name: "Publicar no portal" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Publicado." })).toBeVisible();

    // Atividade com foto própria: capa no card do portal.
    const municipio = sql("select id from public.municipios where slug = 'palmeiropolis'");
    const atividade = sql(`insert into public.atividades (municipio_id, titulo, modo, status) values ('${municipio}', '[E2E] Passeio com foto ${SUF}', 'registro_voluntario', 'rascunho') returning id`).split("\n")[0];
    await page.goto(`${PALMEIROPOLIS}/admin/atividades/${atividade}`);
    await page.getByRole("link", { name: /Adicionar fotos/ }).click();
    await page.getByLabel("Da galeria").setInputFiles({ name: "passeio.png", mimeType: "image/png", buffer: pngRuidoso(800, 600) });
    await expect(page.getByText("1 de 12")).toBeVisible({ timeout: 20_000 });
    sql(`update public.atividades set status = 'publicado' where id = '${atividade}'`);

    await page.goto(`${PALMEIROPOLIS}/prestadores`);
    const card = page.getByRole("main").getByRole("link", { name: new RegExp(PRESTADOR.replace(/[[\]]/g, "\\$&")) });
    await expect(card.getByRole("img", { name: `Foto 1 de ${PRESTADOR}` })).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(`${PALMEIROPOLIS}/prestadores/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: PRESTADOR })).toBeVisible();
    await expect(page.getByRole("region", { name: "Sobre" }).locator("p")).toHaveCount(2);
    expect(await graves(page)).toEqual([]);

    await page.goto(PALMEIROPOLIS);
    await expect(page.getByRole("link", { name: /Passeio com foto/ }).getByRole("img", { name: `Foto 1 de [E2E] Passeio com foto ${SUF}` })).toBeVisible();
    await page.getByRole("link", { name: /Passeio com foto/ }).click();
    await expect(page.getByRole("button", { name: /Abrir galeria com 1 foto/ })).toBeVisible();
    expect(await graves(page)).toEqual([]);
    sql(`update public.atividades set status = 'arquivado' where id = '${atividade}'`);
  });
});
