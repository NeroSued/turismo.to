import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";
import { FOTO_FALSA, jpegGrande, pdfGrande, pngRuidoso } from "./arquivos";
import { NO_PREVIEW, pedir as pedirAlvo, site, sql } from "./alvo";

// Fase 2 no celular (390x844): gestor cadastra atrativos, eventos e prestadores com fotos e
// adesão, configura o município; o visitante vê só o publicado, nunca dados internos; páginas
// públicas sem violações críticas ou sérias no axe.

const PALMEIROPOLIS = site("palmeiropolis");
const SUF = randomBytes(3).toString("hex");
const NOMES = {
  atrativo: `[E2E] Cachoeira ${SUF}`,
  rascunho: `[E2E] Gruta em rascunho ${SUF}`,
  arquivado: `[E2E] Museu arquivado ${SUF}`,
  evento: `[E2E] Festa do Rio ${SUF}`,
  eventoRascunho: `[E2E] Evento em rascunho ${SUF}`,
  prestador: `[E2E] Pousada ${SUF}`,
  prestadorRascunho: `[E2E] Guia em rascunho ${SUF}`,
  atividade: `[E2E] Registro livre ${SUF}`,
  legenda: `Queda d'água entre pedras ${SUF}`,
  responsavel: `[E2E] Responsável Interno ${SUF}`,
  contatoInterno: `INTERNO-${SUF} (63) 99999-0000`,
  contatoPublico: `(63) 3000-${SUF.slice(0, 4)}`,
  aviso: `[E2E] Aviso de privacidade ${SUF}: dados usados só para organizar as visitas.`,
};
const ids: Record<string, string> = {};

/** Regex que contém o texto literal (os nomes têm colchetes). */
function contem(texto: string) {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function alerta(page: Page, texto: string | RegExp) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: texto });
}

