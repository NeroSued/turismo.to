import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";
import { site, sql } from "./alvo";
import { criarVitrine, type Vitrine } from "./vitrine";

// Fase 9: portal público no computador (canvas "Turismo.TO Desktop"), em 1440x900. Home com
// cards em duas colunas, portal municipal, páginas de detalhe com mosaico, galeria pelo teclado,
// cursor de mão, imagens no tamanho certo, sem rolagem horizontal em 390, 768, 1024 e 1440 px.

const PALMEIROPOLIS = site("palmeiropolis");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PASTA_TELAS = "test-results/telas-computador";

let v: Vitrine;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  v = await criarVitrine();
});

test.afterAll(async () => {
  await v?.limpar();
});

async function graves(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function caixa(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error("elemento sem caixa (invisível)");
  return b;
}

function contem(texto: string) {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

const contagem = (n: number, um: string, varios: string, nenhum: string) => (n === 0 ? nenhum : n === 1 ? `1 ${um}` : `${n} ${varios}`);

test("home turismo.to: cards em duas colunas, capa ou iniciais, contagens reais e 'Como funcionam' na vaga", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turismo nos municípios participantes");
  const nav = page.getByRole("navigation", { name: "Municípios" });
  const cards = nav.getByRole("link");
  const total = await cards.count();
  expect(total).toBeGreaterThanOrEqual(2);

  // Duas colunas: o 1º e o 2º card na mesma linha, lado a lado e com a mesma largura.
  const [a, b] = [await caixa(cards.nth(0)), await caixa(cards.nth(1))];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(a.width).toBeGreaterThan(500);
  if (total > 2) expect((await caixa(cards.nth(2))).y).toBeGreaterThan(a.y + a.height);

  // Palmeirópolis com capa (foto 16:9), frase de apresentação e contagens do banco.
  const palmeiropolis = page.locator('[data-card-municipio="palmeiropolis"]');
  const capa = palmeiropolis.locator("[data-capa] img");
  await expect(capa).toBeVisible();
  await expect.poll(() => capa.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  const fotoCapa = await caixa(palmeiropolis.locator("[data-capa]"));
  expect(Math.abs(fotoCapa.width / fotoCapa.height - 16 / 9)).toBeLessThan(0.02);
  await expect(palmeiropolis).toContainText(`Serra, lago e festas do cerrado no sul do Tocantins ${v.suf}`);
  const [nAtrativos, nAtividades] = sql(
    "select (select count(*) from public.atrativos a where a.municipio_id = m.id and a.status = 'publicado') || '|' || (select count(*) from public.atividades a where a.municipio_id = m.id and a.status = 'publicado') from public.municipios m where m.slug = 'palmeiropolis'",
  ).split("|").map(Number);
  await expect(palmeiropolis).toContainText(contagem(nAtrativos, "atrativo", "atrativos", "Nenhum atrativo publicado"));
  await expect(palmeiropolis).toContainText(contagem(nAtividades, "atividade gratuita", "atividades gratuitas", "Nenhuma atividade aberta"));
  await expect(palmeiropolis).toContainText(/palmeiropolis\./);
  await expect(palmeiropolis).toContainText("Ver portal");

  // Sem capa: iniciais claras sobre o verde, no mesmo espaço 16:9.
  const semCapa = sql(
    "select string_agg(m.slug, ',' order by m.nome) from public.municipios m join public.configuracoes_municipio c on c.municipio_id = m.id where m.ativo and c.capa_caminho is null",
  ).split(",").filter(Boolean);
  expect(semCapa.length).toBeGreaterThan(0);
  for (const slug of semCapa) {
    const iniciais = page.locator(`[data-card-municipio="${slug}"] [data-iniciais]`);
    await expect(iniciais).toBeVisible();
    await expect(iniciais).toHaveCSS("background-color", "rgb(31, 77, 58)");
    expect(await iniciais.innerText()).toMatch(/^[A-ZÁ-Ú]{2}$/);
  }
  const peixe = page.locator('[data-card-municipio="peixe"] [data-iniciais]');
  if (semCapa.includes("peixe")) await expect(peixe).toHaveText("PE");

  // "Como funcionam as atividades": com número ímpar de municípios, ocupa a vaga ao lado do último card.
  const bloco = page.locator("#como-funciona");
  await expect(bloco.getByRole("heading", { name: "Como funcionam as atividades" })).toBeVisible();
  const ultimo = await caixa(cards.nth(total - 1));
  const caixaBloco = await caixa(bloco);
  if (total % 2 === 1) {
    expect(Math.abs(caixaBloco.y - ultimo.y)).toBeLessThan(2);
    expect(caixaBloco.x).toBeGreaterThan(ultimo.x + ultimo.width);
    expect(Math.abs(caixaBloco.width - ultimo.width)).toBeLessThan(2);
  } else {
    expect(caixaBloco.y).toBeGreaterThan(ultimo.y + ultimo.height);
  }
  console.log(`home 1440: ${total} cards em 2 colunas (${Math.round(a.width)} px cada); capa em palmeiropolis; iniciais em ${semCapa.join(", ")}; ${contagem(nAtrativos, "atrativo", "atrativos", "0")}, ${contagem(nAtividades, "atividade", "atividades", "0")}; bloco 'Como funcionam' ${total % 2 ? "na vaga do ímpar" : "em linha própria"}`);

  expect(await graves(page)).toEqual([]);
  mkdirSync(PASTA_TELAS, { recursive: true });
  await page.screenshot({ path: `${PASTA_TELAS}/home-1440.png`, fullPage: true });
});

test("portal municipal: âncoras e reserva no cabeçalho, capa com painel, grades, cartaz, filtro e rodapé em colunas", async ({ page }) => {
  await page.goto(PALMEIROPOLIS);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Palmeirópolis");

  // Cabeçalho: âncoras das seções e o botão de reserva, sem o menu em gaveta.
  const secoes = page.getByRole("navigation", { name: "Seções do portal" });
  for (const nome of ["Atividades", "Eventos", "Atrativos", "Prestadores", "Contato"]) await expect(secoes.getByRole("link", { name: nome })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Reservar atividade" })).toBeVisible();
  await expect(page.getByLabel("Abrir menu")).toBeHidden();
  await secoes.getByRole("link", { name: "Atrativos" }).click();
  await expect(page).toHaveURL(/#atrativos$/);
  await expect(page.getByRole("heading", { name: "Atrativos", level: 2 })).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));

  // Capa de 500 px com o painel branco sobreposto à parte de baixo.
  const capa = page.getByRole("img", { name: "Foto de Palmeirópolis" });
  await expect(capa).toBeVisible();
  const caixaCapa = await caixa(capa);
  expect(Math.round(caixaCapa.height)).toBe(500);
  const painel = await caixa(page.locator("[data-painel-capa]"));
  expect(painel.y).toBeLessThan(caixaCapa.y + caixaCapa.height - 100);
  expect(painel.y + painel.height).toBeGreaterThan(caixaCapa.y + caixaCapa.height);
  expect(painel.width).toBeLessThanOrEqual(560);
  await expect(page.locator("[data-painel-capa]")).toContainText(`Serra, lago e festas do cerrado no sul do Tocantins ${v.suf}`);

  // Atividades em grade de cards verticais (foto 3:2 em cima).
  const atividades = page.locator("#atividades ul");
  await expect(atividades).toHaveCSS("display", "grid");
  const cartaoAtividade = atividades.getByRole("link", { name: contem(v.nomes.atividade) });
  await expect(cartaoAtividade).toContainText("Escolher horário");
  const fotoAtividade = await caixa(cartaoAtividade.locator("img"));
  expect(Math.abs(fotoAtividade.width / fotoAtividade.height - 1.5)).toBeLessThan(0.02);
  expect(fotoAtividade.width).toBeGreaterThan(300);

  // Evento com cartaz 4:5 ao lado do texto.
  const evento = page.locator("#eventos").getByRole("link", { name: contem(v.nomes.evento) });
  const cartaz = await caixa(evento.getByRole("img", { name: "Cartaz do festival" }));
  expect(Math.round(cartaz.width)).toBe(132);
  expect(Math.abs(cartaz.width / cartaz.height - 0.8)).toBeLessThan(0.02);
  await expect(evento).toContainText("Organização: Secretaria de Turismo");

  // Atrativos: filtro só com as categorias publicadas.
  const categorias = sql(
    "select string_agg(distinct categoria, ',') from public.atrativos a join public.municipios m on m.id = a.municipio_id where m.slug = 'palmeiropolis' and a.status = 'publicado'",
  ).split(",");
  const rotulos: Record<string, string> = { natureza: "Natureza", cultura: "Cultura", historico: "Histórico", religioso: "Religioso", aventura: "Aventura", lazer: "Lazer", gastronomia: "Gastronomia", outro: "Outro" };
  const filtro = page.getByRole("group", { name: "Filtrar por categoria" });
  await expect(filtro.getByRole("button")).toHaveCount(categorias.length + 1);
  for (const c of categorias) await expect(filtro.getByRole("button", { name: rotulos[c] })).toBeVisible();
  await expect(filtro.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  const grade = page.locator("#atrativos ul");
  await filtro.getByRole("button", { name: "Religioso" }).click();
  await expect(filtro.getByRole("button", { name: "Religioso" })).toHaveAttribute("aria-pressed", "true");
  await expect(grade.getByRole("link", { name: contem(v.nomes.igreja) })).toBeVisible();
  await expect(grade.getByRole("link", { name: contem(v.nomes.mirante) })).toHaveCount(0);
  const religiosos = Number(sql("select count(*) from public.atrativos a join public.municipios m on m.id = a.municipio_id where m.slug = 'palmeiropolis' and a.status = 'publicado' and a.categoria = 'religioso'"));
  await expect(grade.getByRole("listitem")).toHaveCount(Math.min(religiosos, 8));
  await filtro.getByRole("button", { name: "Todos" }).click();
  const publicados = Number(sql("select count(*) from public.atrativos a join public.municipios m on m.id = a.municipio_id where m.slug = 'palmeiropolis' and a.status = 'publicado'"));
  await expect(grade.getByRole("listitem")).toHaveCount(Math.min(publicados, 8));

  // Prestadores em cards com foto; rodapé em colunas.
  await expect(page.locator("#prestadores").getByRole("link", { name: contem(v.nomes.prestador) })).toContainText("Participante da rede");
  const colunas = page.locator("#contato > div > *");
  await expect(colunas).toHaveCount(3);
  const [c1, c2, c3] = [await caixa(colunas.nth(0)), await caixa(colunas.nth(1)), await caixa(colunas.nth(2))];
  expect(c2.x).toBeGreaterThan(c1.x + c1.width);
  expect(c3.x).toBeGreaterThan(c2.x + c2.width);
  console.log(`portal 1440: capa ${Math.round(caixaCapa.height)} px com painel sobreposto; atividades em grade; cartaz ${Math.round(cartaz.width)}x${Math.round(cartaz.height)}; filtro com ${categorias.length} categorias publicadas (${categorias.join(", ")}); rodapé em 3 colunas`);

  expect(await graves(page)).toEqual([]);
  await page.screenshot({ path: `${PASTA_TELAS}/portal-1440.png`, fullPage: true });
});

test("detalhe do atrativo: caminho, mosaico de 5 com 'Ver as 6 fotos', texto à esquerda, informações à direita e outros atrativos", async ({ page }) => {
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`);
  await expect(page.getByRole("heading", { level: 1, name: v.nomes.mirante })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Caminho" })).toContainText(`Palmeirópolis/Atrativos/${v.nomes.mirante}`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Reservar atividade" })).toBeVisible();

  // Mosaico: capa grande à esquerda (2 linhas) e 4 menores; a última abre todas as fotos.
  const mosaico = page.locator("[data-mosaico]");
  await expect(mosaico).toHaveAttribute("data-mosaico", "5");
  await expect(mosaico).toHaveCSS("display", "grid");
  const botoes = mosaico.getByRole("button");
  await expect(botoes).toHaveCount(5);
  const grande = await caixa(botoes.nth(0));
  const menor = await caixa(botoes.nth(1));
  expect(grande.height).toBeGreaterThan(menor.height * 1.9);
  expect(grande.width).toBeGreaterThan(menor.width * 1.9);
  await expect(mosaico.getByRole("button", { name: "Ver todas as 6 fotos" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fotos" })).toBeHidden();

  // Duas colunas: texto à esquerda, informações à direita, alinhadas no topo.
  const titulo = await caixa(page.getByRole("heading", { level: 1 }));
  const info = await caixa(page.locator("[data-coluna=informacoes] dl"));
  expect(info.x).toBeGreaterThan(titulo.x + 500);
  expect(Math.abs(info.y - titulo.y)).toBeLessThan(80);
  await expect(page.getByRole("region", { name: "Sobre" }).locator("p")).toHaveCount(2);
  await expect(page.locator("[data-coluna=texto]").getByRole("region", { name: "Orientações ambientais" })).toBeVisible();
  await expect(page.locator("[data-coluna=texto]").getByRole("region", { name: "Eventos aqui" })).toContainText(v.nomes.evento);
  await expect(page.locator("[data-coluna=informacoes]").getByRole("region", { name: "Atividades com voucher aqui" })).toContainText(v.nomes.atividade);
  await expect(page.locator("[data-coluna=informacoes]").getByRole("region", { name: "Como chegar" })).toBeVisible();

  const outros = page.getByRole("region", { name: "Outros atrativos em Palmeirópolis" });
  // Os 4 primeiros publicados, em ordem de nome, sem o próprio atrativo.
  const esperados = sql(
    `select string_agg(nome, '|' order by nome) from (select a.nome from public.atrativos a join public.municipios m on m.id = a.municipio_id where m.slug = 'palmeiropolis' and a.status = 'publicado' and a.id <> '${v.ids.mirante}' order by a.nome limit 4) x`,
  ).split("|");
  await expect(outros.getByRole("link")).toHaveCount(esperados.length);
  for (const nome of esperados) await expect(outros.getByRole("link", { name: contem(nome) })).toBeVisible();
  await expect(outros.getByRole("link", { name: contem(v.nomes.mirante) })).toHaveCount(0);
  console.log(`detalhe 1440: mosaico 5 (capa ${Math.round(grande.width)}x${Math.round(grande.height)}, menores ${Math.round(menor.width)}x${Math.round(menor.height)}); informações a ${Math.round(info.x - titulo.x)} px à direita do título; outros atrativos listados`);

  expect(await graves(page)).toEqual([]);
  await page.screenshot({ path: `${PASTA_TELAS}/atrativo-1440.png`, fullPage: true });

  // O mosaico se adapta: 1 foto ocupa tudo; 3 fotos = capa e duas empilhadas.
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.igreja}`);
  await expect(page.locator("[data-mosaico]")).toHaveAttribute("data-mosaico", "1");
  const unica = await caixa(page.locator("[data-mosaico]").getByRole("button"));
  expect(Math.round(unica.width)).toBe(1200);
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.museu}`);
  const tres = page.locator("[data-mosaico]").getByRole("button");
  await expect(tres).toHaveCount(3);
  const [t1, t2, t3] = [await caixa(tres.nth(0)), await caixa(tres.nth(1)), await caixa(tres.nth(2))];
  expect(Math.abs(t2.x - t3.x)).toBeLessThan(2);
  expect(t3.y).toBeGreaterThan(t2.y + t2.height - 1);
  expect(Math.abs(t1.height - (t3.y + t3.height - t2.y))).toBeLessThan(2);
  console.log(`mosaico: 1 foto = ${Math.round(unica.width)} px de largura; 3 fotos = capa ${Math.round(t1.width)} px + 2 empilhadas`);
});

test("atividade, evento e prestador seguem o mesmo layout de detalhe", async ({ page }) => {
  await page.goto(`${PALMEIROPOLIS}/atividades/${v.ids.atividade}`);
  await expect(page.getByRole("heading", { level: 1, name: v.nomes.atividade })).toBeVisible();
  const formulario = page.locator("[data-coluna=informacoes] form");
  await expect(formulario).toBeVisible();
  const titulo = await caixa(page.getByRole("heading", { level: 1 }));
  expect((await caixa(formulario)).x).toBeGreaterThan(titulo.x + 500);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  expect(await graves(page)).toEqual([]);

  await page.goto(`${PALMEIROPOLIS}/eventos/${v.ids.evento}`);
  await expect(page.getByRole("heading", { level: 1, name: v.nomes.evento })).toBeVisible();
  await expect(page.locator("[data-mosaico]")).toHaveAttribute("data-mosaico", "1");
  expect((await caixa(page.locator("[data-coluna=informacoes] dl"))).x).toBeGreaterThan((await caixa(page.getByRole("heading", { level: 1 }))).x + 500);
  await expect(page.getByRole("navigation", { name: "Caminho" })).toContainText("Eventos");
  expect(await graves(page)).toEqual([]);

  await page.goto(`${PALMEIROPOLIS}/prestadores/${v.ids.prestador}`);
  await expect(page.getByRole("heading", { level: 1, name: v.nomes.prestador })).toBeVisible();
  expect((await caixa(page.locator("[data-coluna=informacoes] dl"))).x).toBeGreaterThan((await caixa(page.getByRole("heading", { level: 1 }))).x + 500);
  await expect(page.getByRole("navigation", { name: "Caminho" })).toContainText("Rede de prestadores");
  expect(await graves(page)).toEqual([]);
});

test("galeria em tela cheia no computador: setas, ← → e Esc, foco preso e devolvido, miniaturas, legenda e crédito", async ({ page }) => {
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`);
  const abrir = page.locator("[data-mosaico]").getByRole("button").first();
  await abrir.focus();
  await page.keyboard.press("Enter");
  const galeria = page.getByRole("dialog", { name: `Galeria de fotos de ${v.nomes.mirante}` });
  await expect(galeria).toBeVisible();
  await expect(galeria.getByText("1 de 6")).toBeVisible();
  await expect(galeria.getByRole("img", { name: v.legendas[0] })).toBeVisible();
  await expect(galeria.getByText(v.legendas[0], { exact: true })).toBeVisible();
  await expect(galeria.getByText(`Foto: ${v.credito}`)).toBeVisible();

  // Setas ao lado da foto, legenda e crédito na mesma linha, 6 miniaturas centralizadas.
  const anterior = galeria.getByRole("button", { name: "Foto anterior" });
  const proxima = galeria.getByRole("button", { name: "Próxima foto" });
  const imagem = await caixa(galeria.getByRole("img", { name: v.legendas[0] }));
  expect((await caixa(anterior)).x + 52).toBeLessThanOrEqual(imagem.x + 1);
  expect((await caixa(proxima)).x).toBeGreaterThanOrEqual(imagem.x + imagem.width - 1);
  const legenda = await caixa(galeria.getByText(v.legendas[0], { exact: true }));
  const credito = await caixa(galeria.getByText(`Foto: ${v.credito}`));
  expect(Math.abs(legenda.y - credito.y)).toBeLessThan(4);
  const miniaturas = galeria.getByRole("button", { name: /^Ver foto \d de 6$/ });
  await expect(miniaturas).toHaveCount(6);
  expect(Math.round((await caixa(miniaturas.first())).width)).toBe(72);
  await expect(anterior).toBeDisabled();

  // Teclado: → e ← trocam de foto; o contador acompanha.
  await page.keyboard.press("ArrowRight");
  await expect(galeria.getByText("2 de 6")).toBeVisible();
  await expect(galeria.getByRole("img", { name: v.legendas[1] })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(galeria.getByText("3 de 6")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(galeria.getByText("2 de 6")).toBeVisible();

  // Foco preso: Tab e Shift+Tab nunca saem da galeria.
  const dentro = () => galeria.evaluate((d) => d.contains(document.activeElement) && document.activeElement !== d);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dentro(), `Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await dentro(), `Shift+Tab ${i + 1}`).toBe(true);
  }

  // Seta "Próxima" focada até a última foto: ela se desativa e o foco continua na galeria.
  await proxima.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  await expect(galeria.getByText("6 de 6")).toBeVisible();
  await expect(proxima).toBeDisabled();
  expect(await dentro()).toBe(true);
  await page.keyboard.press("ArrowLeft");
  await expect(galeria.getByText("5 de 6")).toBeVisible();

  // Miniatura leva direto à foto; Esc fecha e devolve o foco a quem abriu.
  await miniaturas.nth(2).click();
  await expect(galeria.getByText("3 de 6")).toBeVisible();
  await expect(miniaturas.nth(2)).toHaveAttribute("aria-current", "true");
  expect(await graves(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(galeria).toBeHidden();
  await expect(abrir).toBeFocused();

  // "Ver as 6 fotos" (5º quadro do mosaico) abre a galeria na 5ª foto.
  await page.locator("[data-mosaico]").getByRole("button", { name: "Ver todas as 6 fotos" }).click();
  await expect(galeria.getByText("5 de 6")).toBeVisible();
  await galeria.getByRole("button", { name: "Fechar galeria" }).click();
  await expect(galeria).toBeHidden();
  console.log("galeria 1440: Enter abre em 1 de 6; → 2, → 3, ← 2; 12 Tab e 12 Shift+Tab dentro; última foto desativa a seta e o foco fica; miniatura → 3 de 6; Esc fecha e devolve o foco");
});

test("nenhuma página pública tem rolagem horizontal em 390, 768, 1024 e 1440 px", async ({ page }) => {
  test.setTimeout(240_000);
  const paginas = [
    site("", "/"),
    PALMEIROPOLIS + "/",
    `${PALMEIROPOLIS}/atrativos`,
    `${PALMEIROPOLIS}/eventos`,
    `${PALMEIROPOLIS}/prestadores`,
    `${PALMEIROPOLIS}/privacidade`,
    `${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`,
    `${PALMEIROPOLIS}/atrativos/${v.ids.igreja}`,
    `${PALMEIROPOLIS}/atividades/${v.ids.atividade}`,
    `${PALMEIROPOLIS}/eventos/${v.ids.evento}`,
    `${PALMEIROPOLIS}/prestadores/${v.ids.prestador}`,
    site("peixe", "/"),
  ];
  const resultado: string[] = [];
  for (const largura of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const url of paginas) {
      await page.goto(url);
      await page.waitForLoadState("load");
      const { rolagem, janela } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, janela: window.innerWidth }));
      expect(rolagem, `${url} em ${largura} px`).toBeLessThanOrEqual(janela);
    }
    resultado.push(`${largura} px: ${paginas.length} páginas sem rolagem horizontal`);
  }
  console.log(resultado.join("; "));
});

test("cursor: mão em botões, summary, select e upload; 'proibido' nos desativados (portal e painel)", async ({ page }) => {
  const cursor = (l: Locator) => l.evaluate((e) => getComputedStyle(e).cursor);

  await page.goto(PALMEIROPOLIS);
  const todos = page.getByRole("group", { name: "Filtrar por categoria" }).getByRole("button", { name: "Todos" });
  expect(await cursor(todos)).toBe("pointer");
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`);
  expect(await cursor(page.locator("[data-mosaico]").getByRole("button").first())).toBe("pointer");
  await page.locator("[data-mosaico]").getByRole("button").first().click();
  const galeria = page.getByRole("dialog");
  expect(await cursor(galeria.getByRole("button", { name: "Foto anterior" }))).toBe("not-allowed");
  expect(await cursor(galeria.getByRole("button", { name: "Próxima foto" }))).toBe("pointer");
  expect(await cursor(galeria.getByRole("button", { name: "Fechar galeria" }))).toBe("pointer");
  await page.keyboard.press("Escape");

  // No celular, o menu do portal é um <summary>.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PALMEIROPOLIS);
  expect(await cursor(page.locator("summary"))).toBe("pointer");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Painel: entrar, botões, select, label de upload e botões desativados.
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  const entrar = page.getByRole("button", { name: "Entrar" });
  expect(await cursor(entrar)).toBe("pointer");
  await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPalmeiropolis);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await entrar.click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`${PALMEIROPOLIS}/admin/atrativos/${v.ids.mirante}/fotos`);
  const daGaleria = page.locator("label").filter({ hasText: "Da galeria" });
  expect(await cursor(daGaleria)).toBe("pointer");
  expect(await cursor(page.getByRole("button", { name: "Mover a foto 2 para cima" }))).toBe("not-allowed");
  expect(await cursor(page.getByRole("button", { name: "Mover a foto 2 para baixo" }))).toBe("pointer");
  await page.goto(`${PALMEIROPOLIS}/admin/atividades/${v.ids.atividade}`);
  const select = page.locator("select").first();
  if (await select.count()) expect(await cursor(select)).toBe("pointer");
  console.log("cursor: botões, summary, select e label de upload = pointer; seta da 1ª foto e mover para cima da foto 2 (desativados) = not-allowed");
});

