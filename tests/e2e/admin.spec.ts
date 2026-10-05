import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ambienteLocal, USUARIOS_DEV } from "../ambiente";
import { PDF_TESTE } from "./arquivos";

// Fase 4 no celular (390x844, build de produção): restrição do operador, convite com senha
// definida pelo próprio convidado (Mailpit), equipe, escalada de privilégio pela rota,
// área da assessoria, auditoria com filtros e exclusão LGPD de arquivo de evidência.

const PALMEIROPOLIS = "http://palmeiropolis.localhost:3000";
const PEIXE = "http://peixe.localhost:3000";
const MAILPIT = "http://127.0.0.1:54324";
const SUF = randomBytes(3).toString("hex");
const SEM_PERMISSAO = "Sua conta não tem permissão para esta ação neste município.";

/** SQL no Postgres LOCAL (container do Supabase CLI), como o global-setup. */
function sqlLocal(sql: string) {
  return execSync("docker exec -i supabase_db_turismo-to psql -U postgres -q -t -A -v ON_ERROR_STOP=1", {
    input: sql,
    encoding: "utf8",
  }).trim();
}

const idMunicipio = (slug: string) => sqlLocal(`select id from public.municipios where slug = '${slug}'`);

async function entrar(page: Page, base: string, email: string, senha = process.env.E2E_SENHA!) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(\/atendimento)?$/);
}

async function novaPagina(browser: Browser) {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "pt-BR", timezoneId: "America/Araguaina" });
  return contexto.newPage();
}

