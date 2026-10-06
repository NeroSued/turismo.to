import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";
import { site } from "./alvo";

// Fase 8 no celular (390x844): aviso flutuante do painel. Sucesso visível sem rolar e acima da barra
// inferior, some em ~3 s e pausa com o foco; erro fica até fechar e marca o campo; aviso depois de
// redirecionar; duplo clique gera um único envio; axe sem violações críticas ou sérias.

const PALMEIROPOLIS = site("palmeiropolis");
const SUF = randomBytes(3).toString("hex");
const NOME = `[E2E] Mirante dos avisos ${SUF}`;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
let edicao = "";

async function entrar(page: Page) {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPalmeiropolis);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A pílula de sucesso (dentro da região status) ou de erro (dentro da região alert). */
function aviso(page: Page, tipo: "sucesso" | "erro", texto: string | RegExp): Locator {
  return page.locator(`[data-aviso="${tipo}"]`).filter({ hasText: texto });
}

/** Sem violações críticas ou sérias do axe na página atual. */
async function semViolacoesGraves(page: Page, onde: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const graves = r.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  console.log(`axe · ${onde}: ${r.passes.length} regras ok, ${graves.length} graves, ${r.violations.length - graves.length} menores`);
  expect(graves, onde).toEqual([]);
}

/** O aviso está inteiro na tela, acima da barra de navegação inferior. */
async function acimaDaBarra(page: Page, pilula: Locator) {
  await expect(pilula).toBeInViewport({ ratio: 1 });
  const caixa = (await pilula.boundingBox())!;
  const barra = (await page.getByRole("navigation", { name: "Navegação do painel" }).boundingBox())!;
  expect(caixa.y + caixa.height, "aviso acima da barra inferior").toBeLessThanOrEqual(barra.y);
  const centro = caixa.x + caixa.width / 2;
  expect(Math.abs(centro - 390 / 2), "centralizado no celular").toBeLessThan(2);
}

test.describe.configure({ mode: "serial" });

