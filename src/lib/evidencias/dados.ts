import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { TIPOS_ACAO, TIPOS_ARQUIVO } from "./esquemas";

// Leituras com a sessão do usuário: a RLS só entrega evidências ao gestor do município (e ao admin).

const esquemaArquivo = z.object({
  id: z.uuid(),
  tipo: z.enum(TIPOS_ARQUIVO),
  legenda: z.string(),
  mime: z.string(),
  tamanho: z.number(),
  criado_em: z.string(),
});

const esquemaEvidencia = z.object({
  id: z.uuid(),
  ano_base: z.number(),
  tipo_acao: z.enum(TIPOS_ACAO),
  titulo: z.string(),
  descricao: z.string(),
  data_realizacao: z.string(),
  responsavel: z.string(),
  atividade_id: z.uuid().nullable(),
  arquivada: z.boolean(),
  criado_em: z.string(),
  atualizado_em: z.string(),
  atividades: z.object({ titulo: z.string() }).nullable(),
  evidencias_arquivos: z.array(esquemaArquivo),
});

export type ArquivoEvidencia = z.infer<typeof esquemaArquivo>;
export type Evidencia = z.infer<typeof esquemaEvidencia>;

const COLUNAS =
  "id, ano_base, tipo_acao, titulo, descricao, data_realizacao, responsavel, atividade_id, arquivada, criado_em, atualizado_em, " +
  "atividades (titulo), evidencias_arquivos (id, tipo, legenda, mime, tamanho, criado_em)";

/** Evidências do ano-base, mais recentes primeiro. */
export async function listarEvidencias(municipioId: string, ano: number, opcoes: { arquivadas?: boolean } = {}) {
  const supabase = await criarClienteServidor();
  let q = supabase.from("evidencias").select(COLUNAS).eq("municipio_id", municipioId).eq("ano_base", ano);
  if (!opcoes.arquivadas) q = q.eq("arquivada", false);
  const { data, error } = await q
    .order("data_realizacao", { ascending: false })
    .order("criado_em", { ascending: false })
    .order("criado_em", { referencedTable: "evidencias_arquivos" });
  if (error) throw new Error(`Falha ao listar evidências: ${error.message}`);
  return z.array(esquemaEvidencia).parse(data);
}

export async function buscarEvidencia(municipioId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias")
    .select(COLUNAS)
    .eq("municipio_id", municipioId)
    .eq("id", id)
    .order("criado_em", { referencedTable: "evidencias_arquivos" })
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a evidência: ${error.message}`);
  return data ? esquemaEvidencia.parse(data) : null;
}

const esquemaHistorico = z.object({
  id: z.number(),
  em: z.string(),
  autor_nome: z.string().nullable(),
  acao: z.enum(["criada", "editada", "arquivada", "reativada", "arquivo_incluido", "arquivo_removido", "legenda_alterada"]),
  campos: z.array(z.string()),
  antes: z.record(z.string(), z.unknown()).nullable(),
  depois: z.record(z.string(), z.unknown()).nullable(),
});

export type RegistroHistorico = z.infer<typeof esquemaHistorico>;

/** Histórico de alterações da evidência, do mais recente ao mais antigo. */
export async function historicoDaEvidencia(municipioId: string, evidenciaId: string) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias_historico")
    .select("id, em, autor_nome, acao, campos, antes, depois")
    .eq("municipio_id", municipioId)
    .eq("evidencia_id", evidenciaId)
    .order("id", { ascending: false });
  if (error) throw new Error(`Falha ao carregar o histórico: ${error.message}`);
  return z.array(esquemaHistorico).parse(data);
}

/** Quantas evidências ativas do ano-base ainda não têm foto nem anexo (pendência da Visão geral). */
export async function evidenciasSemAnexo(municipioId: string, ano: number) {
  const lista = await listarEvidencias(municipioId, ano);
  return lista.filter((e) => e.evidencias_arquivos.length === 0).length;
}
