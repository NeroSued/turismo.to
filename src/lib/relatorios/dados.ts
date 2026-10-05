import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const esquemaPorAtividade = z.object({
  atividade: z.string(),
  modo: z.enum(["reserva", "registro_voluntario"]),
  emitidos: z.number(),
  utilizados: z.number(),
  cancelados: z.number(),
  expirados: z.number(),
  pessoas_reservadas: z.number(),
  participacoes_confirmadas: z.number(),
});

const esquemaRelatorio = z.object({
  inicio: z.string(),
  fim: z.string(),
  emitidos: z.number(),
  utilizados: z.number(),
  cancelados: z.number(),
  expirados: z.number(),
  aguardando: z.number(),
  pessoas_reservadas: z.number(),
  participacoes_confirmadas: z.number(),
  registros_voluntarios: z.number(),
  pessoas_registros_voluntarios: z.number(),
  registros_confirmados: z.number(),
  pessoas_registros_confirmados: z.number(),
  emissoes_assistidas: z.number(),
  por_atividade: z.array(esquemaPorAtividade),
});

export type Relatorio = z.infer<typeof esquemaRelatorio>;

/** Relatório do período pelo dia da atividade. Só gestor do município ou admin (conferido no banco). */
export async function relatorioDoPeriodo(municipioId: string, inicio: string, fim: string): Promise<Relatorio> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("relatorio_vouchers", { p_municipio_id: municipioId, p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(`Falha ao gerar o relatório: ${error.message}`);
  return esquemaRelatorio.parse(data);
}

const esquemaVoucherLinha = z.object({
  codigo: z.string(),
  status: z.enum(["emitido", "utilizado", "cancelado", "expirado"]),
  origem: z.enum(["publico", "assistida"]),
  data_visita: z.string(),
  pessoas: z.number(),
  pessoas_atendidas: z.number().nullable(),
  cidade: z.string(),
  uf: z.string(),
  atividades: z.object({ titulo: z.string(), modo: z.enum(["reserva", "registro_voluntario"]) }).nullable(),
});

export type VoucherLinha = z.infer<typeof esquemaVoucherLinha>;

/** Vouchers do período, sem nome nem contato (RLS: só gestor do município ou admin). */
export async function vouchersDoPeriodo(municipioId: string, inicio: string, fim: string, limite = 200) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("vouchers")
    .select("codigo, status, origem, data_visita, pessoas, pessoas_atendidas, cidade, uf, atividades (titulo, modo)")
    .eq("municipio_id", municipioId)
    .gte("data_visita", inicio)
    .lte("data_visita", fim)
    .order("data_visita", { ascending: false })
    .order("emitido_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao listar vouchers: ${error.message}`);
  return z.array(esquemaVoucherLinha).parse(data);
}
