import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";
import { PDF_TESTE, pngSolido } from "./arquivos";

// Fase 3 no celular (390x844, build de produção): relatórios com origem, prestadores e versões,
// CSV de divulgação sem dados pessoais, evidências com fotos, anexos e histórico, minuta sem
// assinatura simulada, cabeçalhos private/no-store e isolamento entre municípios.

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const PEIXE = "http://peixe.localhost:3000";
const SUF = randomBytes(3).toString("hex");
const DADOS = {
  atividade: `[E2E] Mirante ${SUF}`,
  nome: `[E2E] Fulana Visitante ${SUF}`,
  contato: `E2E-${SUF} (63) 98888-7777`,
  cidadePequena: `Vila${SUF}`,
  evidencia: `[E2E] Oficina de condutores ${SUF}`,
  evidenciaEditada: `[E2E] Oficina de condutores locais ${SUF}`,
  analise: `[E2E] Análise do responsável ${SUF}.`,
  legendaFoto: `Participantes na sala da Secretaria ${SUF}`,
};
const ids: Record<string, string> = {};

/** SQL no Postgres LOCAL (container do Supabase CLI), como o global-setup. */
function sqlLocal(sql: string) {
  return execSync("docker exec -i supabase_db_turismo-to psql -U postgres -q -t -A -v ON_ERROR_STOP=1", {
    input: sql,
    encoding: "utf8",
  }).trim();
}

async function entrar(page: Page, base: string, email: string) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

/** GET direto no servidor com o Host do município e os cookies da página (o Node não resolve *.localhost). */
async function pedir(page: Page, base: string, caminho: string, opcoes: { maxRedirects?: number } = {}) {
  const host = new URL(base).host;
  const cookies = (await page.context().cookies(base)).map((c) => `${c.name}=${c.value}`).join("; ");
  return page.request.get(`http://localhost:3000${caminho}`, {
    headers: { host, ...(cookies ? { cookie: cookies } : {}) },
    maxRedirects: opcoes.maxRedirects,
  });
}

function semCache(cabecalho: string | undefined) {
  expect(cabecalho ?? "").toContain("private");
  expect(cabecalho ?? "").toContain("no-store");
}

