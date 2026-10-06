import { expect, test } from "@playwright/test";

const RAIZ = process.env.FUMACA_RAIZ ?? "turismo.to";
const HUB = `https://${RAIZ}`;
const PALMEIROPOLIS = `https://palmeiropolis.${RAIZ}`;

test("hub abre com os sete municípios", async ({ page }) => {
  const r = await page.goto(`${HUB}/`);
  expect(r?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turismo nos municípios participantes");
  const nav = page.getByRole("navigation", { name: "Municípios" });
  await expect(nav.getByRole("link")).toHaveCount(7);
  await expect(nav.getByRole("link", { name: /Palmeirópolis/ })).toHaveAttribute("href", `${PALMEIROPOLIS}/`);
  await expect(page.getByText(/\[(DEV|TESTE|E2E)\]/)).toHaveCount(0);
});

test("portal de Palmeirópolis abre pelo subdomínio, com SSL", async ({ page }) => {
  const r = await page.goto(`${PALMEIROPOLIS}/`);
  expect(r?.status()).toBe(200);
  expect(page.url()).toBe(`${PALMEIROPOLIS}/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Palmeirópolis");
  await expect(page).toHaveTitle(/Turismo em Palmeirópolis/);
  await expect(page.getByText(/\[(DEV|TESTE|E2E)\]/)).toHaveCount(0);
});

test("/admin pede login e não entra em cache", async ({ page }) => {
  const r = await page.goto(`${PALMEIROPOLIS}/admin`);
  await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/login`);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(r?.headers()["cache-control"] ?? "").toContain("no-store");
});

test("subdomínio inexistente responde 404 e ?municipio= é ignorado", async ({ page, request }) => {
  const r = await page.goto(`https://naoexiste.${RAIZ}/`);
  expect(r?.status()).toBe(404);
  await page.goto(`${HUB}/?municipio=palmeiropolis`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turismo nos municípios participantes");
  const cron = await request.get(`${HUB}/api/cron/manter-ativo`);
  expect(cron.status()).toBe(401);
});
