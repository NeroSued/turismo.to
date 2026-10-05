"use server";

import { redirect } from "next/navigation";
import { municipioDaRequisicao } from "@/lib/municipio/atual";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { lerEmissao, mensagemEmissao } from "./esquemas";
import { cancelarPorToken, emitirVoucherPublico } from "./publico";

export type EstadoReserva =
  | { erro: string; campos?: Record<string, string> }
  | undefined;

/** Reserva ou registro do visitante. Resposta mínima: em sucesso, só o redirecionamento ao comprovante. */
export async function emitirReserva(_: EstadoReserva, dados: FormData): Promise<EstadoReserva> {
  const municipio = await municipioDaRequisicao();
  if (!municipio) return { erro: "Município não encontrado. Volte ao portal e tente de novo." };

  const r = lerEmissao(dados);
  if (!r.success) return { erro: "Confira os campos destacados.", campos: errosPorCampo(r.error) };
  if (!r.data.sessao_id && !r.data.data_visita) {
    return { erro: "Escolha o horário da atividade.", campos: { sessao_id: "Escolha um horário." } };
  }

  const resultado = await emitirVoucherPublico(municipio.id, r.data);
  if (!resultado.ok) {
    if (resultado.motivo === "limite") {
      return { erro: "Muitas reservas seguidas a partir desta conexão. Aguarde 10 minutos e tente de novo." };
    }
    return { erro: mensagemEmissao(resultado.chave) };
  }
  redirect(`/voucher/${resultado.token}`);
}

export type EstadoCancelamento = { erro?: string; cancelado?: boolean } | undefined;

export async function cancelarReserva(token: string, anterior: EstadoCancelamento): Promise<EstadoCancelamento> {
  if (anterior?.cancelado) return anterior;
  const municipio = await municipioDaRequisicao();
  if (!municipio) return { erro: "Voucher não encontrado." };
  const r = await cancelarPorToken(municipio.id, token);
  if (r === "limite") return { erro: "Muitas tentativas seguidas. Aguarde 10 minutos e tente de novo." };
  if (r === "nao_encontrado") return { erro: "Voucher não encontrado. Confira se o link está completo." };
  if (r === "nao_cancelavel") {
    return { erro: "Este voucher não pode mais ser cancelado: ele já foi utilizado, cancelado ou expirou." };
  }
  return { cancelado: true };
}