test.describe("avisos flutuantes do painel", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("criar mostra o aviso depois do redirecionamento e a tela de criação avisa das fotos", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}/admin/atrativos/novo`);
    await expect(page.getByText("Depois de salvar, você poderá adicionar fotos.")).toBeVisible();
    await page.getByLabel("Nome do atrativo").fill(NOME);
    await page.getByLabel("Categoria").selectOption("natureza");
    await page.getByRole("button", { name: "Criar atrativo" }).click();
    await expect(page).toHaveURL(/\/admin\/atrativos\/[0-9a-f-]{36}$/);
    edicao = new URL(page.url()).pathname;
    const pilula = aviso(page, "sucesso", "Atrativo criado em elaboração.");
    await expect(pilula).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Atrativo criado em elaboração." })).toHaveAttribute("aria-live", "polite");
    await acimaDaBarra(page, pilula);
    // O parâmetro saiu da URL: recarregar não repete o aviso.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: NOME })).toBeVisible();
    await expect(aviso(page, "sucesso", "Atrativo criado")).toHaveCount(0);

    for (const [tela, titulo] of [
      ["atividades/nova", "Nova atividade"],
      ["eventos/novo", "Novo evento"],
      ["prestadores/novo", "Novo prestador"],
    ]) {
      await page.goto(`${PALMEIROPOLIS}/admin/${tela}`);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await expect(page.getByText("Depois de salvar, você poderá adicionar fotos.")).toBeVisible();
    }
  });

  test("salvar no fim do formulário mostra o aviso sem rolar, e ele some em cerca de 3 segundos", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    const salvar = page.getByRole("button", { name: "Salvar alterações" });
    await salvar.scrollIntoViewIfNeeded();
    const rolagem = await page.evaluate(() => window.scrollY);
    expect(rolagem, "o botão fica abaixo da primeira tela").toBeGreaterThan(0);
    await page.getByLabel("Horários de visitação").fill("Todos os dias, das 8h às 17h.");
    await salvar.click();

    const pilula = aviso(page, "sucesso", "Alterações salvas.");
    await expect(pilula).toBeVisible();
    const apareceu = Date.now();
    expect(await page.evaluate(() => window.scrollY), "a tela não rolou").toBe(rolagem);
    await acimaDaBarra(page, pilula);
    await expect(pilula.getByRole("button", { name: "Fechar aviso" })).toHaveCSS("height", "44px");
    await expect(pilula).toHaveCSS("background-color", "rgb(22, 33, 27)");
    await semViolacoesGraves(page, "edição do atrativo com aviso de sucesso");

    await expect(pilula).toBeHidden({ timeout: 6_000 });
    const durou = Date.now() - apareceu;
    console.log(`aviso de sucesso ficou ${durou} ms na tela`);
    expect(durou).toBeGreaterThan(2_400);
    expect(durou).toBeLessThan(4_500);
  });

  test("o tempo pausa enquanto o aviso tem o foco do teclado", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    const pilula = aviso(page, "sucesso", "Alterações salvas.");
    await expect(pilula).toBeVisible();
    await pilula.getByRole("button", { name: "Fechar aviso" }).focus();
    await expect(pilula).toHaveAttribute("data-pausado", "");
    await page.waitForTimeout(4_500);
    await expect(pilula, "com foco, não some").toBeVisible();
    // Saiu o foco: volta a contar e some.
    await page.getByLabel("Nome do atrativo").focus();
    await expect(pilula).not.toHaveAttribute("data-pausado", "");
    await expect(pilula).toBeHidden({ timeout: 6_000 });
  });

  test("erro fica até fechar, marca o campo e leva o foco a ele", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    const latitude = page.getByLabel("Latitude");
    await latitude.fill("200");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    const pilula = aviso(page, "erro", /./);
    await expect(pilula).toBeVisible();
    await expect(page.getByRole("alert").filter({ has: pilula })).toHaveCount(1);
    await expect(latitude).toHaveAttribute("aria-invalid", "true");
    await expect(latitude).toBeFocused();
    // O campo focado fica à vista, acima do aviso e da barra inferior (foco não encoberto).
    const campo = (await latitude.boundingBox())!;
    const caixaAviso = (await pilula.boundingBox())!;
    expect(campo.y + campo.height, "campo acima do aviso").toBeLessThanOrEqual(caixaAviso.y);
    await expect(page.locator("#latitude-erro")).toContainText("Latitude");
    await semViolacoesGraves(page, "edição do atrativo com aviso de erro");

    await page.waitForTimeout(5_000);
    await expect(pilula, "erro não some sozinho").toBeVisible();
    await expect(latitude, "o campo continua marcado").toHaveAttribute("aria-invalid", "true");
    await pilula.getByRole("button", { name: "Fechar aviso" }).click();
    await expect(pilula).toBeHidden();
    await expect(latitude, "fechar o aviso não apaga o erro do campo").toHaveAttribute("aria-invalid", "true");
  });

  test("duplo clique em salvar gera um único envio", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    await page.getByLabel("Latitude").fill("");
    // Conta os envios da action e segura cada um por 1,5 s, para o estado "Salvando…" ficar visível.
    let envios = 0;
    await page.route("**/*", async (rota) => {
      const r = rota.request();
      if (r.method() === "POST" && r.headers()["next-action"]) {
        envios += 1;
        await new Promise((ok) => setTimeout(ok, 1_500));
      }
      await rota.continue();
    });
    const salvar = page.getByRole("button", { name: "Salvar alterações" });
    await salvar.dblclick();
    await expect(page.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    await expect(aviso(page, "sucesso", "Alterações salvas.")).toBeVisible();
    await expect(salvar).toBeEnabled();
    await page.waitForTimeout(1_000);
    console.log(`duplo clique: ${envios} envio(s) ao servidor`);
    expect(envios).toBe(1);
  });

  test("publicar mostra o aviso e o botão fica desativado durante o envio", async ({ page }) => {
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    const publicar = page.getByRole("button", { name: "Publicar no portal" });
    await publicar.dblclick();
    await expect(aviso(page, "sucesso", "Publicado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Voltar para elaboração" })).toBeVisible();
  });

  test("a partir de 768px o aviso fica no canto inferior direito", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    const pilula = aviso(page, "sucesso", "Alterações salvas.");
    await expect(pilula).toBeInViewport({ ratio: 1 });
    const caixa = (await pilula.boundingBox())!;
    const barra = (await page.getByRole("navigation", { name: "Navegação do painel" }).boundingBox())!;
    expect(1024 - (caixa.x + caixa.width), "encostado à direita, com margem").toBeLessThanOrEqual(32);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(barra.y);
  });

  test("sem animação quando o sistema pede movimento reduzido", async ({ browser }) => {
    const contexto = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      locale: "pt-BR",
      timezoneId: "America/Araguaina",
      reducedMotion: "reduce",
    });
    const page = await contexto.newPage();
    await entrar(page);
    await page.goto(`${PALMEIROPOLIS}${edicao}`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    const pilula = aviso(page, "sucesso", "Alterações salvas.");
    await expect(pilula).toBeVisible();
    expect(await pilula.evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
    await expect(pilula.locator(".aviso-progresso")).toBeHidden();
    // Sem a barra, o tempo continua: some sozinho.
    await expect(pilula).toBeHidden({ timeout: 6_000 });
    await contexto.close();
  });
});
