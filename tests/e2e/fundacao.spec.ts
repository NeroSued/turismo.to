import { expect, test, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";

const SETE = [
  "Ananás",
  "Arraias",
  "Jaú do Tocantins",
  "Palmeirópolis",
  "Paranã",
  "Peixe",
  "São Salvador do Tocantins",
];

async function entrar(page: Page, base: string, email: string) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("o hub lista os sete municípios", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turismo nos municípios participantes");
  const nav = page.getByRole("navigation", { name: "Municípios" });
  for (const nome of SETE) await expect(nav.getByText(nome, { exact: true })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(7);
  await expect(nav.getByRole("link", { name: /Palmeirópolis/ })).toHaveAttribute(
    "href",
    "http://palmeiropolis.localhost:3000/",
  );
});

test("palmeiropolis.localhost:3000 abre o portal do município", async ({ page }) => {
  await page.goto(PALMEIROPOLIS);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Palmeirópolis");
  await expect(page).toHaveTitle(/Turismo em Palmeirópolis/);
});

test("slug inexistente responde 404", async ({ page }) => {
  const r = await page.goto("http://naoexiste.localhost:3000/");
  expect(r?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("a árvore interna /m/<slug> não é acessível diretamente", async ({ page }) => {
  const r = await page.goto("/m/palmeiropolis");
  expect(r?.status()).toBe(404);
});

test("?municipio= é ignorado quando ALLOW_TENANT_OVERRIDE não está ativa", async ({ page }) => {
  await page.goto("/?municipio=peixe");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turismo nos municípios participantes");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "municipio_selecionado")).toBeUndefined();
});

test("/admin sem login redireciona para o login, sem cache", async ({ page }) => {
  const r = await page.goto(`${PALMEIROPOLIS}/admin`);
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/login`);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  const cache = r?.headers()["cache-control"] ?? "";
  expect(cache).toContain("private");
  expect(cache).toContain("no-store");
});

test("não existe cadastro público", async ({ page }) => {
  for (const caminho of ["/admin/cadastro", "/admin/registrar", "/cadastro"]) {
    const r = await page.goto(`${PALMEIROPOLIS}${caminho}`);
    expect(r?.status(), caminho).toBe(404);
  }
});

test("senha errada mostra erro claro", async ({ page }) => {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPalmeiropolis);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  // filter: o Next também renderiza um anunciador de rota com role="alert".
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible();
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/login`);
});

test("gestor de Palmeirópolis entra no painel do seu município e sai", async ({ page }) => {
  await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin`);
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByText("Painel · Gestor")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/login`);
  await page.goto(`${PALMEIROPOLIS}/admin`);
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/login`);
});

test("gestor de Peixe logado em Palmeirópolis recebe sem acesso", async ({ page }) => {
  await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPeixe);
  await expect(page.getByRole("heading", { name: "Sem acesso a este painel" })).toBeVisible();
  await expect(page.getByText("Visão geral")).toHaveCount(0);
});

test("recuperação de senha responde igual para conta existente e inexistente", async ({ page }) => {
  for (const email of [USUARIOS_DEV.operadorPalmeiropolis, "ninguem@exemplo.test"]) {
    await page.goto(`${PALMEIROPOLIS}/admin/recuperar`);
    await page.getByLabel("E-mail da sua conta").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");
  }
});
