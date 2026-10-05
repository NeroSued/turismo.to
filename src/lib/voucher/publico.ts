import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { criarClientePrivilegiado } from "@/lib/supabase/privilegiado";
import type { EntradaEmissao } from "./esquemas";

/**
 * Operações privilegiadas do visitante (docs/PLANO.md, D8, itens 1 e 2): emissão pública e
 * consulta/cancelamento pelo token. Único módulo da aplicação que usa a chave service_role.
 * Quem chama já validou a entrada com Zod; aqui entram o limite de requisições (D9) e a
 * resposta mínima. As regras do voucher ficam nas funções do banco.
 */

const DEZ_MINUTOS = 600;

async function hashDoIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  return createHash("sha256").update(`turismo.to:${ip}`).digest("hex");
}

async function dentroDoLimite(escopo: "emissao_publica" | "consulta_token", alvo: string, maximo: number) {
  const { data, error } = await criarClientePrivilegiado().rpc("consumir_limite_requisicao", {
    p_escopo: escopo,
    p_chave: await hashDoIp(),
    p_alvo: alvo,
    p_maximo: maximo,
    p_janela_segundos: DEZ_MINUTOS,
  });
  if (error) throw new Error("Falha ao conferir o limite de requisições.");
  return data === true;
}

export type ResultadoEmissaoPublica =
  | { ok: true; token: string }
  | { ok: false; motivo: "limite" | "regra"; chave?: string };

/** D9: até 10 emissões por IP por município a cada 10 minutos. */
export async function emitirVoucherPublico(municipioId: string, e: EntradaEmissao): Promise<ResultadoEmissaoPublica> {
  if (!(await dentroDoLimite("emissao_publica", municipioId, 10))) return { ok: false, motivo: "limite" };
  const { data, error } = await criarClientePrivilegiado().rpc("emitir_voucher_publico", {
    p_municipio_id: municipioId,
    p_atividade_id: e.atividade_id,
    p_sessao_id: e.sessao_id as string,
    p_data_visita: e.data_visita as string,
    p_pessoas: e.pessoas,
    p_cidade: e.cidade,
    p_uf: e.uf,
    p_nome_responsavel: e.nome_responsavel as string,
    p_contato: e.contato as string,
    p_chave_idempotencia: e.chave_idempotencia,
  });
  if (error || !data?.[0]) return { ok: false, motivo: "regra", chave: error?.code === "P0001" ? error.message : undefined };
  return { ok: true, token: data[0].token };
}

export type VoucherDoVisitante = {
  codigo: string;
  status: "emitido" | "utilizado" | "cancelado" | "expirado";
  municipio: string;
  atividade: string;
  modo: "reserva" | "registro_voluntario";
  local_encontro: string | null;
  condicoes: string | null;
  data_visita: string;
  sessao_inicio: string | null;
  sessao_fim: string | null;
  pessoas: number;
  pessoas_atendidas: number | null;
  cidade: string;
  uf: string;
  nome_responsavel: string | null;
  utilizado_em: string | null;
  cancelado_em: string | null;
};

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * D9: até 30 consultas por IP a cada 10 minutos. Token inválido, de outro município ou de
 * voucher inexistente: null (mesma resposta). "limite" quando estourou o limite.
 */
export async function consultarPorToken(municipioId: string, token: string): Promise<VoucherDoVisitante | null | "limite"> {
  if (!(await dentroDoLimite("consulta_token", "*", 30))) return "limite";
  if (!TOKEN.test(token)) return null;
  const { data, error } = await criarClientePrivilegiado().rpc("consultar_voucher_token", {
    p_municipio_id: municipioId,
    p_token: token,
  });
  if (error) throw new Error("Falha ao consultar o voucher.");
  return (data as VoucherDoVisitante | null) ?? null;
}

export async function cancelarPorToken(municipioId: string, token: string): Promise<"cancelado" | "nao_cancelavel" | "nao_encontrado" | "limite"> {
  if (!(await dentroDoLimite("consulta_token", "*", 30))) return "limite";
  if (!TOKEN.test(token)) return "nao_encontrado";
  const { data, error } = await criarClientePrivilegiado().rpc("cancelar_voucher_token", {
    p_municipio_id: municipioId,
    p_token: token,
  });
  if (error) throw new Error("Falha ao cancelar o voucher.");
  return (data as { resultado: "cancelado" | "nao_cancelavel" | "nao_encontrado" }).resultado;
}
