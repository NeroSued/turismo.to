import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { codigoValido, normalizarCodigo } from "./esquemas";

// Operações do painel com a sessão do usuário (RLS + checagem de papel nas funções do banco).
// Nenhuma usa a chave service_role (D8).

export const esquemaConferencia = z.object({
  id: z.uuid(),
  codigo: z.string(),
  status: z.enum(["emitido", "utilizado", "cancelado", "expirado"]),
  origem: z.enum(["publico", "assistida"]),
  atividade: z.string(),
  modo: z.enum(["reserva", "registro_voluntario"]),
  local_encontro: z.string().nullable(),
  data_visita: z.string(),
  sessao_inicio: z.string().nullable(),
  sessao_fim: z.string().nullable(),
  pessoas: z.number(),
  pessoas_atendidas: z.number().nullable(),
  cidade: z.string(),
  uf: z.string(),
  emitido_em: z.string(),
  utilizado_em: z.string().nullable(),
  utilizado_por_nome: z.string().nullable(),
  cancelado_em: z.string().nullable(),
  expirado_em: z.string().nullable(),
  valido_hoje: z.boolean(),
});

export type VoucherConferido = z.infer<typeof esquemaConferencia>;

export const esquemaResultado = z.object({
  resultado: z.enum([
    "encontrado",
    "confirmado",
    "ja_utilizado",
    "cancelado",
    "ja_cancelado",
    "expirado",
    "fora_do_dia",
    "nao_encontrado",
    "outro_municipio",
  ]),
  voucher: esquemaConferencia.optional(),
});

export type ResultadoVoucher = z.infer<typeof esquemaResultado>;

export async function conferirVoucher(municipioId: string, codigo: string): Promise<ResultadoVoucher> {
  if (!codigoValido(codigo)) return { resultado: "nao_encontrado" };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("conferir_voucher", {
    p_municipio_id: municipioId,
    p_codigo: normalizarCodigo(codigo),
  });
  if (error) throw new Error(`Falha ao conferir o voucher: ${error.message}`);
  return esquemaResultado.parse(data);
}
