"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { contextoDaAcao, SEM_PERMISSAO } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { codigoValido, lerEmissao, mensagemEmissao, normalizarCodigo } from "./esquemas";
import { esquemaResultado, type ResultadoVoucher } from "./painel";

// Atendimento e emissão assistida: operador ou gestor do município do host (o admin passa).
// As funções do banco conferem de novo o papel no município informado e o município do voucher.

export type EstadoAtendimento = { erro?: string; resultado?: ResultadoVoucher } | undefined;

const ERRO_CONEXAO = "Não foi possível falar com o servidor. Confira a conexão e tente de novo.";

export async function confirmarParticipacao(codigo: string, _: EstadoAtendimento, dados: FormData): Promise<EstadoAtendimento> {
  const ctx = await contextoDaAcao(["gestor", "operador"]);
  if (!ctx) return { erro: SEM_PERMISSAO };
  const pessoas = z.coerce.number().int().min(1).max(50).safeParse(dados.get("pessoas_atendidas"));
  if (!pessoas.success) return { erro: "Informe quantas pessoas foram atendidas (pelo menos 1)." };
  if (!codigoValido(codigo)) return { resultado: { resultado: "nao_encontrado" } };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("confirmar_voucher", {
    p_municipio_id: ctx.municipio.id,
    p_codigo: normalizarCodigo(codigo),
    p_pessoas_atendidas: pessoas.data,
  });
  if (error) {
    if (error.message === "quantidade_invalida") return { erro: "A quantidade atendida não pode passar das pessoas do voucher." };
    if (error.message === "sem_permissao") return { erro: SEM_PERMISSAO };
    return { erro: ERRO_CONEXAO };
  }
  return { resultado: esquemaResultado.parse(data) };
}

export async function cancelarNoPainel(codigo: string, anterior: EstadoAtendimento): Promise<EstadoAtendimento> {
  if (anterior?.resultado?.resultado === "cancelado") return anterior;
  const ctx = await contextoDaAcao(["gestor", "operador"]);
  if (!ctx) return { erro: SEM_PERMISSAO };
  if (!codigoValido(codigo)) return { resultado: { resultado: "nao_encontrado" } };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("cancelar_voucher_painel", {
    p_municipio_id: ctx.municipio.id,
    p_codigo: normalizarCodigo(codigo),
  });
  if (error) return { erro: error.message === "sem_permissao" ? SEM_PERMISSAO : ERRO_CONEXAO };
  return { resultado: esquemaResultado.parse(data) };
}

export type EstadoAssistida = { erro: string; campos?: Record<string, string> } | undefined;

/** Emissão assistida (item 1.7): mesma regra da pública, com a sessão do operador e sem limite por IP. */
export async function emitirAssistida(_: EstadoAssistida, dados: FormData): Promise<EstadoAssistida> {
  const ctx = await contextoDaAcao(["gestor", "operador"]);
  if (!ctx) return { erro: SEM_PERMISSAO };
  const r = lerEmissao(dados);
  if (!r.success) return { erro: "Confira os campos destacados.", campos: errosPorCampo(r.error) };
  if (!r.data.sessao_id && !r.data.data_visita) {
    return { erro: "Escolha o horário da atividade.", campos: { sessao_id: "Escolha um horário." } };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("emitir_voucher_assistido", {
    p_municipio_id: ctx.municipio.id,
    p_atividade_id: r.data.atividade_id,
    p_sessao_id: r.data.sessao_id as string,
    p_data_visita: r.data.data_visita as string,
    p_pessoas: r.data.pessoas,
    p_cidade: r.data.cidade,
    p_uf: r.data.uf,
    p_nome_responsavel: r.data.nome_responsavel as string,
    p_contato: r.data.contato as string,
    p_chave_idempotencia: r.data.chave_idempotencia,
  });
  if (error || !data?.[0]) return { erro: mensagemEmissao(error?.code === "P0001" ? error.message : undefined) };
  redirect(`/admin/vouchers/${data[0].codigo}?emitido=1`);
}
