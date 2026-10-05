"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { instanteLocal } from "@/lib/datas";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  errosPorCampo,
  esquemaAtividade,
  esquemaCapacidade,
  esquemaNovaAtividade,
  esquemaSessao,
  STATUS_ATIVIDADE,
} from "./esquemas";

// Todas as actions: município pelo host, papel de gestor (ou admin) conferido aqui e de novo
// pela RLS no banco. Nenhuma usa a chave service_role.

type Estado = ResultadoAcao | undefined;

function camposAtividade(dados: FormData) {
  return {
    titulo: dados.get("titulo") ?? "",
    descricao: dados.get("descricao") ?? "",
    local_encontro: dados.get("local_encontro") ?? "",
    condicoes: dados.get("condicoes") ?? "",
    max_pessoas_por_voucher: dados.get("max_pessoas_por_voucher") ?? "",
    exige_responsavel: dados.get("exige_responsavel"),
    exige_contato: dados.get("exige_contato"),
    prestador_id: dados.get("prestador_id"),
  };
}

const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";

export async function criarAtividade(_: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  const r = esquemaNovaAtividade.safeParse({ ...camposAtividade(dados), modo: dados.get("modo") });
  if (!r.success) return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("atividades")
    .insert({ ...r.data, municipio_id: ctx.municipio.id, status: "rascunho" })
    .select("id")
    .single();
  if (error) return { ok: false, erro: ERRO_GENERICO };
  revalidatePath("/admin/atividades");
  redirect(`/admin/atividades/${data.id}?criada=1`);
}

export async function salvarAtividade(id: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Atividade não encontrada." };
  const r = esquemaAtividade.safeParse(camposAtividade(dados));
  if (!r.success) return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("atividades")
    .update(r.data)
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23503") return { ok: false, erro: "O prestador escolhido não pertence a este município.", campos: { prestador_id: "Escolha outro prestador." } };
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data.length) return { ok: false, erro: "Atividade não encontrada neste município." };
  revalidatePath(`/admin/atividades/${id}`);
  return { ok: true, aviso: "Alterações salvas." };
}

export async function mudarStatusAtividade(id: string, status: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  const s = z.enum(STATUS_ATIVIDADE).safeParse(status);
  if (!s.success || !z.uuid().safeParse(id).success) return { ok: false, erro: "Pedido inválido." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("atividades")
    .update({ status: s.data })
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, erro: ERRO_GENERICO };
  if (!data.length) return { ok: false, erro: "Atividade não encontrada neste município." };
  revalidatePath(`/admin/atividades/${id}`);
  revalidatePath("/admin/atividades");
  const avisos = {
    publicado: "Atividade publicada. Ela já aparece no portal do município.",
    arquivado: "Atividade arquivada. Ela saiu do portal; vouchers já emitidos continuam válidos.",
    rascunho: "Atividade voltou para elaboração e saiu do portal.",
  } as const;
  return { ok: true, aviso: avisos[s.data] };
}

export async function adicionarSessao(atividadeId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(atividadeId).success) return { ok: false, erro: "Atividade não encontrada." };
  const r = esquemaSessao.safeParse({
    dia: dados.get("dia") ?? "",
    hora_inicio: dados.get("hora_inicio") ?? "",
    hora_fim: dados.get("hora_fim") ?? "",
    capacidade: dados.get("capacidade") ?? "",
  });
  if (!r.success) return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };

  const inicio = instanteLocal(r.data.dia, r.data.hora_inicio);
  const fim = instanteLocal(r.data.dia, r.data.hora_fim);
  if (inicio.getTime() <= Date.now()) {
    return { ok: false, erro: "Esse horário já passou. Escolha um horário futuro.", campos: { hora_inicio: "Horário já passou." } };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("sessoes").insert({
    municipio_id: ctx.municipio.id,
    atividade_id: atividadeId,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    capacidade_pessoas: r.data.capacidade,
  });
  if (error) {
    if (error.message === "sessao_so_em_reserva") {
      return { ok: false, erro: "Registro voluntário não tem horários: o visitante escolhe o dia da visita." };
    }
    return { ok: false, erro: ERRO_GENERICO };
  }
  revalidatePath(`/admin/atividades/${atividadeId}`);
  return { ok: true, aviso: "Horário adicionado." };
}

export async function alterarCapacidade(sessaoId: string, atividadeId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(sessaoId).success) return { ok: false, erro: "Horário não encontrado." };
  const r = esquemaCapacidade.safeParse({ capacidade: dados.get("capacidade") ?? "" });
  if (!r.success) return { ok: false, erro: errosPorCampo(r.error).capacidade ?? "Vagas inválidas." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("sessoes")
    .update({ capacidade_pessoas: r.data.capacidade })
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", sessaoId)
    .select("id");
  if (error) {
    if (error.code === "23514") {
      return { ok: false, erro: "Há mais pessoas reservadas do que esse número de vagas. Informe um número maior." };
    }
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data.length) return { ok: false, erro: "Horário não encontrado neste município." };
  revalidatePath(`/admin/atividades/${atividadeId}`);
  return { ok: true, aviso: "Vagas atualizadas." };
}

export async function alternarSessao(sessaoId: string, atividadeId: string, ativa: boolean): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(sessaoId).success) return { ok: false, erro: "Horário não encontrado." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("sessoes")
    .update({ ativa })
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", sessaoId)
    .select("id");
  if (error || !data.length) return { ok: false, erro: ERRO_GENERICO };
  revalidatePath(`/admin/atividades/${atividadeId}`);
  return {
    ok: true,
    aviso: ativa ? "Horário reaberto para reservas." : "Horário fechado: não aceita novas reservas. As já feitas continuam válidas.",
  };
}

export async function excluirSessao(sessaoId: string, atividadeId: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(sessaoId).success) return { ok: false, erro: "Horário não encontrado." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("sessoes")
    .delete()
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", sessaoId)
    .select("id");
  if (error || !data.length) {
    return { ok: false, erro: "Este horário tem vouchers e não pode ser excluído. Feche-o para novas reservas." };
  }
  revalidatePath(`/admin/atividades/${atividadeId}`);
  return { ok: true, aviso: "Horário excluído." };
}
