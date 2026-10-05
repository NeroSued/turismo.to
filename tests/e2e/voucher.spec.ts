import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";

// Fluxo de ponta a ponta da Fase 1, no celular (390x844, do playwright.config.ts):
// gestor cria e publica atividade com horário; visitante reserva; operador confirma;
// relatório mostra o voucher utilizado com a quantidade atendida.

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const TITULO = `[E2E] Trilha guiada ${randomBytes(3).toString("hex")}`;

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
});
