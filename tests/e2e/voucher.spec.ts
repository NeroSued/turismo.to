import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";

// Fluxo de ponta a ponta da Fase 1, no celular (390x844, do playwright.config.ts):
// gestor cria e publica atividade com horário; visitante reserva; operador confirma;
// relatório mostra o voucher utilizado com a quantidade atendida.

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const TITULO = `[E2E] Trilha guiada ${randomBytes(3).toString("hex")}`;
let codigoReservado = "";

/** Dia e horários locais (America/Araguaina) para uma sessão que começa daqui a alguns minutos, hoje. */
function horarioDeHoje() {
  const agora = new Date(Date.now() + 10 * 60_000);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const p = (t: string) => partes.find((x) => x.type === t)!.value;
  const [h, m] = [Number(p("hour")), Number(p("minute"))];
  const fimMin = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  const hh = (n: number) => String(n).padStart(2, "0");
  return {
    dia: `${p("year")}-${p("month")}-${p("day")}`,
    inicio: `${hh(h)}:${hh(m)}`,
    fim: `${hh(Math.floor(fimMin / 60))}:${hh(fimMin % 60)}`,
  };
}

async function entrar(page: Page, email: string) {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

test.describe.serial("voucher de ponta a ponta no celular", () => {
  test("gestor cria e publica uma atividade com horário e vagas", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Conteúdo" }).click();
    await page.getByRole("link", { name: "Nova atividade" }).click();

    await page.getByLabel("Reserva gratuita").check();
    await page.getByLabel("Nome da atividade").fill(TITULO);
    await page.getByLabel("Local ou ponto de encontro").fill("[Ponto de encontro de teste]");
    await page.getByLabel("Máximo de pessoas por voucher").fill("6");
    await page.getByRole("button", { name: "Criar atividade" }).click();

    await expect(page.getByRole("heading", { level: 1, name: TITULO })).toBeVisible();
    await expect(page.getByText("Em elaboração").first()).toBeVisible();

    const h = horarioDeHoje();
    await page.getByLabel("Data").fill(h.dia);
    await page.getByLabel("Início").fill(h.inicio);
    await page.getByLabel("Término").fill(h.fim);
    await page.getByLabel("Vagas (pessoas)").fill("15");
    await page.getByRole("button", { name: "Adicionar horário" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Horário adicionado." })).toBeVisible();
    await expect(page.getByText("0 de 15 vagas reservadas")).toBeVisible();

    await page.getByRole("button", { name: "Publicar no portal" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Atividade publicada" })).toBeVisible();
    await expect(page.getByText("Publicada").first()).toBeVisible();
  });

  test("gestor edita atividade, altera vagas e arquiva", async ({ page }) => {
    const titulo = `[E2E] Para arquivar ${randomBytes(3).toString("hex")}`;
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    await page.goto(`${PALMEIROPOLIS}/admin/atividades/nova`);
    await page.getByLabel("Nome da atividade").fill(titulo);
    await page.getByRole("button", { name: "Criar atividade" }).click();
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();

    const h = horarioDeHoje();
    await page.getByLabel("Data").fill(h.dia);
    await page.getByLabel("Início").fill(h.inicio);
    await page.getByLabel("Término").fill(h.fim);
    await page.getByRole("button", { name: "Adicionar horário" }).click();
    await expect(page.getByText("sem limite de vagas")).toBeVisible();
    await page.getByLabel(/^Vagas de /).fill("8");
    await page.getByRole("button", { name: "Salvar vagas" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Vagas atualizadas." })).toBeVisible();
    await page.reload();
    await expect(page.getByText("0 de 8 vagas reservadas")).toBeVisible();

    await page.getByLabel("Pedir nome do responsável pelo grupo").check();
    await page.getByLabel("Condições da atividade").fill("Levar água.");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alterações salvas." })).toBeVisible();

    await page.getByRole("button", { name: "Arquivar atividade" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Atividade arquivada" })).toBeVisible();
    await page.goto(PALMEIROPOLIS);
    await expect(page.getByText(titulo)).toHaveCount(0);
  });

  test("visitante reserva no portal e recebe o comprovante com QR, salvar, imprimir e link para cancelar", async ({ page }) => {
    await page.goto(PALMEIROPOLIS);
    await page.getByRole("link", { name: TITULO }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Reserva gratuita" })).toBeVisible();
    await expect(page.getByText("Restam 15 vagas neste horário.")).toBeVisible();

    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await expect(page.getByRole("status", { name: "Pessoas" })).toContainText("3");
    await page.getByLabel("Cidade").fill("Gurupi");
    await page.getByLabel("UF").selectOption("TO");
    await page.getByRole("button", { name: "Emitir voucher gratuito" }).click();

    await expect(page).toHaveURL(/\/voucher\/[0-9a-f]{64}$/);
    await expect(page.getByRole("status").filter({ hasText: "Voucher emitido. Guarde este comprovante." })).toBeVisible();
    const cartao = page.getByRole("article", { name: "Voucher turístico" });
    await expect(cartao.getByText("Palmeirópolis · TO")).toBeVisible();
    await expect(cartao.getByText("Gratuito", { exact: true })).toBeVisible();
    await expect(cartao.getByText(TITULO)).toBeVisible();
    await expect(cartao.getByText("Gurupi/TO")).toBeVisible();
    await expect(cartao.locator("dd").filter({ hasText: /^3$/ })).toBeVisible();
    codigoReservado = (await page.getByTestId("codigo-voucher").innerText()).trim();
    expect(codigoReservado).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    await expect(page.getByRole("img", { name: `QR Code do voucher ${codigoReservado}` })).toBeVisible();

    // Página do token: privada, sem cache e sem referrer.
    const resposta = await page.reload();
    expect(resposta?.headers()["cache-control"]).toContain("no-store");
    expect(resposta?.headers()["referrer-policy"]).toBe("no-referrer");

    // Salvar: PNG do comprovante (buscado pelo navegador, que resolve *.localhost).
    const href = await page.getByRole("link", { name: "Salvar" }).getAttribute("href");
    const png = await page.evaluate(async (u) => {
      const r = await fetch(u!);
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, tipo: r.headers.get("content-type"), cache: r.headers.get("cache-control"), assinatura: Array.from(bytes.slice(1, 4)) };
    }, href);
    expect(png.status).toBe(200);
    expect(png.tipo).toBe("image/png");
    expect(png.cache).toContain("no-store");
    expect(String.fromCharCode(...png.assinatura)).toBe("PNG");

    // Imprimir: na mídia de impressão, botões e link de cancelamento somem; o cartão fica.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Não vou mais: liberar minhas vagas" })).toBeHidden();
    await expect(cartao).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  });

  test("visitante cancela pelo link e as vagas voltam; token errado não revela nada", async ({ page }) => {
    await page.goto(PALMEIROPOLIS);
    await page.getByRole("link", { name: TITULO }).click();
    await expect(page.getByText("Restam 12 vagas neste horário.")).toBeVisible();
    await page.getByLabel("Cidade").fill("Palmas");
    await page.getByRole("button", { name: "Emitir voucher gratuito" }).click();
    await expect(page).toHaveURL(/\/voucher\/[0-9a-f]{64}$/);
    const urlVoucher = page.url();

    await page.getByRole("button", { name: "Não vou mais: liberar minhas vagas" }).click();
    await page.getByRole("button", { name: "Cancelar voucher" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Voucher cancelado" })).toBeVisible();
    await page.goto(urlVoucher);
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();

    await page.goto(PALMEIROPOLIS);
    await page.getByRole("link", { name: TITULO }).click();
    await expect(page.getByText("Restam 12 vagas neste horário.")).toBeVisible();

    await page.goto(`${PALMEIROPOLIS}/voucher/${"f".repeat(64)}`);
    await expect(page.getByRole("heading", { name: "Voucher não encontrado" })).toBeVisible();
    await page.goto(`${PALMEIROPOLIS}/voucher/qualquer-coisa`);
    await expect(page.getByRole("heading", { name: "Voucher não encontrado" })).toBeVisible();
  });
});