test.describe.serial("relatórios e evidências no celular", () => {
  test.beforeAll(() => {
    // Registros voluntários com nome e contato do responsável: dados pessoais que nunca podem
    // aparecer no CSV de divulgação (nem no administrativo). Três de Gurupi e um de cidade pequena.
    const nome = DADOS.nome.replace(/'/g, "''");
    sqlLocal(`
      with m as (select id from public.municipios where slug = 'palmeiropolis'),
      a as (
        insert into public.atividades (municipio_id, titulo, modo, status, exige_responsavel, exige_contato)
        select id, '${DADOS.atividade}', 'registro_voluntario', 'publicado', true, true from m
        returning id, municipio_id
      )
      select privado.emitir_voucher_publico(a.municipio_id, a.id, null, privado.hoje_local(), 2, c.cidade, 'TO',
        '${nome}', '${DADOS.contato}', gen_random_uuid())
      from a, (values ('Gurupi'), ('Gurupi'), ('Gurupi'), ('${DADOS.cidadePequena}')) as c (cidade);
    `);
  });

  test("gestor registra evidência com foto e lista de presença; a edição entra no histórico", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("link", { name: "Nova evidência" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nova evidência" })).toBeVisible();

    await page.getByLabel("Tipo da ação").selectOption("capacitacao");
    await page.getByLabel("Título").fill(DADOS.evidencia);
    await page.getByLabel("Descrição").fill("Oficina com condutores locais sobre segurança em trilhas.");
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date());
    await page.getByLabel("Data de realização").fill(hoje);
    await page.getByLabel("Responsável pela ação").fill("Secretaria de Turismo");
    await page.getByLabel("Atividade relacionada (opcional)").selectOption({ label: DADOS.atividade });
    await page.getByRole("button", { name: "Registrar evidência" }).click();

    await expect(page).toHaveURL(/\/admin\/evidencias\/[0-9a-f-]{36}\?criada=1$/);
    ids.evidencia = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1, name: DADOS.evidencia })).toBeVisible();
    await expect(page.getByText("Incluída por")).toBeVisible();
    await expect(page.getByText("[DEV] Gestor de Palmeirópolis").first()).toBeVisible();
    await expect(page.getByText("ainda não tem fotos nem anexos")).toBeVisible();

    // Foto (PNG) com legenda e lista de presença (PDF) no bucket interno
    await page.getByLabel("Tipo do arquivo").selectOption("foto");
    await page.getByLabel("Arquivo", { exact: true }).setInputFiles({ name: "oficina.png", mimeType: "image/png", buffer: pngSolido(64, 48, [40, 110, 90]) });
    await page.getByLabel("Legenda").fill(DADOS.legendaFoto);
    await page.getByRole("button", { name: "Enviar arquivo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Foto enviada." })).toBeVisible();
    const foto = page.getByRole("img", { name: DADOS.legendaFoto });
    await expect(foto).toBeVisible();
    await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(64);

    await page.getByLabel("Tipo do arquivo").selectOption("lista_presenca");
    await page.getByLabel("Arquivo", { exact: true }).setInputFiles({ name: "lista.pdf", mimeType: "application/pdf", buffer: PDF_TESTE });
    await page.getByLabel("Legenda").fill("Lista de presença da oficina");
    await page.getByRole("button", { name: "Enviar arquivo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Anexo enviado." })).toBeVisible();
    const anexo = page.getByRole("link", { name: /Lista de presença da oficina/ });
    await expect(anexo).toBeVisible();
    ids.anexo = (await anexo.getAttribute("href"))!.split("/").pop()!;

    // Edição: o histórico registra o campo alterado, o autor e o horário
    await page.getByLabel("Título").fill(DADOS.evidenciaEditada);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas" })).toBeVisible();
    await page.reload();
    const historico = page.getByRole("region", { name: "Histórico de alterações" }).getByRole("listitem");
    await expect(historico).toHaveCount(4);
    await expect(historico.nth(0)).toContainText("Alterou título");
    await expect(historico.nth(0)).toContainText("[DEV] Gestor de Palmeirópolis");
    await expect(historico.nth(0)).toContainText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
    await expect(historico.nth(1)).toContainText("Incluiu Lista de presença: Lista de presença da oficina");
    await expect(historico.nth(2)).toContainText(`Incluiu Foto: ${DADOS.legendaFoto}`);
    await expect(historico.nth(3)).toContainText("Registrou a evidência");

    // Data de realização futura: recusada no servidor (o campo do navegador também limita)
    await page.getByLabel("Data de realização").evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await page.getByLabel("Data de realização").fill("2099-01-01");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("A data de realização não pode ser no futuro.").first()).toBeVisible();
  });

  test("relatório por ano-base com origem, prestadores e versão para divulgação", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Relatórios" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relatório de vouchers e registros" })).toBeVisible();
    await expect(page.getByLabel("Ano-base")).toHaveValue(new Date().getFullYear().toString());
    for (const h of ["Reservas gratuitas", "Registros voluntários", "Atividades envolvidas", "Origem dos participantes", "Prestadores envolvidos", "Vouchers do período"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    await expect(page.getByRole("table", { name: "Origem por cidade" })).toContainText("Gurupi/TO");
    await expect(page.getByRole("table", { name: "Origem por cidade" })).toContainText(`${DADOS.cidadePequena}/TO`);
    const html = await page.content();
    expect(html).not.toContain(DADOS.nome);
    expect(html).not.toContain(DADOS.contato);

    await page.getByRole("link", { name: "Para divulgação" }).click();
    await expect(page).toHaveURL(/versao=divulgacao/);
    await expect(page.getByText("Versão para divulgação: só números agregados")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Vouchers do período" })).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Origem por cidade" })).toContainText("Gurupi/TO");
    await expect(page.getByRole("table", { name: "Origem por cidade" })).not.toContainText(DADOS.cidadePequena);
    await expect(page.getByRole("table", { name: "Origem por cidade" })).toContainText("Outras cidades");

    // Impressão: sem navegação, filtros e botões
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Navegação do painel" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Baixar CSV" })).toBeHidden();
    await expect(page.getByRole("heading", { level: 2, name: "Origem dos participantes" })).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  test("CSV de divulgação sem nome nem contato; CSV administrativo também sem eles", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    const div = await pedir(page, PALMEIROPOLIS, "/admin/relatorios/csv?versao=divulgacao");
    expect(div.status()).toBe(200);
    expect(div.headers()["content-type"]).toContain("text/csv");
    expect(div.headers()["content-disposition"]).toMatch(/attachment; filename="relatorio-palmeiropolis-\d{4}-divulgacao\.csv"/);
    const csvDiv = await div.text();
    console.log(`CSV de divulgação (${csvDiv.length} caracteres), primeiras linhas:\n${csvDiv.split("\r\n").slice(0, 8).join("\n")}`);
    expect(csvDiv).toContain("Para divulgação (sem dados pessoais)");
    expect(csvDiv).toContain("Gurupi/TO");
    expect(csvDiv).toContain(DADOS.atividade);
    expect(csvDiv).not.toContain(DADOS.nome);
    expect(csvDiv).not.toContain("Fulana");
    expect(csvDiv).not.toContain(DADOS.contato);
    expect(csvDiv).not.toContain("98888-7777");
    expect(csvDiv).not.toContain(DADOS.cidadePequena);
    expect(csvDiv).not.toMatch(/^Vouchers;Código/m);

    const adm = await pedir(page, PALMEIROPOLIS, "/admin/relatorios/csv");
    expect(adm.status()).toBe(200);
    const csvAdm = await adm.text();
    expect(csvAdm).toMatch(/^Vouchers;Código/m);
    expect(csvAdm).toContain(DADOS.cidadePequena);
    expect(csvAdm).not.toContain(DADOS.nome);
    expect(csvAdm).not.toContain(DADOS.contato);
  });

  test("rotas de relatório e de evidência respondem com Cache-Control private, no-store", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    const rotas = [
      "/admin/relatorios",
      "/admin/relatorios?versao=divulgacao",
      "/admin/relatorios?inicio=2026-01-01&fim=2026-06-30",
      "/admin/relatorios/csv",
      "/admin/relatorios/csv?versao=divulgacao",
      "/admin/relatorios/minuta",
      "/admin/evidencias",
      `/admin/evidencias/${ids.evidencia}`,
      `/admin/evidencias/${ids.evidencia}/arquivos/${ids.anexo}`,
    ];
    const linhas: string[] = [];
    for (const rota of rotas) {
      const r = await pedir(page, PALMEIROPOLIS, rota, { maxRedirects: 0 });
      linhas.push(`${r.status()} ${rota} -> ${r.headers()["cache-control"]}`);
      expect([200, 303]).toContain(r.status());
      semCache(r.headers()["cache-control"]);
    }
    // Sem sessão: CSV recusado e página redirecionada ao login, também sem cache
    await page.context().clearCookies();
    for (const rota of ["/admin/relatorios/csv?versao=divulgacao", "/admin/relatorios"]) {
      const r = await pedir(page, PALMEIROPOLIS, rota, { maxRedirects: 0 });
      linhas.push(`${r.status()} ${rota} (sem sessão) -> ${r.headers()["cache-control"]}`);
      expect([403, 307]).toContain(r.status());
      semCache(r.headers()["cache-control"]);
    }
    console.log(linhas.join("\n"));
  });

  test("minuta sem assinatura simulada, com campos em branco, evidências e seções do responsável", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Relatórios" }).click();
    await page.getByRole("link", { name: /Minuta do relatório de implantação/ }).click();
    const doc = page.getByRole("article", { name: "Minuta do relatório de implantação" });
    await expect(doc.getByRole("heading", { level: 1, name: "Minuta do relatório de implantação" })).toBeVisible();
    await expect(doc.getByRole("note")).toContainText("Não substitui a análise do órgão estadual competente");
    await expect(doc).toContainText(DADOS.evidenciaEditada);
    await expect(doc).toContainText("Lista de presença (Lista de presença da oficina)");
    await expect(doc).toContainText(DADOS.atividade);
    await expect(doc).toContainText("[A preencher pelo responsável:");
    await expect(doc.locator("[data-campo-em-branco]")).toHaveCount(8);
    await expect(doc.getByRole("img", { name: DADOS.legendaFoto })).toBeVisible();

    const texto = await doc.innerText();
    for (const proibido of [/assinado (digital|eletronic)|assinatura (digital|eletrônica)|assinado por/i, /conselho|aprovad|aprovação|homologad/i,
      /diário oficial|publicação oficial/i, /pontua|garant|assegur/i]) {
      expect(texto).not.toMatch(proibido);
    }
    expect(texto).not.toContain("[DEV] Gestor de Palmeirópolis");
    expect(texto).not.toContain(DADOS.nome);

    await page.getByRole("textbox", { name: "Análise" }).fill(DADOS.analise);
    await page.getByRole("button", { name: "Salvar seções" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Seções salvas" })).toBeVisible();
    await expect(doc.getByRole("region", { name: "8. Análise" })).toContainText(DADOS.analise);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Salvar seções" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Navegação do painel" })).toBeHidden();
    await expect(doc).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  test("gestor de Peixe não obtém relatório nem evidência de Palmeirópolis", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPeixe);
    await expect(page.getByRole("heading", { name: "Sem acesso a este painel" })).toBeVisible();
    for (const rota of ["/admin/relatorios", "/admin/relatorios/minuta", "/admin/evidencias", `/admin/evidencias/${ids.evidencia}`]) {
      await page.goto(`${PALMEIROPOLIS}${rota}`);
      await expect(page.getByRole("heading", { name: "Sem acesso a este painel" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(DADOS.evidenciaEditada);
      await expect(page.locator("body")).not.toContainText(DADOS.atividade);
    }
    const csv = await pedir(page, PALMEIROPOLIS, "/admin/relatorios/csv?versao=divulgacao");
    expect(csv.status()).toBe(403);
    expect(await csv.text()).not.toContain("Gurupi");
    const arquivo = await pedir(page, PALMEIROPOLIS, `/admin/evidencias/${ids.evidencia}/arquivos/${ids.anexo}`, { maxRedirects: 0 });
    expect(arquivo.status()).toBe(404);

    // No próprio município (Peixe), o id de Palmeirópolis não existe
    await page.goto(`${PALMEIROPOLIS}/admin/mais`);
    await page.getByRole("button", { name: "Sair" }).first().click();
    await entrar(page, PEIXE, USUARIOS_DEV.gestorPeixe);
    const resp = await page.goto(`${PEIXE}/admin/evidencias/${ids.evidencia}`);
    expect(resp?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(DADOS.evidenciaEditada);
    const arqPeixe = await pedir(page, PEIXE, `/admin/evidencias/${ids.evidencia}/arquivos/${ids.anexo}`, { maxRedirects: 0 });
    expect(arqPeixe.status()).toBe(404);
    const csvPeixe = await (await pedir(page, PEIXE, "/admin/relatorios/csv")).text();
    expect(csvPeixe).toContain("Relatório de vouchers e registros;Peixe");
    expect(csvPeixe).not.toContain(DADOS.atividade);
    expect(csvPeixe).not.toContain("Gurupi/TO");
    await page.goto(`${PEIXE}/admin/evidencias`);
    await expect(page.locator("body")).not.toContainText(DADOS.evidenciaEditada);
  });

  test("axe: nenhuma violação crítica ou séria em relatórios, evidências e minuta", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    const resumo: string[] = [];
    for (const rota of [
      "/admin/relatorios",
      "/admin/relatorios?versao=divulgacao",
      "/admin/relatorios/minuta",
      "/admin/evidencias",
      "/admin/evidencias/nova",
      `/admin/evidencias/${ids.evidencia}`,
    ]) {
      await page.goto(`${PALMEIROPOLIS}${rota}`);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const graves = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      resumo.push(`${rota}: ${r.passes.length} regras ok, ${graves.length} graves`);
      expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
    console.log(resumo.join("\n"));
  });
});
