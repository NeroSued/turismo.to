import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { USUARIOS_DEV } from "../ambiente";
import { clienteAnonimo, clienteServico, entrarComo, idDoMunicipio, sufixo, type Cliente } from "./apoio";

// Regras críticas do voucher pela Data API real do Supabase local (PostgREST + Postgres),
// com as mesmas chaves e sessões que o servidor e o painel usam.

const MINUTO = 60_000;

let servico: Cliente;
let gestor: Cliente;
let operador: Cliente;
let gestorPeixe: Cliente;
let palmeiropolis: string;
let peixe: string;

async function criarAtividade(titulo: string, modo: "reserva" | "registro_voluntario") {
  const { data, error } = await gestor
    .from("atividades")
    .insert({ municipio_id: palmeiropolis, titulo, modo, status: "publicado", max_pessoas_por_voucher: 10 })
    .select("id")
    .single();
  if (error) throw new Error(`Criar atividade: ${error.message}`);
  return data.id;
}

async function criarSessao(atividadeId: string, inicio: Date, capacidade: number | null) {
  const fim = new Date(inicio.getTime() + 60 * MINUTO);
  const { data, error } = await gestor
    .from("sessoes")
    .insert({
      municipio_id: palmeiropolis,
      atividade_id: atividadeId,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      capacidade_pessoas: capacidade,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Criar sessão: ${error.message}`);
  return data.id;
}

function emitir(p: {
  atividade: string;
  sessao: string | null;
  pessoas: number;
  chave?: string;
  data?: string | null;
  cidade?: string;
}) {
  return servico.rpc("emitir_voucher_publico", {
    p_municipio_id: palmeiropolis,
    p_atividade_id: p.atividade,
    p_sessao_id: p.sessao as string,
    p_data_visita: (p.data ?? null) as string,
    p_pessoas: p.pessoas,
    p_cidade: p.cidade ?? "Gurupi",
    p_uf: "TO",
    p_nome_responsavel: null as unknown as string,
    p_contato: null as unknown as string,
    p_chave_idempotencia: p.chave ?? randomUUID(),
  });
}

async function reservadas(sessao: string) {
  const { data, error } = await servico.from("sessoes").select("pessoas_reservadas").eq("id", sessao).single();
  if (error) throw new Error(error.message);
  return data.pessoas_reservadas;
}

function hojeEmAraguaina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date());
}

beforeAll(async () => {
  servico = clienteServico();
  [gestor, operador, gestorPeixe] = await Promise.all([
    entrarComo(USUARIOS_DEV.gestorPalmeiropolis),
    entrarComo(USUARIOS_DEV.operadorPalmeiropolis),
    entrarComo(USUARIOS_DEV.gestorPeixe),
  ]);
  [palmeiropolis, peixe] = await Promise.all([idDoMunicipio("palmeiropolis"), idDoMunicipio("peixe")]);
});

describe("concorrência", () => {
  it("30 emissões simultâneas de 1 a 3 pessoas numa sessão de 15 vagas nunca passam de 15", async () => {
    const atividade = await criarAtividade(`[TESTE] Concorrência ${sufixo()}`, "reserva");
    const sessao = await criarSessao(atividade, new Date(Date.now() + 3 * 24 * 60 * MINUTO), 15);

    const pedidos = Array.from({ length: 30 }, (_, i) => ({ pessoas: (i % 3) + 1, chave: randomUUID() }));
    const respostas = await Promise.all(pedidos.map((p) => emitir({ atividade, sessao, ...p })));

    const aceitos = respostas.flatMap((r, i) => (r.error ? [] : [{ ...pedidos[i], voucher: r.data![0] }]));
    const recusados = respostas.filter((r) => r.error);
    const somaAceitos = aceitos.reduce((s, a) => s + a.pessoas, 0);

    const { data: vouchers, error } = await servico
      .from("vouchers")
      .select("pessoas")
      .eq("sessao_id", sessao)
      .eq("status", "emitido");
    expect(error).toBeNull();
    const somaBanco = vouchers!.reduce((s, v) => s + v.pessoas, 0);

    console.info(
      `[concorrência] aceitos=${aceitos.length} recusados=${recusados.length} ` +
        `pessoas nos vouchers=${somaBanco} pessoas_reservadas=${await reservadas(sessao)}`,
    );
    expect(recusados.every((r) => r.error?.message === "sem_vagas")).toBe(true);
    expect(somaAceitos).toBeLessThanOrEqual(15);
    expect(somaBanco).toBe(somaAceitos);
    expect(await reservadas(sessao)).toBe(somaBanco);
    expect(vouchers!.length).toBe(aceitos.length);
    // Com pedidos de 1 pessoa ainda chegando, a sessão termina cheia ou a uma vaga de encher.
    expect(somaBanco).toBeGreaterThanOrEqual(13);
  });
});

describe("idempotência", () => {
  it("a mesma chave enviada 10 vezes ao mesmo tempo gera um único voucher e reserva uma vez", async () => {
    const atividade = await criarAtividade(`[TESTE] Idempotência ${sufixo()}`, "reserva");
    const sessao = await criarSessao(atividade, new Date(Date.now() + 3 * 24 * 60 * MINUTO), 15);
    const chave = randomUUID();

    const respostas = await Promise.all(Array.from({ length: 10 }, () => emitir({ atividade, sessao, pessoas: 3, chave })));
    expect(respostas.map((r) => r.error)).toEqual(Array(10).fill(null));
    const ids = new Set(respostas.map((r) => r.data![0].voucher_id));
    const codigos = new Set(respostas.map((r) => r.data![0].codigo));
    const novos = respostas.filter((r) => !r.data![0].repetido).length;

    const { count } = await servico
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("municipio_id", palmeiropolis)
      .eq("chave_idempotencia", chave);

    console.info(`[idempotência] respostas=10 vouchers distintos=${ids.size} no banco=${count} reservadas=${await reservadas(sessao)}`);
    expect(ids.size).toBe(1);
    expect(codigos.size).toBe(1);
    expect(novos).toBe(1);
    expect(count).toBe(1);
    expect(await reservadas(sessao)).toBe(3);
  });
});

describe("confirmação, cancelamento e isolamento", () => {
  let atividade: string;
  let codigo: string;
  let codigoCancelado: string;

  beforeAll(async () => {
    atividade = await criarAtividade(`[TESTE] Confirmação ${sufixo()}`, "registro_voluntario");
    const hoje = hojeEmAraguaina();
    const a = await emitir({ atividade, sessao: null, pessoas: 4, data: hoje });
    const b = await emitir({ atividade, sessao: null, pessoas: 2, data: hoje });
    if (a.error || b.error) throw new Error(`Emissão: ${a.error?.message ?? b.error?.message}`);
    codigo = a.data![0].codigo;
    codigoCancelado = b.data![0].codigo;
  });

  it("operador confirma; a confirmação repetida devolve já utilizado e não altera contagens", async () => {
    const r1 = await operador.rpc("confirmar_voucher", { p_municipio_id: palmeiropolis, p_codigo: codigo, p_pessoas_atendidas: 3 });
    expect(r1.error).toBeNull();
    expect((r1.data as { resultado: string }).resultado).toBe("confirmado");

    const antes = await gestor.from("vouchers").select("status, pessoas_atendidas, utilizado_em").eq("codigo", codigo).single();
    const r2 = await operador.rpc("confirmar_voucher", { p_municipio_id: palmeiropolis, p_codigo: codigo, p_pessoas_atendidas: 4 });
    const depois = await gestor.from("vouchers").select("status, pessoas_atendidas, utilizado_em").eq("codigo", codigo).single();

    const d2 = r2.data as { resultado: string; voucher: { pessoas_atendidas: number; utilizado_por_nome: string } };
    console.info(`[confirmação repetida] 1ª=${(r1.data as { resultado: string }).resultado} 2ª=${d2.resultado} atendidas=${depois.data?.pessoas_atendidas}`);
    expect(d2.resultado).toBe("ja_utilizado");
    expect(d2.voucher.pessoas_atendidas).toBe(3);
    expect(d2.voucher.utilizado_por_nome).toBe("[DEV] Operador de Palmeirópolis");
    expect(depois.data).toEqual(antes.data);
    expect(depois.data?.pessoas_atendidas).toBe(3);
  });

  it("voucher cancelado é rejeitado na confirmação", async () => {
    const c = await operador.rpc("cancelar_voucher_painel", { p_municipio_id: palmeiropolis, p_codigo: codigoCancelado });
    expect((c.data as { resultado: string }).resultado).toBe("cancelado");
    const r = await operador.rpc("confirmar_voucher", {
      p_municipio_id: palmeiropolis,
      p_codigo: codigoCancelado,
      p_pessoas_atendidas: 1,
    });
    console.info(`[voucher cancelado] resultado=${(r.data as { resultado: string }).resultado}`);
    expect((r.data as { resultado: string }).resultado).toBe("cancelado");
    const v = await gestor.from("vouchers").select("status, pessoas_atendidas").eq("codigo", codigoCancelado).single();
    expect(v.data).toEqual({ status: "cancelado", pessoas_atendidas: null });
  });

  it("voucher de Palmeirópolis é rejeitado pelo gestor de Peixe, sem revelar detalhes", async () => {
    const outro = await emitir({ atividade, sessao: null, pessoas: 1, data: hojeEmAraguaina() });
    const cod = outro.data![0].codigo;
    const r = await gestorPeixe.rpc("confirmar_voucher", { p_municipio_id: peixe, p_codigo: cod, p_pessoas_atendidas: 1 });
    const conf = await gestorPeixe.rpc("conferir_voucher", { p_municipio_id: peixe, p_codigo: cod });
    // Informando o município do voucher, a função confere o vínculo e recusa.
    const forcado = await gestorPeixe.rpc("confirmar_voucher", { p_municipio_id: palmeiropolis, p_codigo: cod, p_pessoas_atendidas: 1 });
    console.info(`[outro município] confirmar=${JSON.stringify(r.data)} conferir=${JSON.stringify(conf.data)} forçado=${forcado.error?.message}`);
    expect(r.data).toEqual({ resultado: "outro_municipio" });
    expect(conf.data).toEqual({ resultado: "outro_municipio" });
    expect(forcado.error?.message).toBe("sem_permissao");
    const v = await gestor.from("vouchers").select("status").eq("codigo", cod).single();
    expect(v.data?.status).toBe("emitido");
    const leitura = await gestorPeixe.from("vouchers").select("id").eq("codigo", cod);
    expect(leitura.data).toEqual([]);
  });

  it("visitante anônimo e operador não leem vouchers por consulta direta", async () => {
    const anon = await clienteAnonimo().from("vouchers").select("*");
    expect(anon.error?.code).toBe("42501");
    const op = await operador.from("vouchers").select("*").eq("codigo", codigo);
    expect(op.data).toEqual([]);
  });

  it("token errado recebe a mesma resposta de voucher inexistente", async () => {
    const errado = await servico.rpc("consultar_voucher_token", { p_municipio_id: palmeiropolis, p_token: "f".repeat(64) });
    const malformado = await servico.rpc("consultar_voucher_token", { p_municipio_id: palmeiropolis, p_token: "x" });
    expect(errado.data).toBeNull();
    expect(malformado.data).toBeNull();
    expect(errado.error).toBeNull();
    expect(malformado.error).toBeNull();
  });
});

describe("coerência do relatório", () => {
  it("pessoas reservadas, atendidas e números do relatório batem com os vouchers do teste", async () => {
    const titulo = `[TESTE] Coerência ${sufixo()}`;
    const atividade = await criarAtividade(titulo, "reserva");
    // Sessão hoje, alguns minutos à frente: aceita emissão agora e confirmação hoje.
    const sessao = await criarSessao(atividade, new Date(Date.now() + 3 * MINUTO), 40);

    const plano = [
      { pessoas: 4, acao: "confirmar", atendidas: 3 },
      { pessoas: 2, acao: "confirmar", atendidas: 2 },
      { pessoas: 5, acao: "cancelar_token" },
      { pessoas: 3, acao: "cancelar_painel" },
      { pessoas: 1, acao: "nada" },
      { pessoas: 6, acao: "confirmar", atendidas: 1 },
    ] as const;

    const emitidos = [];
    for (const p of plano) {
      const r = await emitir({ atividade, sessao, pessoas: p.pessoas });
      if (r.error) throw new Error(r.error.message);
      emitidos.push({ ...p, ...r.data![0] });
    }
    for (const e of emitidos) {
      if (e.acao === "confirmar") {
        const r = await operador.rpc("confirmar_voucher", {
          p_municipio_id: palmeiropolis,
          p_codigo: e.codigo,
          p_pessoas_atendidas: e.atendidas,
        });
        expect((r.data as { resultado: string }).resultado).toBe("confirmado");
      } else if (e.acao === "cancelar_token") {
        const r = await servico.rpc("cancelar_voucher_token", { p_municipio_id: palmeiropolis, p_token: e.token });
        expect(r.data).toEqual({ resultado: "cancelado" });
      } else if (e.acao === "cancelar_painel") {
        const r = await gestor.rpc("cancelar_voucher_painel", { p_municipio_id: palmeiropolis, p_codigo: e.codigo });
        expect((r.data as { resultado: string }).resultado).toBe("cancelado");
      }
    }

    const naoCancelados = emitidos.filter((e) => !e.acao.startsWith("cancelar"));
    const esperado = {
      emitidos: emitidos.length,
      utilizados: emitidos.filter((e) => e.acao === "confirmar").length,
      cancelados: emitidos.filter((e) => e.acao.startsWith("cancelar")).length,
      expirados: 0,
      pessoas_reservadas: naoCancelados.reduce((s, e) => s + e.pessoas, 0),
      participacoes_confirmadas: emitidos.reduce((s, e) => s + (e.acao === "confirmar" ? e.atendidas : 0), 0),
    };

    const hoje = hojeEmAraguaina();
    const rel = await gestor.rpc("relatorio_vouchers", { p_municipio_id: palmeiropolis, p_inicio: hoje, p_fim: hoje });
    expect(rel.error).toBeNull();
    type Linha = { atividade: string } & typeof esperado;
    const relatorio = rel.data as unknown as Record<string, number> & { por_atividade: Linha[] };
    const minha = relatorio.por_atividade.find((l) => l.atividade === titulo);

    console.info(
      `[coerência] esperado=${JSON.stringify(esperado)} relatório=${JSON.stringify(minha)} ` +
        `pessoas_reservadas(sessão)=${await reservadas(sessao)}`,
    );
    expect(minha).toMatchObject(esperado);
    expect(await reservadas(sessao)).toBe(esperado.pessoas_reservadas);

    // Totais do período = soma das atividades de reserva (nenhum número some ou duplica).
    const reservas = relatorio.por_atividade.filter((l) => (l as unknown as { modo: string }).modo === "reserva");
    for (const campo of ["emitidos", "utilizados", "cancelados", "expirados", "pessoas_reservadas", "participacoes_confirmadas"] as const) {
      expect(relatorio[campo]).toBe(reservas.reduce((s, l) => s + l[campo], 0));
    }
  });
});