async function entrar(page: Page, email: string) {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

/** Cria um cadastro pelo formulário curto e devolve o id (da URL de edição). */
async function criar(page: Page, tipo: string, preencher: () => Promise<void>, botao: string) {
  await page.goto(`${PALMEIROPOLIS}/admin/${tipo}/novo`);
  await preencher();
  await page.getByRole("button", { name: botao }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/${tipo}/[0-9a-f-]{36}\\?criado=1$`));
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function mudarStatus(page: Page, botao: string, aviso: string) {
  await page.getByRole("button", { name: botao }).click();
  await expect(page.getByRole("status").filter({ hasText: aviso })).toBeVisible();
}

function diaDaqui(dias: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date(Date.now() + dias * 86_400_000));
}

/**
 * GET direto no servidor (sem navegador), como Palmeirópolis. O Node não resolve *.localhost,
 * então a requisição vai para localhost:3000 com o Host do município e os cookies da página.
 */
async function pedir(page: Page, caminho: string, opcoes: { maxRedirects?: number } = {}) {
  const cookies = (await page.context().cookies(PALMEIROPOLIS)).map((c) => `${c.name}=${c.value}`).join("; ");
  return pedirAlvo(page, "palmeiropolis", caminho, {
    headers: cookies ? { cookie: cookies } : {},
    maxRedirects: opcoes.maxRedirects,
  });
}

/** Contexto anônimo novo (sem cookies), como um visitante. */
async function visitante(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", timezoneId: "America/Araguaina" });
  return { ctx, page: await ctx.newPage() };
}

/** Configurações originais de Palmeirópolis voltam ao padrão (banco LOCAL, D11). */
function restaurarConfiguracoes() {
  sql(
    "update public.configuracoes_municipio c set cor_primaria = '#1F4D3A', contato_secretaria = null, ouvidoria_url = null, aviso_privacidade = null, dias_anonimizacao = 90 from public.municipios m where m.id = c.municipio_id and m.slug = 'palmeiropolis'",
  );
}

test.describe.serial("portal público e cadastros no celular", () => {
  test.afterAll(restaurarConfiguracoes);

  test("gestor cadastra atrativos com foto; upload inválido é recusado no servidor", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Conteúdo" }).click();
    await expect(page.getByRole("heading", { name: "Conteúdo do portal" })).toBeVisible();
    await page.getByRole("link", { name: /^Atrativos/ }).click();
    await expect(page.getByRole("heading", { name: "Atrativos", level: 1 })).toBeVisible();

    ids.atrativo = await criar(
      page,
      "atrativos",
      async () => {
        await page.getByLabel("Nome do atrativo").fill(NOMES.atrativo);
        await page.getByLabel("Categoria").selectOption("natureza");
        await page.getByLabel("Descrição").fill("Poço de águas claras a 12 km da cidade.");
      },
      "Criar atrativo",
    );
    await expect(page.getByText("Atrativo criado em elaboração")).toBeVisible();

    // Upload inválido: texto com nome e tipo de foto, e "JPEG" de 6 MB.
    const arquivo = page.getByLabel("Arquivo da foto");
    await arquivo.setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: FOTO_FALSA });
    await page.getByLabel("Legenda").fill("Tentativa inválida");
    await page.getByRole("button", { name: "Enviar foto" }).click();
    await expect(alerta(page, "Tipo de arquivo não aceito. Envie JPEG, PNG ou WebP até 5 MB.")).toBeVisible();

    await arquivo.setInputFiles({ name: "grande.jpg", mimeType: "image/jpeg", buffer: jpegGrande() });
    await page.getByRole("button", { name: "Enviar foto" }).click();
    await expect(alerta(page, "O arquivo tem 6 MB e o limite é 5 MB")).toBeVisible();
    await expect(page.getByRole("list").getByRole("img")).toHaveCount(0);

    // Foto válida com legenda.
    await arquivo.setInputFiles({ name: "cachoeira.png", mimeType: "image/png", buffer: pngRuidoso(320, 240) });
    await page.getByLabel("Legenda").fill(NOMES.legenda);
    await page.getByRole("button", { name: "Enviar foto" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Foto enviada." })).toBeVisible();
    await expect(page.getByRole("img", { name: NOMES.legenda })).toBeVisible();

    await page.getByLabel("Horários de visitação").fill("Todos os dias, das 8h às 17h.");
    await page.getByLabel("Orientações ambientais").fill("Leve seu lixo de volta.");
    await page.getByLabel("Latitude").fill("-13,0412");
    await page.getByLabel("Longitude").fill("-48,30");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();
    await mudarStatus(page, "Publicar no portal", "Publicado.");

    ids.rascunho = await criar(
      page,
      "atrativos",
      async () => {
        await page.getByLabel("Nome do atrativo").fill(NOMES.rascunho);
        await page.getByLabel("Categoria").selectOption("aventura");
      },
      "Criar atrativo",
    );

    ids.arquivado = await criar(
      page,
      "atrativos",
      async () => {
        await page.getByLabel("Nome do atrativo").fill(NOMES.arquivado);
        await page.getByLabel("Categoria").selectOption("cultura");
      },
      "Criar atrativo",
    );
    await mudarStatus(page, "Publicar no portal", "Publicado.");
    await mudarStatus(page, "Arquivar (tira do portal)", "Arquivado.");

    await page.goto(`${PALMEIROPOLIS}/admin/atrativos`);
    await expect(page.getByRole("heading", { name: /Publicado \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Em elaboração \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Arquivado \(\d+\)/ })).toBeVisible();
  });

  test("gestor cadastra eventos e prestador com adesão privada e comprovante", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    ids.evento = await criar(
      page,
      "eventos",
      async () => {
        await page.getByLabel("Nome do evento").fill(NOMES.evento);
        await page.getByLabel("Data de início").fill(diaDaqui(3));
        await page.getByLabel("Horário de início").fill("19:00");
        await page.getByLabel("Data de término").fill(diaDaqui(5));
        await page.getByLabel("Horário de término").fill("23:00");
        await page.getByLabel("Local").fill("Praça da Matriz");
      },
      "Criar evento",
    );
    await page.getByLabel("Atrativo onde acontece").selectOption({ label: NOMES.atrativo });
    await page.getByLabel("Organização").fill("Associação Cultural [E2E]");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();
    await mudarStatus(page, "Publicar no portal", "Publicado.");

    // Término antes do início é recusado no servidor e mostrado junto do campo.
    await page.goto(`${PALMEIROPOLIS}/admin/eventos/novo`);
    await page.getByLabel("Nome do evento").fill(NOMES.eventoRascunho);
    await page.getByLabel("Horário de início").fill("08:00");
    await page.getByLabel("Horário de término").fill("07:00");
    await page.getByRole("button", { name: "Criar evento" }).click();
    await expect(page.getByText("O término precisa ser igual ou depois do início.")).toBeVisible();
    await page.getByLabel("Horário de término").fill("12:00");
    await page.getByRole("button", { name: "Criar evento" }).click();
    await expect(page).toHaveURL(/\/admin\/eventos\/[0-9a-f-]{36}\?criado=1$/);
    ids.eventoRascunho = new URL(page.url()).pathname.split("/").pop()!;

    ids.prestador = await criar(
      page,
      "prestadores",
      async () => {
        await page.getByLabel("Nome público").fill(NOMES.prestador);
        await page.getByLabel("Categoria").selectOption("hospedagem");
        await page.getByLabel("Situação na rede").selectOption("participante");
      },
      "Criar prestador",
    );
    await page.getByLabel("Serviços oferecidos").fill("Quartos com café da manhã.");
    await page.getByLabel("Contatos autorizados para o portal").fill(NOMES.contatoPublico);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();

    // Comprovante de tipo errado é recusado; PDF válido é aceito.
    await page.getByLabel("Responsável pelo prestador").fill(NOMES.responsavel);
    await page.getByLabel("Contato interno").fill(NOMES.contatoInterno);
    await page.getByLabel("Comprovante (opcional)").setInputFiles({ name: "termo.pdf", mimeType: "application/pdf", buffer: FOTO_FALSA });
    await page.getByRole("button", { name: "Registrar adesão" }).click();
    await expect(alerta(page, "Tipo de arquivo não aceito. Envie PDF, JPEG ou PNG até 10 MB.")).toBeVisible();
    // 6 MB: maior que o limite de requisição da Vercel, então só passa pelo envio direto ao Storage.
    await page.getByLabel("Comprovante (opcional)").setInputFiles({ name: "termo.pdf", mimeType: "application/pdf", buffer: pdfGrande() });
    await page.getByRole("button", { name: "Registrar adesão" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Adesão registrada." })).toBeVisible();
    await expect(page.getByText(`Responsável: ${NOMES.responsavel}`)).toBeVisible();

    // Comprovante: redireciona para URL assinada do bucket interno, sem cache.
    const link = page.getByRole("link", { name: "Abrir comprovante" });
    const href = await link.getAttribute("href");
    const r = await pedir(page, href!, { maxRedirects: 0 });
    expect(r.status()).toBe(303);
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(r.headers()["location"]).toMatch(/\/storage\/v1\/object\/sign\/interno\/.+token=/);
    const pdf = await page.request.get(r.headers()["location"]);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await pdf.body()).length).toBe(6 * 1024 * 1024);
    ids.comprovante = href!;
    await mudarStatus(page, "Publicar no portal", "Publicado.");

    ids.prestadorRascunho = await criar(
      page,
      "prestadores",
      async () => {
        await page.getByLabel("Nome público").fill(NOMES.prestadorRascunho);
        await page.getByLabel("Categoria").selectOption("guias");
      },
      "Criar prestador",
    );

    // Atividade de registro voluntário publicada (para o botão "Registrar minha visita").
    await page.goto(`${PALMEIROPOLIS}/admin/atividades/nova`);
    await page.getByLabel("Registro voluntário").check();
    await page.getByLabel("Nome da atividade").fill(NOMES.atividade);
    await page.getByRole("button", { name: "Criar atividade" }).click();
    await expect(page).toHaveURL(/\/admin\/atividades\/[0-9a-f-]{36}\?criada=1$/);
    ids.atividade = new URL(page.url()).pathname.split("/").pop()!;
    await page.getByRole("button", { name: "Publicar no portal" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Atividade publicada" })).toBeVisible();
  });

  test("configurações: contraste baixo é recusado; contato, Ouvidoria e aviso aparecem no portal", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Mais" }).click();
    await page.getByRole("link", { name: /Configurações/ }).click();
    await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();

    await page.getByLabel("Código da cor").fill("#F2C94C");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText(/Cor clara demais: o texto branco sobre ela fica com contraste menor que 4.5:1/)).toBeVisible();

    await page.getByRole("button", { name: "#2B4A6B" }).click();
    await page.getByLabel("Contato da Secretaria de Turismo").fill("Rua [E2E], 100\n(63) 3000-0000");
    await page.getByLabel("Link da Ouvidoria oficial").fill("http://sem-https.exemplo");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("Informe o endereço completo, começando com https://")).toBeVisible();
    await page.getByLabel("Link da Ouvidoria oficial").fill("https://ouvidoria.exemplo.gov.br");
    await page.getByLabel("Aviso de privacidade").fill(NOMES.aviso);
    // Prazo de anonimização (D10, item 5.1): abaixo de 7 dias recusado; 120 gravado no banco.
    const prazo = page.getByLabel("Prazo para apagar nome e contato dos visitantes (dias)");
    await expect(prazo).toHaveValue("90");
    await prazo.fill("3");
    await prazo.evaluate((el) => el.removeAttribute("min")); // testa o servidor, não só o navegador
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("Use de 7 a 3650 dias.")).toBeVisible();
    await page.getByLabel("Prazo para apagar nome e contato dos visitantes (dias)").fill("120");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Configurações salvas." })).toBeVisible();
    const gravado = sql(
      "select c.dias_anonimizacao from public.configuracoes_municipio c join public.municipios m on m.id = c.municipio_id where m.slug = 'palmeiropolis'",
    );
    expect(gravado).toBe("120");
  });

  test("visitante vê só o publicado; rascunho e arquivado ficam fora do portal", async ({ browser }) => {
    const { ctx, page } = await visitante(browser);
    await page.goto(PALMEIROPOLIS);
    const main = page.getByRole("main");
    // A capa mostra até 3 eventos e 6 atrativos (execuções anteriores deixam outros [E2E] no banco
    // local); as listas completas precisam ter os desta execução.
    await expect(page.getByRole("region", { name: "Próximos eventos" }).getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Atrativos" }).getByRole("link").first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Hospedagem" })).toBeVisible();
    await expect(main.getByRole("link", { name: contem(NOMES.atividade) })).toBeVisible();
    for (const oculto of [NOMES.rascunho, NOMES.arquivado, NOMES.eventoRascunho, NOMES.prestadorRascunho]) {
      await expect(page.getByText(oculto)).toHaveCount(0);
    }

    // Cor configurada aplicada e rodapé com contato e Ouvidoria (abre em outra aba).
    await expect(page.locator("footer")).toHaveCSS("background-color", "rgb(43, 74, 107)");
    await expect(page.locator("footer")).toContainText("Rua [E2E], 100");
    const ouvidoria = page.getByRole("link", { name: /Ouvidoria do município/ });
    await expect(ouvidoria).toHaveAttribute("href", "https://ouvidoria.exemplo.gov.br");
    await expect(ouvidoria).toHaveAttribute("target", "_blank");

    // "Registrar minha visita" com o contorno escuro do canvas (1,5px; o Chromium arredonda para 1px
    // em tela de densidade 1).
    const registrar = page.getByRole("link", { name: "Registrar minha visita" });
    await expect(registrar).toHaveCSS("border-top-color", "rgb(22, 33, 27)");
    await expect(registrar).toHaveCSS("border-top-width", /^1(\.5)?px$/);

    // Lista de atrativos sem o rascunho e o arquivado; detalhe com foto otimizada e legenda como alt.
    await page.goto(`${PALMEIROPOLIS}/atrativos`);
    await expect(page.getByText(NOMES.rascunho)).toHaveCount(0);
    await expect(page.getByText(NOMES.arquivado)).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: contem(NOMES.atrativo) }).click();
    await expect(page.getByRole("heading", { name: NOMES.atrativo, level: 1 })).toBeVisible();
    const foto = page.getByRole("img", { name: NOMES.legenda });
    await expect(foto).toBeVisible();
    expect(await foto.getAttribute("src")).toContain("/_next/image?url=");
    const otimizada = await page.request.get(new URL((await foto.getAttribute("src"))!, NO_PREVIEW ? PALMEIROPOLIS : site()).toString(), {
      headers: { accept: "image/avif,image/webp,*/*" },
    });
    expect(otimizada.status()).toBe(200);
    expect(otimizada.headers()["content-type"]).toMatch(/image\/(avif|webp)/);
    await expect(page.getByText("Todos os dias, das 8h às 17h.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver no mapa/ })).toHaveAttribute("href", /openstreetmap\.org\/\?mlat=-13\.0412&mlon=-48\.3/);

    // Rascunho e arquivado: 404 por URL direta, igual a inexistente.
    for (const caminho of [`/atrativos/${ids.rascunho}`, `/atrativos/${ids.arquivado}`, `/eventos/${ids.eventoRascunho}`]) {
      const r = await page.goto(`${PALMEIROPOLIS}${caminho}`);
      expect(r?.status(), caminho).toBe(404);
    }

    // Calendário e evento publicado ligado ao atrativo.
    await page.goto(`${PALMEIROPOLIS}/eventos`);
    await expect(page.getByText(NOMES.eventoRascunho)).toHaveCount(0);
    await page.getByRole("link", { name: contem(NOMES.evento) }).click();
    await expect(page.getByRole("heading", { name: NOMES.evento, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: NOMES.atrativo })).toBeVisible();
    await expect(page.getByText("Associação Cultural [E2E]")).toBeVisible();

    await page.goto(`${PALMEIROPOLIS}/privacidade`);
    await expect(page.getByText(NOMES.aviso)).toBeVisible();
    await ctx.close();
  });

  test("contatos internos e comprovantes de adesão nunca aparecem em páginas públicas", async ({ browser }) => {
    const { ctx, page } = await visitante(browser);
    await page.goto(`${PALMEIROPOLIS}/prestadores`);
    await expect(page.getByRole("heading", { name: NOMES.prestador })).toBeVisible();
    await expect(page.getByText(NOMES.contatoPublico)).toBeVisible();
    await expect(page.getByText(NOMES.prestadorRascunho)).toHaveCount(0);

    const paginas = ["/", "/prestadores", "/prestadores?categoria=hospedagem", "/atrativos", `/atrativos/${ids.atrativo}`, "/eventos", `/eventos/${ids.evento}`, "/privacidade"];
    for (const caminho of paginas) {
      const r = await pedir(page, caminho);
      expect(r.status(), caminho).toBe(200);
      const html = await r.text();
      expect(html, caminho).not.toContain(NOMES.contatoInterno);
      expect(html, caminho).not.toContain(`INTERNO-${SUF}`);
      expect(html, caminho).not.toContain(NOMES.responsavel);
      expect(html, caminho).not.toContain("/adesoes/");
      expect(html, caminho).not.toContain("comprovante");
    }

    // O link do comprovante não abre nada para o visitante (sem sessão: vai para o login).
    const r = await pedir(page, ids.comprovante, { maxRedirects: 0 });
    expect([303, 307, 404]).toContain(r.status());
    expect(r.headers()["location"] ?? "").not.toContain("/storage/v1/object/sign/");
    await ctx.close();
  });

  test("operador vê o botão de emissão assistida com a borda escura do canvas", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.operadorPalmeiropolis);
    const botao = page.getByRole("link", { name: "Emitir voucher para visitante sem celular" });
    await expect(botao).toBeVisible();
    await expect(botao).toHaveCSS("border-top-color", "rgb(22, 33, 27)");
    await expect(botao).toHaveCSS("border-top-width", /^1(\.5)?px$/);
    await expect(botao).toHaveCSS("color", "rgb(22, 33, 27)");
    // Operador não abre cadastros do conteúdo.
    await page.goto(`${PALMEIROPOLIS}/admin/atrativos`);
    await expect(page).toHaveURL(/\/admin\/atendimento$/);
  });

  test("axe: nenhuma violação crítica ou séria nas páginas públicas", async ({ browser }) => {
    const { ctx, page } = await visitante(browser);
    const paginas = [
      site("", "/"),
      `${PALMEIROPOLIS}/`,
      `${PALMEIROPOLIS}/atrativos`,
      `${PALMEIROPOLIS}/atrativos/${ids.atrativo}`,
      `${PALMEIROPOLIS}/eventos`,
      `${PALMEIROPOLIS}/eventos/${ids.evento}`,
      `${PALMEIROPOLIS}/prestadores`,
      `${PALMEIROPOLIS}/privacidade`,
      `${PALMEIROPOLIS}/atividades/${ids.atividade}`,
      `${PALMEIROPOLIS}/nao-existe`,
    ];
    const resumo: string[] = [];
    for (const url of paginas) {
      await page.goto(url);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const graves = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      resumo.push(`${url.replace(/^https?:\/\//, "")}: ${r.passes.length} regras ok, ${graves.length} graves, ${r.violations.length - graves.length} menores`);
      expect(
        graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
        url,
      ).toEqual([]);
    }
    console.log(`axe:\n  ${resumo.join("\n  ")}`);
    // O menu do portal aberto também passa.
    await page.goto(`${PALMEIROPOLIS}/`);
    await page.getByLabel("Abrir menu").click();
    await expect(page.getByRole("navigation", { name: "Menu do portal" })).toBeVisible();
    const menu = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(menu.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id)).toEqual([]);
    await ctx.close();
  });

  test("metadados por município e por atrativo (título, descrição e Open Graph)", async ({ browser }) => {
    const { ctx, page } = await visitante(browser);
    await page.goto(`${PALMEIROPOLIS}/`);
    await expect(page).toHaveTitle("Turismo em Palmeirópolis");
    const meta = (seletor: string) => page.locator(seletor).first().getAttribute("content");
    expect(await meta('meta[name="description"]')).toContain("Palmeirópolis, Tocantins");
    expect(await meta('meta[property="og:title"]')).toBe("Turismo em Palmeirópolis");
    expect(await meta('meta[property="og:locale"]')).toBe("pt_BR");
    expect(await meta('meta[property="og:site_name"]')).toBe("Turismo em Palmeirópolis");

    await page.goto(`${PALMEIROPOLIS}/atrativos/${ids.atrativo}`);
    await expect(page).toHaveTitle(`${NOMES.atrativo} · Turismo em Palmeirópolis`);
    expect(await meta('meta[name="description"]')).toBe("Poço de águas claras a 12 km da cidade.");
    expect(await meta('meta[property="og:image"]')).toMatch(/\/storage\/v1\/object\/public\/publico\/[0-9a-f-]{36}\/fotos\/[0-9a-f-]{36}\.png$/);
    expect(await meta('meta[property="og:image:alt"]')).toBe(NOMES.legenda);

    await page.goto(`${PALMEIROPOLIS}/atrativos/${ids.rascunho}`);
    expect(await page.title()).not.toContain(NOMES.rascunho);

    await page.goto(site("peixe", "/"));
    await expect(page).toHaveTitle("Turismo em Peixe");
    await ctx.close();
  });
});
