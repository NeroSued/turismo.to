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

const esquemaCompleto = esquemaRelatorio.extend({
  origem: z.array(
    z.object({ uf: z.string(), cidade: z.string(), vouchers: z.number(), pessoas: z.number(), participacoes_confirmadas: z.number() }),
  ),
  prestadores: z.array(
    z.object({
      nome: z.string(),
      categoria: z.string(),
      situacao_rede: z.string(),
      atividades: z.number(),
      vouchers: z.number(),
      participacoes_confirmadas: z.number(),
    }),
  ),
  rede: z.object({
    participantes: z.number(),
    adesoes: z.array(z.object({ nome: z.string(), categoria: z.string(), data_adesao: z.string() })),
  }),
});

export type RelatorioCompleto = z.infer<typeof esquemaCompleto>;

/**
 * Relatório completo do período (item 3.1): números dos vouchers, origem por cidade e UF,
 * prestadores envolvidos e rede. Só gestor do município ou admin (conferido no banco).
 */
export async function relatorioCompleto(municipioId: string, inicio: string, fim: string): Promise<RelatorioCompleto> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("relatorio_completo", { p_municipio_id: municipioId, p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(`Falha ao gerar o relatório: ${error.message}`);
  return esquemaCompleto.parse(data);
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
export async function vouchersDoPeriodo(municipioId: string, inicio: string, fim: string, limite = 200, deslocamento = 0) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("vouchers")
    .select("codigo, status, origem, data_visita, pessoas, pessoas_atendidas, cidade, uf, atividades (titulo, modo)")
    .eq("municipio_id", municipioId)
    .gte("data_visita", inicio)
    .lte("data_visita", fim)
    .order("data_visita", { ascending: false })
    .order("emitido_em", { ascending: false })
    .order("codigo")
    .range(deslocamento, deslocamento + limite - 1);
  if (error) throw new Error(`Falha ao listar vouchers: ${error.message}`);
  return z.array(esquemaVoucherLinha).parse(data);
}

/** Todos os vouchers do período para o CSV, em páginas de 1000 (limite da Data API). */
export async function todosVouchersDoPeriodo(municipioId: string, inicio: string, fim: string, maximo = 50_000) {
  const todos: VoucherLinha[] = [];
  for (let d = 0; d < maximo; d += 1000) {
    const pagina = await vouchersDoPeriodo(municipioId, inicio, fim, 1000, d);
    todos.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return todos;
}
