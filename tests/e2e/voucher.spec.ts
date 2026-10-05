import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { USUARIOS_DEV } from "../ambiente";
import { ARQUIVO_CAMERA, gravarCamera } from "./camera";

// Fluxo de ponta a ponta da Fase 1, no celular (390x844, do playwright.config.ts):
// gestor cria e publica atividade com horário; visitante reserva; operador confirma;
// relatório mostra o voucher utilizado com a quantidade atendida.

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const TITULO = `[E2E] Trilha guiada ${randomBytes(3).toString("hex")}`;
let codigoReservado = "";
let codigoCancelado = "";
let codigoExpirado = "";
let codigoAssistido = "";

// Câmera falsa para o leitor de QR do operador (ver camera.ts).
gravarCamera(null);
test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${ARQUIVO_CAMERA}`],
  },
});

/** Só no banco LOCAL (D11): marca um voucher como expirado, simulando o fim do prazo. */
function expirarNoBancoLocal(codigo: string) {
  const c = codigo.replace(/-/g, "");
  if (!/^[2-9A-Z]{12}$/.test(c)) throw new Error("código inválido");
  execSync(
    `docker exec supabase_db_turismo-to psql -U postgres -q -c "update public.vouchers set status = 'expirado', expirado_em = now() where codigo = '${c}'"`,
    { stdio: "ignore" },
  );
}

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

/** Alerta da tela (o anunciador de rotas do Next também usa role="alert"). */
function alerta(page: Page, texto: string) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: texto });
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
    codigoCancelado = (await page.getByTestId("codigo-voucher").innerText()).trim();

    await page.getByRole("button", { name: "Não vou mais: liberar minhas vagas" }).click();
    await page.getByRole("button", { name: "Cancelar voucher" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Voucher cancelado" })).toBeVisible();
    await page.goto(urlVoucher);
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();

    await page.goto(PALMEIROPOLIS);
    await page.getByRole("link", { name: TITULO }).click();
    await expect(page.getByText("Restam 12 vagas neste horário.")).toBeVisible();

    // Um terceiro voucher, de 1 pessoa, que o banco local marca como expirado para o teste do operador.
    await page.getByLabel("Cidade").fill("Peixe");
    await page.getByRole("button", { name: "Emitir voucher gratuito" }).click();
    await expect(page).toHaveURL(/\/voucher\/[0-9a-f]{64}$/);
    codigoExpirado = (await page.getByTestId("codigo-voucher").innerText()).trim();
    expirarNoBancoLocal(codigoExpirado);

    await page.goto(`${PALMEIROPOLIS}/voucher/${"f".repeat(64)}`);
    await expect(page.getByRole("heading", { name: "Voucher não encontrado" })).toBeVisible();
    await page.goto(`${PALMEIROPOLIS}/voucher/qualquer-coisa`);
    await expect(page.getByRole("heading", { name: "Voucher não encontrado" })).toBeVisible();
  });

  test("operador lê o QR pela câmera, confere e confirma 2 de 3 pessoas; nova leitura dá já utilizado", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.operadorPalmeiropolis);
    await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/atendimento`);
    const nav = page.getByRole("navigation", { name: "Navegação do painel" });
    await expect(nav.getByRole("link")).toHaveText(["Atendimento", "Emitir voucher", "Mais"]);

    gravarCamera(codigoReservado);
    await page.getByRole("button", { name: "Ler QR Code com a câmera" }).click();
    await expect(page).toHaveURL(`${PALMEIROPOLIS}/admin/atendimento/${codigoReservado.replace(/-/g, "")}`, { timeout: 20_000 });

    await expect(page.getByText("Reservado · válido para hoje")).toBeVisible();
    await expect(page.getByRole("heading", { name: codigoReservado })).toBeVisible();
    await expect(page.getByText(TITULO)).toBeVisible();
    await expect(page.getByText("3 pessoas")).toBeVisible();
    await expect(page.getByText("Gurupi/TO")).toBeVisible();
    await page.getByRole("button", { name: "Diminuir pessoas atendidas" }).click();
    await page.getByRole("button", { name: "Confirmar participação" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Participação confirmada" })).toBeVisible();
    await expect(page.getByText("2 de 3")).toBeVisible();
    await expect(page.getByText("[DEV] Operador de Palmeirópolis")).toBeVisible();

    // Nova leitura (digitando) não conta de novo.
    await page.getByRole("link", { name: "Ler próximo voucher" }).click();
    await page.getByLabel("Ou digite o código").fill(codigoReservado.toLowerCase());
    await page.getByRole("button", { name: "Buscar" }).click();
    const jaUtilizado = alerta(page, "Voucher já utilizado");
    await expect(jaUtilizado).toBeVisible();
    await expect(jaUtilizado).toContainText("com 2 pessoas");
    await expect(jaUtilizado).toContainText("Nenhuma nova contagem foi registrada");
  });

  test("operador vê as telas de cancelado, expirado e código inexistente", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.operadorPalmeiropolis);
    for (const [codigo, titulo] of [
      [codigoCancelado, "Voucher cancelado"],
      [codigoExpirado, "Voucher expirado"],
      ["ZZZZ-ZZZZ-ZZZZ", "Código não encontrado"],
    ]) {
      await page.goto(`${PALMEIROPOLIS}/admin/atendimento`);
      await page.getByLabel("Ou digite o código").fill(codigo);
      await page.getByRole("button", { name: "Buscar" }).click();
      await expect(alerta(page, titulo)).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirmar participação" })).toHaveCount(0);
    }
    await page.goto(`${PALMEIROPOLIS}/admin/atendimento`);
    await page.getByLabel("Ou digite o código").fill("ABC");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Código inválido.")).toBeVisible();
  });

  test("gestor de Peixe recebe voucher de outro município, sem detalhes", async ({ page }) => {
    const PEIXE = "http://peixe.localhost:3000";
    await page.goto(`${PEIXE}/admin/login`);
    await page.getByLabel("E-mail").fill(USUARIOS_DEV.gestorPeixe);
    await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${PEIXE}/admin`);
    await page.goto(`${PEIXE}/admin/atendimento`);
    await page.getByLabel("Ou digite o código").fill(codigoCancelado);
    await page.getByRole("button", { name: "Buscar" }).click();
    const outro = alerta(page, "Voucher de outro município");
    await expect(outro).toBeVisible();
    await expect(outro).toContainText("não pertence a Peixe");
    await expect(page.getByText(TITULO)).toHaveCount(0);
  });

  test("operador emite voucher assistido para visitante sem celular e imprime o comprovante", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.operadorPalmeiropolis);
    await page.getByRole("link", { name: "Emitir voucher para visitante sem celular" }).click();
    await expect(page.getByRole("heading", { name: "Emitir voucher para visitante sem celular" })).toBeVisible();
    await page.getByRole("link", { name: TITULO }).click();
    await expect(page.getByRole("main").getByText("Emissão assistida")).toBeVisible();
    await expect(page.getByText("Restam 11 vagas neste horário.")).toBeVisible();
    await page.getByRole("button", { name: "Aumentar quantidade" }).click();
    await page.getByLabel("Cidade").fill("Arraias");
    await page.getByRole("button", { name: "Emitir voucher" }).click();

    await expect(page).toHaveURL(/\/admin\/vouchers\/[2-9A-HJKMNP-Z]{12}\?emitido=1$/);
    await expect(page.getByRole("status").filter({ hasText: "Voucher emitido. Imprima o comprovante" })).toBeVisible();
    const cartao = page.getByRole("article", { name: "Voucher turístico" });
    await expect(cartao.getByText("Arraias/TO")).toBeVisible();
    await expect(cartao.locator("dd").filter({ hasText: /^2$/ })).toBeVisible();
    codigoAssistido = (await page.getByTestId("codigo-voucher").innerText()).trim();
    await expect(page.getByRole("img", { name: `QR Code do voucher ${codigoAssistido}` })).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Navegação do painel" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
    await expect(cartao).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    // O voucher assistido é atendido como qualquer outro.
    await page.goto(`${PALMEIROPOLIS}/admin/atendimento`);
    await page.getByLabel("Ou digite o código").fill(codigoAssistido);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Confirmar participação" }).click();
    await expect(page.getByText("2 de 2")).toBeVisible();
  });

  test("relatório do gestor mostra o voucher utilizado com a quantidade atendida, sem confundir reserva com visita", async ({ page }) => {
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    await expect(page.getByRole("heading", { name: "Indicadores" })).toBeVisible();
    await expect(page.getByText("reservas feitas, não visitas")).toBeVisible();
    await expect(page.getByText(TITULO).first()).toBeVisible(); // seção "Hoje"

    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Relatórios" }).click();
    await expect(page.getByRole("heading", { name: "Relatório de vouchers" })).toBeVisible();

    const linha = page.locator(`li[data-codigo="${codigoReservado.replace(/-/g, "")}"]`);
    await expect(linha.getByText("Utilizado", { exact: true })).toBeVisible();
    await expect(linha).toContainText("3 reservadas · 2 atendidas");
    await expect(page.locator(`li[data-codigo="${codigoCancelado.replace(/-/g, "")}"]`).getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(page.locator(`li[data-codigo="${codigoExpirado.replace(/-/g, "")}"]`).getByText("Expirado", { exact: true })).toBeVisible();
    await expect(page.locator(`li[data-codigo="${codigoAssistido.replace(/-/g, "")}"]`)).toContainText("2 atendidas · emissão assistida");

    // Resumo da atividade: 4 vouchers (2 utilizados, 1 cancelado, 1 expirado); 6 pessoas reservadas; 4 participações.
    const atividade = page.locator("li").filter({ hasText: TITULO }).filter({ hasText: "emitidos" });
    await expect(atividade).toContainText("4 emitidos · 2 utilizados · 1 cancelados · 1 expirados");
    await expect(atividade).toContainText("6 pessoas reservadas · 4 participações confirmadas");

    for (const nota of ["reservas feitas, não visitas", "pessoas atendidas; não são turistas únicos", "adesões, não o fluxo total"]) {
      await expect(page.getByText(nota)).toBeVisible();
    }
    // Nenhum dado pessoal no relatório.
    await expect(page.getByText("[DEV]")).toHaveCount(0);
  });
});