/** Requisição direta ao servidor com o Host do município e os cookies da página (o Node não resolve *.localhost). */
async function pedir(page: Page, base: string, caminho: string, opcoes: { metodo?: "GET" | "POST"; headers?: Record<string, string>; dados?: Buffer } = {}) {
  const host = new URL(base).host;
  const cookies = (await page.context().cookies(base)).map((c) => `${c.name}=${c.value}`).join("; ");
  return page.request.fetch(`http://localhost:3000${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: { host, ...(cookies ? { cookie: cookies } : {}), ...opcoes.headers },
    data: opcoes.dados,
    maxRedirects: 0,
  });
}

async function linkDoConvite(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      const corpo = (await r.json()) as { messages: { ID: string; Subject: string }[] };
      id = corpo.messages.find((m) => m.Subject === "Convite para o painel Turismo.TO")?.ID;
      return Boolean(id);
    }, { timeout: 15_000 })
    .toBe(true);
  const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string; Text: string };
  expect(msg.Text + msg.HTML, "o e-mail não leva senha").not.toMatch(/senha:\s*\S|password:\s*\S/i);
  const href = /href="([^"]*token_hash=[^"]*)"/.exec(msg.HTML)?.[1];
  expect(href, "link do convite").toBeTruthy();
  return href!.replaceAll("&amp;", "&");
}

test.describe.serial("administração e usuários no celular", () => {
  test("operador vê só atendimento e emissão; conteúdo, relatórios, evidências e configurações ficam fora", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.operadorPalmeiropolis);
    await expect(page).toHaveURL(/\/admin\/atendimento$/);
    const nav = page.getByRole("navigation", { name: "Navegação do painel" });
    await expect(nav.getByRole("link")).toHaveText(["Atendimento", "Emitir voucher", "Mais"]);

    await nav.getByRole("link", { name: "Mais" }).click();
    await expect(page.getByText("Operador · Palmeirópolis")).toBeVisible();
    for (const proibido of ["Configurações", "Conteúdo do portal", "Evidências", "Equipe", "Auditoria", "Assessoria", "Minuta"]) {
      await expect(page.getByRole("link", { name: new RegExp(proibido) })).toHaveCount(0);
    }

    const evidencia = sqlLocal(`select id from public.evidencias limit 1`);
    const paginas = [
      "/admin", "/admin/conteudo", "/admin/atividades", "/admin/atividades/nova", "/admin/atrativos", "/admin/atrativos/novo",
      "/admin/eventos", "/admin/prestadores", "/admin/relatorios", "/admin/relatorios/minuta", "/admin/evidencias",
      "/admin/evidencias/nova", "/admin/configuracoes", "/admin/equipe", "/admin/auditoria", "/admin/assessoria",
      "/admin/assessoria/palmeiropolis", ...(evidencia ? [`/admin/evidencias/${evidencia}`] : []),
    ];
    for (const caminho of paginas) {
      await page.goto(`${PALMEIROPOLIS}${caminho}`);
      await expect(page, `${caminho} leva ao atendimento`).toHaveURL(/\/admin\/atendimento$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Atendimento");
    }

    // Rotas de arquivo e exportação também recusam o operador.
    expect((await pedir(page, PALMEIROPOLIS, "/admin/relatorios/csv")).status()).toBe(403);
    if (evidencia) {
      const arquivo = sqlLocal(`select id from public.evidencias_arquivos where evidencia_id = '${evidencia}' limit 1`);
      if (arquivo) expect((await pedir(page, PALMEIROPOLIS, `/admin/evidencias/${evidencia}/arquivos/${arquivo}`)).status()).toBe(404);
    }
  });

  test("convite cria a conta sem senha; o convidado define a própria senha pelo e-mail e entra como operador", async ({ page, browser }) => {
    const email = `convidado.${SUF}@exemplo.test`;
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Mais" }).click();
    await page.getByRole("link", { name: /Equipe/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Equipe" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Equipe" })).toContainText("[DEV] Operador de Palmeirópolis");

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Nome (opcional)").fill(`[E2E] Convidada ${SUF}`);
    await page.getByRole("radio", { name: /Operador/ }).check();
    await page.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Convite enviado para ${email} como operador` })).toBeVisible();

    // A conta existe, foi convidada e não tem senha nenhuma: ninguém recebeu senha pronta.
    expect(sqlLocal(`select invited_at is not null, coalesce(encrypted_password, '') = '' from auth.users where email = '${email}'`)).toBe("t|t");
    const item = page.getByRole("list", { name: "Equipe" }).getByRole("listitem").filter({ hasText: email });
    await expect(item).toContainText("Ainda não entrou");

    // O convidado abre o link do e-mail (Mailpit) num navegador sem sessão e cria a própria senha.
    const link = await linkDoConvite(email);
    expect(new URL(link).host).toBe("palmeiropolis.localhost:3000");
    const convidado = await novaPagina(browser);
    await convidado.goto(link);
    await expect(convidado).toHaveURL(/\/conta\/nova-senha$/);
    const senha = randomBytes(15).toString("base64url");
    await convidado.getByLabel("Nova senha (mínimo 10 caracteres)").fill(senha);
    await convidado.getByLabel("Repita a nova senha").fill(senha);
    await convidado.getByRole("button", { name: /senha/i }).click();
    await expect(convidado).toHaveURL(/\/admin\/atendimento$/);
    await expect(convidado.getByText("Painel · Operador")).toBeVisible();
    expect(sqlLocal(`select coalesce(encrypted_password, '') <> '' from auth.users where email = '${email}'`)).toBe("t");

    // Link usado de novo: não serve mais.
    const reuso = await novaPagina(browser);
    await reuso.goto(link);
    await expect(reuso).toHaveURL(/\/conta\/link-expirado$/);

    // O gestor troca o papel e depois desativa o acesso; o convidado perde o painel.
    await page.reload();
    const membro = page.getByRole("list", { name: "Equipe" }).getByRole("listitem").filter({ hasText: email });
    await expect(membro).not.toContainText("Ainda não entrou");
    await membro.getByRole("button", { name: /Tornar .* gestor municipal/ }).click();
    await expect(membro.getByRole("status")).toHaveText("Papel alterado para gestor municipal.");
    await membro.getByRole("button", { name: /Desativar o acesso/ }).click();
    await expect(membro.getByRole("status")).toContainText("Acesso desativado");
    expect(sqlLocal(`select papel || '|' || ativo from public.vinculos v join auth.users u on u.id = v.user_id where u.email = '${email}'`)).toBe("gestor|false");
    await convidado.goto(`${PALMEIROPOLIS}/admin`);
    await expect(convidado.getByRole("heading", { level: 1 })).toHaveText("Sem acesso a este painel");

    // O próprio gestor não altera o próprio acesso.
    const eu = page.getByRole("list", { name: "Equipe" }).getByRole("listitem").filter({ hasText: USUARIOS_DEV.gestorPalmeiropolis });
    await expect(eu).toContainText("Ninguém altera o próprio acesso.");
    await expect(eu.getByRole("button")).toHaveCount(0);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("rota: gestor não cria vínculo em outro município nem se promove ou promove outro a admin", async ({ page, browser }) => {
    const palmeiropolis = idMunicipio("palmeiropolis");
    const peixe = idMunicipio("peixe");
    const invasor = `invasor.${SUF}@exemplo.test`;
    const invasor2 = `invasor2.${SUF}@exemplo.test`;

    // 1. Convite adulterado: o formulário do gestor de Palmeirópolis é enviado com o município de Peixe.
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.goto(`${PALMEIROPOLIS}/admin/equipe`);
    let adulterados = 0;
    await page.route("**/admin/equipe", async (rota) => {
      const req = rota.request();
      const corpo = req.postData();
      if (req.method() !== "POST" || !corpo?.includes(palmeiropolis)) return rota.continue();
      adulterados++;
      await rota.continue({ postData: corpo.replaceAll(palmeiropolis, peixe) });
    });
    await page.getByLabel("E-mail").fill(invasor);
    await page.getByRole("radio", { name: /Gestor municipal/ }).check();
    await page.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByRole("alert").filter({ hasText: SEM_PERMISSAO })).toBeVisible();
    expect(adulterados).toBe(1);
    await page.unrouteAll();
    // Recusado ANTES da operação privilegiada: nenhuma conta criada, nenhum vínculo em Peixe.
    expect(sqlLocal(`select count(*) from auth.users where email = '${invasor}'`)).toBe("0");
    expect(sqlLocal(`select count(*) from public.vinculos where municipio_id = '${peixe}'`)).toBe("1");

    // 2. Campo extra admin_assessoria no convite: recusado.
    await page.route("**/admin/equipe", async (rota) => {
      const req = rota.request();
      const corpo = req.postData();
      const fronteira = /boundary=(.+)$/.exec(req.headers()["content-type"] ?? "")?.[1];
      if (req.method() !== "POST" || !corpo || !fronteira) return rota.continue();
      // Mesmo prefixo que o React usa nos campos do formulário (ex.: "1_email").
      const prefixo = /name="([^"]*)email"/.exec(corpo)?.[1] ?? "";
      const extra = `--${fronteira}\r\nContent-Disposition: form-data; name="${prefixo}admin_assessoria"\r\n\r\ntrue\r\n`;
      await rota.continue({ postData: extra + corpo });
    });
    await page.reload();
    await page.getByLabel("E-mail").fill(invasor2);
    const resposta = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/equipe"));
    await page.getByRole("button", { name: "Enviar convite" }).click();
    await resposta;
    await expect(page.getByRole("alert").filter({ hasText: SEM_PERMISSAO })).toBeVisible();
    await page.unrouteAll();
    expect(sqlLocal(`select count(*) from auth.users where email = '${invasor2}'`)).toBe("0");

    // 3. A action de conceder admin, capturada do painel do admin, reenviada com a sessão do gestor.
    const admin = await novaPagina(browser);
    await entrar(admin, PALMEIROPOLIS, USUARIOS_DEV.admin);
    await admin.goto(`${PALMEIROPOLIS}/admin/assessoria`);
    let capturada: { headers: Record<string, string>; corpo: Buffer } | undefined;
    await admin.route("**/admin/assessoria", async (rota) => {
      const req = rota.request();
      if (req.method() !== "POST") return rota.continue();
      capturada = { headers: req.headers(), corpo: req.postDataBuffer()! };
      await rota.abort();
    });
    await admin.getByLabel("E-mail da conta").fill(USUARIOS_DEV.gestorPalmeiropolis);
    await admin.getByRole("button", { name: "Tornar administrador" }).click();
    await expect.poll(() => Boolean(capturada)).toBe(true);
    expect(capturada!.headers["next-action"]).toBeTruthy();

    const reenviar = (corpo: Buffer) =>
      pedir(page, PALMEIROPOLIS, "/admin/assessoria", {
        metodo: "POST",
        dados: corpo,
        headers: {
          origin: PALMEIROPOLIS,
          accept: "text/x-component",
          "next-action": capturada!.headers["next-action"],
          "content-type": capturada!.headers["content-type"],
        },
      });
    const proprio = await reenviar(capturada!.corpo);
    expect(await proprio.text()).toContain(SEM_PERMISSAO);
    const outro = await reenviar(Buffer.from(capturada!.corpo.toString("utf8").replace(USUARIOS_DEV.gestorPalmeiropolis, USUARIOS_DEV.operadorPalmeiropolis)));
    expect(await outro.text()).toContain(SEM_PERMISSAO);
    expect(
      sqlLocal(`select string_agg(p.admin_assessoria::text, ',' order by u.email) from public.perfis p join auth.users u on u.id = p.user_id
                where u.email in ('${USUARIOS_DEV.gestorPalmeiropolis}', '${USUARIOS_DEV.operadorPalmeiropolis}')`),
    ).toBe("false,false");

    // 4. O gestor também não abre a área da assessoria.
    await page.goto(`${PALMEIROPOLIS}/admin/assessoria`);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("assessoria: lista os municípios, desativa e reativa um portal e edita outro município", async ({ page }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.admin);
    await page.getByRole("navigation", { name: "Navegação do painel" }).getByRole("link", { name: "Mais" }).click();
    await page.getByRole("link", { name: /Assessoria/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Assessoria" })).toBeVisible();
    const lista = page.getByRole("region", { name: "Municípios" }).getByRole("listitem");
    await expect(lista).toHaveCount(7);

    await page.getByRole("button", { name: "Desativar Arraias" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Arraias desativado" })).toBeVisible();
    expect(sqlLocal(`select ativo from public.municipios where slug = 'arraias'`)).toBe("f");
    const anonimo = await page.request.get("http://localhost:3000/", { headers: { host: "arraias.localhost:3000" }, maxRedirects: 0 });
    expect(anonimo.status()).toBe(404);
    const hub = await (await page.request.get("http://localhost:3000/")).text();
    expect(hub).not.toContain("Arraias");
    await page.getByRole("button", { name: "Ativar Arraias" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Arraias ativado" })).toBeVisible();
    expect(sqlLocal(`select ativo from public.municipios where slug = 'arraias'`)).toBe("t");

    // Configurações de outro município pela assessoria (sem trocar de subdomínio).
    await page.getByRole("link", { name: /Ananás/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ananás" })).toBeVisible();
    await page.getByLabel("Nome de exibição").fill(`[E2E] Ananás ${SUF}`);
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Configurações salvas" })).toBeVisible();
    const portal = await (await page.request.get("http://localhost:3000/", { headers: { host: "ananas.localhost:3000" } })).text();
    expect(portal).toContain(`[E2E] Ananás ${SUF}`);
    await page.getByLabel("Nome de exibição").fill("");
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Configurações salvas" })).toBeVisible();

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("auditoria com filtros por pessoa, período, área e tipo de ação, isolada por município", async ({ page, browser }) => {
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.goto(`${PALMEIROPOLIS}/admin/auditoria`);
    await expect(page.getByRole("heading", { level: 1, name: "Auditoria" })).toBeVisible();
    await page.getByLabel("Área").selectOption("vinculos");
    await page.getByLabel("Tipo de ação").selectOption("INSERT");
    await page.getByLabel("Pessoa").selectOption({ label: "[DEV] Gestor de Palmeirópolis" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/area=vinculos/);
    const registros = page.getByRole("list", { name: "Registros de auditoria" }).getByRole("listitem");
    await expect(registros.first()).toContainText("Inclusão em equipe e acessos");
    await expect(registros.first()).toContainText("[DEV] Gestor de Palmeirópolis");
    for (const r of await registros.all()) await expect(r).toContainText("Inclusão em equipe e acessos");

    await page.getByLabel("Tipo de ação").selectOption("UPDATE");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(registros.first()).toContainText("Campos: ativo");

    // Período sem registros: estado vazio que explica o que fazer.
    await page.goto(`${PALMEIROPOLIS}/admin/auditoria?inicio=2020-01-01&fim=2020-01-31`);
    await expect(page.getByText("Nenhum registro com esses filtros.")).toBeVisible();

    // Gestor de Peixe pedindo a auditoria de Palmeirópolis pelo parâmetro: continua vendo só Peixe.
    const peixe = await novaPagina(browser);
    await entrar(peixe, PEIXE, USUARIOS_DEV.gestorPeixe);
    await peixe.goto(`${PEIXE}/admin/auditoria?municipio=${idMunicipio("palmeiropolis")}&area=vinculos`);
    await expect(peixe.getByLabel("Município")).toHaveCount(0);
    await expect(peixe.getByText(`[E2E] Convidada ${SUF}`)).toHaveCount(0);
    await expect(peixe.getByText("[DEV] Gestor de Palmeirópolis")).toHaveCount(0);
    const dePeixe = sqlLocal(
      `select count(*) from public.auditoria where tabela = 'vinculos' and municipio_id = '${idMunicipio("peixe")}'
       and em >= now() - interval '31 days'`,
    );
    await expect(peixe.getByRole("list", { name: "Registros de auditoria" }).getByRole("listitem")).toHaveCount(Math.min(Number(dePeixe), 50));

    // Admin: todos os municípios, com o nome de cada um.
    const admin = await novaPagina(browser);
    await entrar(admin, PALMEIROPOLIS, USUARIOS_DEV.admin);
    await admin.goto(`${PALMEIROPOLIS}/admin/auditoria?municipio=todos&area=municipios`);
    await expect(admin.getByRole("list", { name: "Registros de auditoria" }).getByRole("listitem").first()).toContainText("Arraias");

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("LGPD: só o admin exclui de vez o arquivo de evidência; o Storage fica sem ele e o histórico guarda quem, quando e o motivo", async ({ page, browser }) => {
    const { url, secret } = ambienteLocal();
    const servico = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const municipio = idMunicipio("palmeiropolis");
    const legenda = `Lista com assinatura de Fulana ${SUF}`;
    const motivo = `Pedido da titular recebido pela Ouvidoria (${SUF})`;

    // Evidência criada pelo gestor com um anexo no bucket interno.
    await entrar(page, PALMEIROPOLIS, USUARIOS_DEV.gestorPalmeiropolis);
    await page.goto(`${PALMEIROPOLIS}/admin/evidencias/nova`);
    await page.getByLabel("Tipo da ação").selectOption("reuniao");
    await page.getByLabel("Título").fill(`[E2E] Reunião LGPD ${SUF}`);
    await page.getByLabel("Descrição").fill("Reunião com a comunidade para apresentar o roteiro.");
    await page.getByLabel("Data de realização").fill(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Araguaina" }));
    await page.getByLabel("Responsável pela ação").fill("Secretaria de Turismo");
    await page.getByRole("button", { name: "Registrar evidência" }).click();
    await expect(page).toHaveURL(/\/admin\/evidencias\/[0-9a-f-]+\?criada=1$/);
    const evidencia = new URL(page.url()).pathname.split("/").pop()!;
    await page.getByLabel("Tipo do arquivo").selectOption("lista_presenca");
    await page.getByLabel("Arquivo", { exact: true }).setInputFiles({ name: "lista.pdf", mimeType: "application/pdf", buffer: PDF_TESTE });
    await page.getByLabel("Legenda").fill(legenda);
    await page.getByRole("button", { name: "Enviar arquivo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Anexo enviado." })).toBeVisible();
    const [arquivo, caminho] = sqlLocal(`select id || '|' || caminho from public.evidencias_arquivos where evidencia_id = '${evidencia}'`).split("|");
    expect(caminho.startsWith(`${municipio}/evidencias/`)).toBe(true);
    const existe = async () => !(await servico.storage.from("interno").download(caminho)).error;
    expect(await existe()).toBe(true);

    // Gestor: não há exclusão definitiva para ele; "Retirar" só tira da evidência.
    await expect(page.getByRole("heading", { name: "Exclusão a pedido do titular (LGPD)" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Excluir definitivamente/ })).toHaveCount(0);
    await page.getByRole("button", { name: `Retirar o anexo ${legenda}` }).click();
    await expect(page.getByRole("status").filter({ hasText: "Arquivo retirado da evidência" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(legenda) })).toHaveCount(0);
    expect(await existe(), "retirar não apaga o arquivo").toBe(true);
    expect((await pedir(page, PALMEIROPOLIS, `/admin/evidencias/${evidencia}/arquivos/${arquivo}`)).status()).toBe(404);

    // Admin: exclusão definitiva com motivo.
    const admin = await novaPagina(browser);
    await entrar(admin, PALMEIROPOLIS, USUARIOS_DEV.admin);
    await admin.goto(`${PALMEIROPOLIS}/admin/evidencias/${evidencia}`);
    const secao = admin.getByRole("region", { name: "Exclusão a pedido do titular (LGPD)" });
    await expect(secao).toContainText(`${legenda}`);
    await expect(secao).toContainText("retirado pelo gestor");
    await secao.getByRole("button", { name: `Excluir definitivamente ${legenda}` }).click();
    await secao.getByLabel("Motivo da exclusão").fill("curto");
    await secao.getByRole("button", { name: "Confirmar exclusão definitiva" }).click();
    await expect(secao.getByRole("alert")).toContainText("pelo menos 10 caracteres");
    expect(await existe()).toBe(true);
    await secao.getByLabel("Motivo da exclusão").fill(motivo);
    await secao.getByRole("button", { name: "Confirmar exclusão definitiva" }).click();
    await expect(secao.getByRole("status")).toContainText("Arquivo excluído definitivamente.");

    // O arquivo saiu do Storage e do banco; o histórico guarda quem, quando e o motivo, sem a legenda.
    expect(await existe(), "arquivo apagado do Storage").toBe(false);
    expect(sqlLocal(`select count(*) from storage.objects where bucket_id = 'interno' and name = '${caminho}'`)).toBe("0");
    expect(sqlLocal(`select count(*) from public.evidencias_arquivos where id = '${arquivo}'`)).toBe("0");
    const registro = sqlLocal(
      `select autor_nome || '|' || (depois ->> 'motivo') || '|' || (em > now() - interval '5 minutes') || '|' || (antes::text like '%${SUF}%')
       from public.evidencias_historico where evidencia_id = '${evidencia}' and acao = 'arquivo_excluido_lgpd'`,
    );
    expect(registro).toBe(`[DEV] Admin da assessoria|${motivo}|true|false`);
    await admin.reload();
    const historico = admin.getByRole("region", { name: "Histórico de alterações" }).getByRole("listitem");
    await expect(historico.first()).toContainText(`Excluiu definitivamente um arquivo (lista de presença) a pedido do titular. Motivo: ${motivo}`);
    await expect(historico.first()).toContainText("[DEV] Admin da assessoria");
    await expect(historico.first()).toContainText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
    // Item 5.9: a legenda (pode ter o nome da pessoa) sai dos registros anteriores do histórico e da auditoria.
    await expect(historico.nth(1)).toContainText("Retirou da evidência Lista de presença: [removido a pedido do titular]");
    await expect(historico.nth(1)).toContainText("[DEV] Gestor de Palmeirópolis");
    await expect(admin.getByRole("region", { name: "Histórico de alterações" })).not.toContainText(legenda);
    expect(sqlLocal(
      `select count(*) from public.evidencias_historico where evidencia_id = '${evidencia}'
         and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Fulana ${SUF}%'`,
    )).toBe("0");
    expect(sqlLocal(
      `select count(*) from public.auditoria where tabela = 'evidencias_arquivos' and registro_id = '${arquivo}'
         and (coalesce(antes::text, '') || coalesce(depois::text, '')) like '%Fulana ${SUF}%'`,
    )).toBe("0");

    // O gestor vê o registro da exclusão no histórico, sem a legenda.
    await page.reload();
    await expect(page.getByRole("region", { name: "Histórico de alterações" })).toContainText(motivo);
    await expect(page.getByRole("region", { name: "Histórico de alterações" })).not.toContainText(legenda);
  });
});
