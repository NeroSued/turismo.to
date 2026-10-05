import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const esquemaSessaoLinha = z.object({
  id: z.uuid(),
  inicio: z.string(),
  fim: z.string(),
  capacidade_pessoas: z.number().nullable(),
  pessoas_reservadas: z.number(),
  ativa: z.boolean(),
});

const esquemaAtividadeLinha = z.object({
  id: z.uuid(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  local_encontro: z.string().nullable(),
  condicoes: z.string().nullable(),
  modo: z.enum(["reserva", "registro_voluntario"]),
  status: z.enum(["rascunho", "publicado", "arquivado"]),
  exige_responsavel: z.boolean(),
  exige_contato: z.boolean(),
  max_pessoas_por_voucher: z.number(),
  prestador_id: z.uuid().nullable(),
  atualizado_em: z.string(),
});

export type AtividadeLinha = z.infer<typeof esquemaAtividadeLinha>;
export type SessaoLinha = z.infer<typeof esquemaSessaoLinha>;

const COLUNAS_ATIVIDADE =
  "id, titulo, descricao, local_encontro, condicoes, modo, status, exige_responsavel, exige_contato, max_pessoas_por_voucher, prestador_id, atualizado_em";

/** Atividades do município (RLS: membros veem todas; o público só as publicadas). */
export async function listarAtividades(municipioId: string, apenasPublicadas = false) {
  const supabase = await criarClienteServidor();
  let q = supabase.from("atividades").select(COLUNAS_ATIVIDADE).eq("municipio_id", municipioId);
  if (apenasPublicadas) q = q.eq("status", "publicado");
  const { data, error } = await q.order("titulo");
  if (error) throw new Error(`Falha ao listar atividades: ${error.message}`);
  return z.array(esquemaAtividadeLinha).parse(data);
}

export async function buscarAtividade(municipioId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("atividades")
    .select(COLUNAS_ATIVIDADE)
    .eq("municipio_id", municipioId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a atividade: ${error.message}`);
  return data ? esquemaAtividadeLinha.parse(data) : null;
}

/** Sessões da atividade, em ordem. `futuras`: só as que ainda não começaram e estão ativas. */
export async function listarSessoes(municipioId: string, atividadeId: string, opcoes: { futuras?: boolean } = {}) {
  const supabase = await criarClienteServidor();
  let q = supabase
    .from("sessoes")
    .select("id, inicio, fim, capacidade_pessoas, pessoas_reservadas, ativa")
    .eq("municipio_id", municipioId)
    .eq("atividade_id", atividadeId);
  if (opcoes.futuras) q = q.eq("ativa", true).gt("inicio", new Date().toISOString());
  const { data, error } = await q.order("inicio");
  if (error) throw new Error(`Falha ao listar sessões: ${error.message}`);
  return z.array(esquemaSessaoLinha).parse(data);
}

/** Sessões de hoje (todas as atividades), para a visão geral do painel. */
export async function listarSessoesDoPeriodo(municipioId: string, inicio: Date, fim: Date) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, inicio, fim, capacidade_pessoas, pessoas_reservadas, ativa, atividades (titulo)")
    .eq("municipio_id", municipioId)
    .eq("ativa", true)
    .gte("inicio", inicio.toISOString())
    .lt("inicio", fim.toISOString())
    .order("inicio");
  if (error) throw new Error(`Falha ao listar sessões: ${error.message}`);
  return z
    .array(esquemaSessaoLinha.extend({ atividades: z.object({ titulo: z.string() }).nullable() }))
    .parse(data);
}
