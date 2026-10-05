import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Áreas registradas pelos triggers de auditoria, com rótulo para o filtro "Tipo de ação". */
export const AREAS_AUDITORIA: Record<string, string> = {
  municipios: "Municípios",
  configuracoes_municipio: "Configurações",
  perfis: "Perfis de usuário",
  vinculos: "Equipe e acessos",
  atividades: "Atividades",
  sessoes: "Horários de atividades",
  vouchers: "Vouchers",
  atrativos: "Atrativos",
  eventos: "Eventos",
  prestadores: "Prestadores",
  adesoes_prestador: "Adesões de prestadores",
  fotos: "Fotos do portal",
  evidencias: "Evidências",
  evidencias_arquivos: "Arquivos de evidência",
  minutas_relatorio: "Minuta do relatório",
};

export const OPERACOES_AUDITORIA = { INSERT: "Inclusão", UPDATE: "Alteração", DELETE: "Exclusão" } as const;
export type OperacaoAuditoria = keyof typeof OPERACOES_AUDITORIA;

export const esquemaFiltrosAuditoria = z.object({
  municipio: z.uuid().optional().catch(undefined),
  usuario: z.uuid().optional().catch(undefined),
  inicio: z.iso.date().optional().catch(undefined),
  fim: z.iso.date().optional().catch(undefined),
  area: z.enum(Object.keys(AREAS_AUDITORIA) as [string, ...string[]]).optional().catch(undefined),
  acao: z.enum(["INSERT", "UPDATE", "DELETE"]).optional().catch(undefined),
  antes: z.coerce.number().int().positive().optional().catch(undefined),
});

const esquemaRegistro = z.object({
  id: z.number(),
  em: z.string(),
  usuario_id: z.uuid().nullable(),
  usuario_nome: z.string().nullable(),
  municipio_id: z.uuid().nullable(),
  municipio_nome: z.string().nullable(),
  tabela: z.string(),
  operacao: z.enum(["INSERT", "UPDATE", "DELETE"]),
  registro_id: z.string().nullable(),
  campos: z.array(z.string()),
});

export type RegistroAuditoria = z.infer<typeof esquemaRegistro>;

export const POR_PAGINA = 50;

/** Consulta com a sessão do usuário; a função recusa quem não é gestor do município (ou admin, para "todos"). */
export async function consultarAuditoria(f: {
  municipioId: string | null;
  usuarioId?: string;
  inicio: string;
  fim: string;
  area?: string;
  acao?: OperacaoAuditoria;
  antes?: number;
}) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("auditoria_consultar", {
    // A função aceita município nulo (todos, só para o admin); os tipos gerados não marcam isso.
    p_municipio_id: f.municipioId as string,
    p_usuario_id: (f.usuarioId ?? null) as string,
    p_inicio: f.inicio,
    p_fim: f.fim,
    p_tabela: (f.area ?? null) as string,
    p_operacao: (f.acao ?? null) as string,
    p_antes_de: (f.antes ?? null) as number,
    p_limite: POR_PAGINA,
  });
  if (error) throw new Error(`Falha ao consultar a auditoria: ${error.message}`);
  return z.array(esquemaRegistro).parse(data);
}

export async function pessoasDaAuditoria(municipioId: string | null) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("auditoria_usuarios", { p_municipio_id: municipioId as string });
  if (error) throw new Error(`Falha ao listar as pessoas da auditoria: ${error.message}`);
  return z.array(z.object({ usuario_id: z.uuid(), nome: z.string().nullable() })).parse(data);
}
