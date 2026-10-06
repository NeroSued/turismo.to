import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";
import { sql } from "./alvo";

// Fase 7.1 e 7.2, no servidor com a sessão compartilhada ligada (*.turismo.test, como
// *.turismo.to em produção). O cookie de sessão vale em todos os subdomínios; a autorização
// continua sendo o vínculo com o município de cada página e operação.

const RAIZ = "turismo.test:3100";
const url = (slug: string, caminho = "") => `http://${slug}.${RAIZ}${caminho}`;
const SEM_PERMISSAO = "Sua conta não tem permissão para esta ação neste município.";

async function entrar(page: Page, slug: string, email: string) {
  await page.goto(url(slug, "/admin/login"));
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

/** Nomes, domínios e prazos dos cookies de sessão (nunca o valor). */
async function cookiesDeSessao(page: Page) {
  return (await page.context().cookies())
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => ({ nome: c.name.replace(/\.\d+$/, ""), dominio: c.domain }));
}

test.describe("sessão compartilhada entre municípios", () => {
  test("admin troca de município sem novo login, e sair desconecta todos", async ({ page }) => {
    await entrar(page, "palmeiropolis", USUARIOS_DEV.admin);
    await expect(page.getByText("Painel · Assessoria")).toBeVisible();
    // Cookie de sessão no domínio pai, com o nome próprio da sessão compartilhada.
    const cookies = await cookiesDeSessao(page);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.every((c) => c.dominio === ".turismo.test" && c.nome === "sb-turismo-sessao")).toBe(true);
    console.log(`cookies de sessão: ${JSON.stringify([...new Set(cookies.map((c) => `${c.nome} @ ${c.dominio}`))])}`);

    // Seletor (tela "Assessoria · trocar município"): admin vê os 7 municípios.
    await page.getByRole("button", { name: "Trocar de município" }).click();
    const dialogo = page.getByRole("dialog", { name: "Trocar de município" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText("Você continua conectado.")).toBeVisible();
    const links = dialogo.getByRole("navigation", { name: "Municípios" }).getByRole("link");
    await expect(links).toHaveCount(7);
    await expect(dialogo.getByRole("link", { name: /Palmeirópolis/ })).toHaveAttribute("aria-current", "page");
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => v.id)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();

    await page.getByRole("button", { name: "Trocar de município" }).click();
    await dialogo.getByRole("link", { name: /^Peixe/ }).click();
    await expect(page).toHaveURL(url("peixe", "/admin"));
    await expect(page.getByRole("button", { name: "Trocar de município" })).toContainText("Peixe");
    await expect(page.getByText("Painel · Assessoria")).toBeVisible();
    await expect(page.getByLabel("Senha")).toHaveCount(0);

    // Outro endereço, digitado direto: continua conectado.
    await page.goto(url("arraias", "/admin/assessoria"));
    await expect(page.getByRole("heading", { level: 1, name: "Assessoria" })).toBeVisible();

    // Sair em Arraias encerra a sessão em todos os municípios.
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(url("arraias", "/admin/login"));
    for (const slug of ["palmeiropolis", "peixe", "arraias"]) {
      await page.goto(url(slug, "/admin"));
      await expect(page).toHaveURL(url(slug, "/admin/login"));
    }
    expect(await cookiesDeSessao(page)).toEqual([]);
    console.log("depois de sair: 0 cookies de sessão; /admin de palmeiropolis, peixe e arraias pede login");
  });

  test("gestor de Peixe com sessão compartilhada continua sem acesso a Palmeirópolis", async ({ page }) => {
    await entrar(page, "peixe", USUARIOS_DEV.gestorPeixe);
    await expect(page.getByText("Painel · Gestor")).toBeVisible();
    // Um vínculo só: sem seletor.
    await expect(page.getByRole("button", { name: "Trocar de município" })).toHaveCount(0);

    // A sessão chega a Palmeirópolis (mesmo cookie), mas o vínculo não existe: sem acesso.
    for (const caminho of ["/admin", "/admin/atrativos", "/admin/relatorios", "/admin/configuracoes"]) {
      await page.goto(url("palmeiropolis", caminho));
      await expect(page.getByRole("heading", { level: 1, name: "Sem acesso a este painel" })).toBeVisible();
    }
    const relatorio = await page.goto(url("palmeiropolis", "/admin/relatorios/csv"));
    expect(relatorio?.status()).toBe(403);

    // Operação: a action "Criar atrativo", capturada no painel de Peixe, reenviada em Palmeirópolis.
    const nome = `[E2E] Invasão ${Date.now()}`;
    await page.goto(url("peixe", "/admin/atrativos/novo"));
    let capturada: { acao: string; tipo: string; corpo: string } | undefined;
    await page.route("**/admin/atrativos/novo", async (rota) => {
      const req = rota.request();
      if (req.method() !== "POST") return rota.continue();
      capturada = { acao: req.headers()["next-action"], tipo: req.headers()["content-type"], corpo: req.postData() ?? "" };
      await rota.abort();
    });
    await page.getByLabel("Nome do atrativo").fill(nome);
    await page.getByLabel("Categoria").selectOption("natureza");
    await page.getByRole("button", { name: "Criar atrativo" }).click();
    await expect.poll(() => Boolean(capturada)).toBe(true);
    await page.unrouteAll();

    await page.goto(url("palmeiropolis", "/"));
    const resposta = await page.evaluate(
      async ({ acao, tipo, corpo }) =>
        (await fetch("/admin/atrativos/novo", { method: "POST", headers: { "next-action": acao, "content-type": tipo, accept: "text/x-component" }, body: corpo })).text(),
      capturada!,
    );
    expect(resposta).toContain(SEM_PERMISSAO);
    expect(sql(`select count(*) from public.atrativos where nome = '${nome}'`)).toBe("0");
    console.log("action reenviada em Palmeirópolis com a sessão do gestor de Peixe: sem permissão; 0 atrativos criados");
  });

  test("quem tem mais de um vínculo vê só os seus municípios no seletor", async ({ page }) => {
    // Operador de Palmeirópolis ganha um segundo vínculo (Peixe) só durante o teste.
    const usuario = sql(`select id from auth.users where email = '${USUARIOS_DEV.operadorPalmeiropolis}'`);
    const peixe = sql("select id from public.municipios where slug = 'peixe'");
    sql(`insert into public.vinculos (user_id, municipio_id, papel) values ('${usuario}', '${peixe}', 'operador')
         on conflict (user_id, municipio_id) do update set ativo = true, papel = 'operador'`);
    try {
      await entrar(page, "palmeiropolis", USUARIOS_DEV.operadorPalmeiropolis);
      await page.getByRole("button", { name: "Trocar de município" }).click();
      const links = page.getByRole("dialog", { name: "Trocar de município" }).getByRole("navigation", { name: "Municípios" }).getByRole("link");
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toContainText("Palmeirópolis");
      await expect(links.nth(1)).toContainText("Peixe");
      await expect(page.getByRole("link", { name: /Painel da assessoria/ })).toHaveCount(0);
      await links.nth(1).click();
      await expect(page).toHaveURL(url("peixe", "/admin/atendimento"));
      await expect(page.getByText("Painel · Operador")).toBeVisible();
    } finally {
      sql(`delete from public.vinculos where user_id = '${usuario}' and municipio_id = '${peixe}'`);
    }
  });

  test("sem a variável (local e preview) o cookie continua preso ao endereço", async ({ page }) => {
    await page.goto("http://palmeiropolis.localhost:3000/admin/login");
    await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const locais = (await page.context().cookies("http://palmeiropolis.localhost:3000")).filter((c) => c.name.startsWith("sb-"));
    expect(locais.length).toBeGreaterThan(0);
    expect(locais.every((c) => c.domain === "palmeiropolis.localhost" && !c.name.startsWith("sb-turismo-sessao"))).toBe(true);
    await page.goto("http://peixe.localhost:3000/admin");
    await expect(page).toHaveURL("http://peixe.localhost:3000/admin/login");
  });
});
