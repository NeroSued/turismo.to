import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { USUARIOS_DEV } from "../ambiente";

// Fase 5.3 no celular (390x844, build de produção): axe em TODAS as páginas, públicas e do painel,
// com o papel que usa cada uma (visitante, gestor, operador, admin), e orçamento de desempenho
// das telas mais usadas no celular, com rede e processador de celular simulados.

const HUB = "http://localhost:3000";
const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const SUF = randomBytes(3).toString("hex");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** SQL no Postgres LOCAL (container do Supabase CLI), como o global-setup (D11). */
function sqlLocal(sql: string) {
  return execSync("docker exec -i supabase_db_turismo-to psql -U postgres -q -t -A -v ON_ERROR_STOP=1", {
    input: sql,
    encoding: "utf8",
  }).trim();
}

const ids = {
  atrativo: randomUUID(),
  evento: randomUUID(),
  prestador: randomUUID(),
  atividade: randomUUID(),
  sessao: randomUUID(),
  evidencia: randomUUID(),
};
let token = "";
let codigo = "";

async function novaPagina(browser: Browser) {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "pt-BR", timezoneId: "America/Araguaina" });
  return contexto.newPage();
}

async function entrar(page: Page, email: string) {
  await page.goto(`${PALMEIROPOLIS}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.E2E_SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

type Resultado = { url: string; ok: number; graves: string[]; menores: number };

/** Abre a página, confere que é ela mesma (sem redirecionamento nem 404 escondidos) e roda o axe. */
async function auditar(page: Page, url: string, esperado: { titulo?: RegExp; status?: number } = {}): Promise<Resultado> {
  const resposta = await page.goto(url);
  expect(resposta?.status(), url).toBe(esperado.status ?? 200);
  expect(new URL(page.url()).pathname, `${url} sem redirecionamento`).toBe(new URL(url).pathname);
  if (esperado.titulo) await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(esperado.titulo);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const graves = r.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  return { url: url.replace(/^https?:\/\//, ""), ok: r.passes.length, graves, menores: r.violations.length - graves.length };
}

function relatar(titulo: string, resultados: Resultado[]) {
  console.log(`axe · ${titulo} (${resultados.length} páginas):\n  ${resultados
    .map((r) => `${r.url}: ${r.ok} regras ok, ${r.graves.length} graves, ${r.menores} menores`)
    .join("\n  ")}`);
  expect(resultados.filter((r) => r.graves.length).map((r) => `${r.url} → ${r.graves.join(" | ")}`)).toEqual([]);
}

test.describe.serial("acessibilidade e desempenho em todas as telas (5.3)", () => {
  // Cada teste percorre dezenas de páginas com o axe.
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(() => {
    const m = sqlLocal(`select id from public.municipios where slug = 'palmeiropolis'`);
    sqlLocal(`
      insert into public.atrativos (id, municipio_id, nome, categoria, status, descricao)
        values ('${ids.atrativo}', '${m}', '[E2E] Mirante a11y ${SUF}', 'natureza', 'publicado', 'Mirante com vista para a serra.');
      insert into public.eventos (id, municipio_id, titulo, inicio, fim, status, atrativo_id)
        values ('${ids.evento}', '${m}', '[E2E] Festival a11y ${SUF}', now() + interval '3 days', now() + interval '3 days 4 hours', 'publicado', '${ids.atrativo}');
      insert into public.prestadores (id, municipio_id, nome_publico, categoria, situacao_rede, status, contatos_publicos)
        values ('${ids.prestador}', '${m}', '[E2E] Pousada a11y ${SUF}', 'hospedagem', 'participante', 'publicado', '(63) 3000-0000');
      insert into public.atividades (id, municipio_id, titulo, modo, status, exige_responsavel)
        values ('${ids.atividade}', '${m}', '[E2E] Trilha a11y ${SUF}', 'reserva', 'publicado', true);
      insert into public.sessoes (id, municipio_id, atividade_id, inicio, fim, capacidade_pessoas)
        values ('${ids.sessao}', '${m}', '${ids.atividade}', now() + interval '2 days', now() + interval '2 days 2 hours', 20);
      insert into public.evidencias (id, municipio_id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel)
        values ('${ids.evidencia}', '${m}', extract(year from now())::int, 'reuniao', '[E2E] Reunião a11y ${SUF}',
                'Reunião com a comunidade', current_date - 1, 'Secretaria');
    `);
    const [c, t] = sqlLocal(`
      select codigo || '|' || token from privado.emitir_voucher_publico('${m}', '${ids.atividade}', '${ids.sessao}', null, 2,
        'Gurupi', 'TO', '[E2E] Visitante a11y', null, gen_random_uuid());
    `).split("|");
    codigo = c;
    token = t;
  });

  test.afterAll(() => {
    sqlLocal(`
      update public.atividades set status = 'arquivado' where id = '${ids.atividade}';
      update public.atrativos set status = 'arquivado' where id = '${ids.atrativo}';
      update public.eventos set status = 'arquivado' where id = '${ids.evento}';
      update public.prestadores set status = 'arquivado' where id = '${ids.prestador}';
    `);
  });

  test("páginas públicas: hub, portal, conteúdo, reserva, comprovante, login e conta", async ({ browser }) => {
    const page = await novaPagina(browser);
    const resultados: Resultado[] = [];
    resultados.push(await auditar(page, `${HUB}/`));
    // Fontes servidas pelo próprio site (next/font/local): texto e títulos carregados, sem Google.
    const fontes = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([document.fonts.load("400 16px var(--font-texto)"), document.fonts.load("700 16px var(--font-titulo)")]).catch(() => null);
      return [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`);
    });
    expect(fontes.length, `fontes carregadas: ${fontes.join(", ")}`).toBeGreaterThanOrEqual(2);
    expect(await page.locator('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]').count()).toBe(0);
    const familias = await page.evaluate(() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector("h1")!).fontFamily]);
    console.log(`fontes: ${fontes.join(", ")} | corpo: ${familias[0]} | título: ${familias[1]}`);
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/atrativos`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/atrativos/${ids.atrativo}`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/eventos`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/eventos/${ids.evento}`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/prestadores`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/privacidade`));
    // Sem aviso configurado, a página informa o prazo de apagamento do município (D10, item 5.2).
    await expect(page.getByText(/Nome e telefone são apagados \d+ dias depois da data da atividade/)).toBeVisible();
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/atividades/${ids.atividade}`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/voucher/${token}`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/voucher/token-invalido-${SUF}`, { titulo: /Voucher não encontrado/ }));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/admin/login`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/admin/recuperar`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/conta/link-expirado`));
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/nao-existe`, { status: 404 }));
    // Formulário de reserva com erro de validação na tela.
    await page.goto(`${PALMEIROPOLIS}/atividades/${ids.atividade}`);
    await page.getByRole("radio").first().check();
    const formulario = page.locator("form").filter({ has: page.locator('button[type="submit"]') }).last();
    await formulario.evaluate((f) => f.setAttribute("novalidate", ""));
    await formulario.locator('button[type="submit"]').click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    const comErro = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    resultados.push({
      url: `${PALMEIROPOLIS.replace("http://", "")}/atividades/<id> (após enviar vazio)`,
      ok: comErro.passes.length,
      graves: comErro.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id),
      menores: comErro.violations.filter((v) => v.impact !== "critical" && v.impact !== "serious").length,
    });
    relatar("públicas", resultados);
    await page.context().close();
  });

  test("painel do gestor: todas as telas", async ({ browser }) => {
    const page = await novaPagina(browser);
    await entrar(page, USUARIOS_DEV.gestorPalmeiropolis);
    const P = `${PALMEIROPOLIS}/admin`;
    const resultados: Resultado[] = [];
    for (const caminho of [
      "", "/conteudo", "/atividades", "/atividades/nova", `/atividades/${ids.atividade}`,
      "/atrativos", "/atrativos/novo", `/atrativos/${ids.atrativo}`,
      "/eventos", "/eventos/novo", `/eventos/${ids.evento}`,
      "/prestadores", "/prestadores/novo", `/prestadores/${ids.prestador}`,
      "/vouchers/emitir", `/vouchers/emitir/${ids.atividade}`, `/vouchers/${codigo}`,
      "/atendimento", `/atendimento/${codigo}`,
      "/relatorios", "/relatorios?versao=divulgacao", "/relatorios/minuta",
      "/evidencias", "/evidencias/nova", `/evidencias/${ids.evidencia}`,
      "/configuracoes", "/equipe", "/auditoria", "/mais",
    ]) {
      resultados.push(await auditar(page, `${P}${caminho}`));
    }
    // Botão principal com o mouse em cima (estado em que o hover já derrubou o contraste para 3,27:1).
    await page.goto(`${P}/configuracoes`);
    await page.getByRole("button", { name: "Salvar configurações" }).hover();
    const hover = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    resultados.push({
      url: `${PALMEIROPOLIS.replace("http://", "")}/admin/configuracoes (mouse sobre o botão principal)`,
      ok: hover.passes.length,
      graves: hover.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      menores: 0,
    });
    // Conta logada: definir nova senha.
    resultados.push(await auditar(page, `${PALMEIROPOLIS}/conta/nova-senha`));
    relatar("painel do gestor", resultados);
    await page.context().close();
  });

  test("painel do operador e da assessoria", async ({ browser }) => {
    const operador = await novaPagina(browser);
    await entrar(operador, USUARIOS_DEV.operadorPalmeiropolis);
    const resultados: Resultado[] = [];
    for (const caminho of ["/atendimento", `/atendimento/${codigo}`, "/vouchers/emitir", `/vouchers/emitir/${ids.atividade}`, "/mais"]) {
      resultados.push(await auditar(operador, `${PALMEIROPOLIS}/admin${caminho}`));
    }
    await operador.context().close();

    const admin = await novaPagina(browser);
    await entrar(admin, USUARIOS_DEV.admin);
    for (const caminho of ["", "/assessoria", "/assessoria/peixe", `/evidencias/${ids.evidencia}`, "/auditoria", "/mais"]) {
      resultados.push(await auditar(admin, `${PALMEIROPOLIS}/admin${caminho}`));
    }
    relatar("operador e assessoria", resultados);
    await admin.context().close();
  });

  test("desempenho no celular: JavaScript enviado e tempo até o conteúdo principal", async ({ browser }) => {
    const page = await novaPagina(browser);
    const cdp = await page.context().newCDPSession(page);
    // Celular intermediário em 4G: processador 4x mais lento, 150 ms de latência, 1,6 Mbit/s.
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    // Primeira visita: sem cache do navegador (o aquecimento abaixo só prepara o servidor).
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
    });

    async function medir(url: string) {
      await page.goto(url, { waitUntil: "load" });
      return page.evaluate(async () => {
        const lcp = await new Promise<number>((resolver) => {
          new PerformanceObserver((lista) => {
            const e = lista.getEntries();
            resolver(e[e.length - 1].startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolver(-1), 3000);
        });
        const recursos = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const js = recursos.filter((r) => r.initiatorType === "script" || r.name.endsWith(".js"))
          .reduce((t, r) => t + (r.encodedBodySize || r.transferSize), 0);
        return { lcp: Math.round(lcp), jsKb: Math.round(js / 1024) };
      });
    }

    const paginas = [
      `${PALMEIROPOLIS}/`,
      `${PALMEIROPOLIS}/atividades/${ids.atividade}`,
      `${PALMEIROPOLIS}/voucher/${token}`,
      `${PALMEIROPOLIS}/admin/login`,
    ];
    const linhas: string[] = [];
    const medidas: { url: string; lcp: number; jsKb: number }[] = [];
    for (const url of paginas) {
      await medir(url); // aquece o cache do servidor (build de produção) sem contar
      await page.context().clearCookies();
      const m = await medir(url);
      medidas.push({ url, ...m });
      linhas.push(`${url.replace(/^https?:\/\//, "")}: maior conteúdo em ${m.lcp} ms, JavaScript ${m.jsKb} KB`);
    }
    await entrar(page, USUARIOS_DEV.operadorPalmeiropolis);
    const atendimento = await medir(`${PALMEIROPOLIS}/admin/atendimento`);
    medidas.push({ url: "admin/atendimento", ...atendimento });
    linhas.push(`palmeiropolis.localhost:3000/admin/atendimento (operador): maior conteúdo em ${atendimento.lcp} ms, JavaScript ${atendimento.jsKb} KB`);
    console.log(`desempenho (4G simulado, CPU 4x):\n  ${linhas.join("\n  ")}`);

    for (const m of medidas) {
      expect(m.lcp, `${m.url}: LCP medido`).toBeGreaterThan(0);
      // Orçamento: "bom" do Core Web Vitals (2,5 s) e até 350 KB de JavaScript comprimido por página.
      expect(m.lcp, `${m.url}: LCP`).toBeLessThanOrEqual(2500);
      expect(m.jsKb, `${m.url}: JavaScript`).toBeLessThanOrEqual(350);
    }
    await page.context().close();
  });
});