test("imagens no tamanho certo: miniaturas não baixam a versão grande; fotos escondidas no celular não são baixadas", async ({ page }) => {
  const larguraPedida = (src: string) => Number(new URL(src, "http://x").searchParams.get("w") ?? "0");
  async function conferir(rotulo: string) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    const imagens = await page.locator("img").evaluateAll((lista) =>
      (lista as HTMLImageElement[]).filter((i) => i.currentSrc && i.offsetParent !== null && i.clientWidth > 0).map((i) => ({ src: i.currentSrc, largura: i.clientWidth, alt: i.alt })),
    );
    expect(imagens.length, rotulo).toBeGreaterThan(0);
    for (const i of imagens) {
      const w = larguraPedida(i.src);
      expect(w, `${rotulo}: ${i.alt || "(decorativa)"} com ${i.largura} px`).toBeGreaterThan(0);
      // Até o próximo tamanho gerado pelo otimizador acima da largura exibida (DPR 1).
      // Miniatura: até 256 px, salvo quando o navegador reaproveita do cache a mesma URL já baixada para uma foto grande da página.
      const reaproveitada = imagens.some((g) => g.largura > 140 && g.src === i.src);
      if (i.largura <= 140 && !reaproveitada) expect(w, `${rotulo}: miniatura de ${i.largura} px pediu ${w} px`).toBeLessThanOrEqual(256);
      else expect(w, `${rotulo}: foto de ${i.largura} px pediu ${w} px`).toBeLessThanOrEqual(Math.max(i.largura * 1.9, 640));
    }
    return imagens.length;
  }
  await page.goto("/");
  const a = await conferir("home");
  await page.goto(PALMEIROPOLIS);
  const b = await conferir("portal");
  await page.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`);
  const c = await conferir("detalhe");
  // Ao abrir a galeria, só a foto grande vem em tamanho grande; as 6 miniaturas (72 px) pedem no
  // máximo 128 px, ou reaproveitam do cache a versão que o mosaico já tinha baixado (nada novo).
  const pedidos: number[] = [];
  const ouvir = (r: { url(): string }) => {
    if (r.url().includes("/_next/image")) pedidos.push(larguraPedida(r.url()));
  };
  page.on("request", ouvir);
  await page.locator("[data-mosaico]").getByRole("button").first().click();
  await page.waitForLoadState("networkidle");
  page.off("request", ouvir);
  await expect(page.getByRole("dialog").locator("button img")).toHaveCount(6);
  const miniaturas = pedidos.filter((w) => w <= 256);
  expect(pedidos.filter((w) => w > 256).length, `pedidos ao abrir: ${pedidos.join(", ")}`).toBeLessThanOrEqual(1);
  for (const w of miniaturas) expect(w).toBeLessThanOrEqual(128);
  await page.keyboard.press("Escape");

  // Celular: os quadros menores do mosaico ficam escondidos e não são baixados.
  // Contexto novo, sem o cache da visita em 1440 px.
  const celular = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const p = await celular.newPage();
  await p.goto(`${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`);
  await p.waitForLoadState("networkidle");
  const escondidas = await p.locator("[data-mosaico] button.hidden img").evaluateAll((l) => (l as HTMLImageElement[]).map((i) => i.naturalWidth));
  expect(escondidas).toHaveLength(4);
  expect(escondidas.every((w) => w === 0)).toBe(true);
  await celular.close();
  console.log(`imagens: home ${a}, portal ${b}, detalhe ${c} conferidas (miniaturas até 256 px, fotos até ~2x a largura exibida); miniaturas da galeria pediram ${miniaturas.join(", ")} px; no celular, 4 quadros escondidos do mosaico não baixados`);
});

test("axe: nenhuma violação crítica ou séria nas páginas públicas em 1440 px", async ({ page }) => {
  const paginas = [
    site("", "/"),
    PALMEIROPOLIS + "/",
    `${PALMEIROPOLIS}/atrativos`,
    `${PALMEIROPOLIS}/eventos`,
    `${PALMEIROPOLIS}/prestadores`,
    `${PALMEIROPOLIS}/privacidade`,
    `${PALMEIROPOLIS}/atrativos/${v.ids.mirante}`,
    `${PALMEIROPOLIS}/atividades/${v.ids.atividade}`,
    `${PALMEIROPOLIS}/eventos/${v.ids.evento}`,
    `${PALMEIROPOLIS}/prestadores/${v.ids.prestador}`,
    `${PALMEIROPOLIS}/admin/login`,
  ];
  const r: string[] = [];
  for (const url of paginas) {
    await page.goto(url);
    expect(await graves(page), url).toEqual([]);
    r.push(new URL(url).pathname);
  }
  console.log(`axe 1440: 0 violações críticas ou sérias em ${r.length} páginas (${r.join(", ")})`);
});
