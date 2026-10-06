import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CATEGORIAS_ATRATIVO, CATEGORIAS_PRESTADOR, SITUACOES_REDE, STATUS_CONTEUDO } from "./esquemas";

// Leituras com a sessão de quem pede (RLS): o anônimo só recebe conteúdo publicado de
// município ativo; membros do município veem também rascunhos e arquivados.
// Páginas públicas pedem `publicados: true` mesmo assim, para um membro logado ver o
// portal igual ao visitante.

const status = z.enum(STATUS_CONTEUDO);
const chavesDe = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

const esquemaAtrativo = z.object({
  id: z.uuid(),
  nome: z.string(),
  categoria: chavesDe(CATEGORIAS_ATRATIVO),
  descricao: z.string().nullable(),
  endereco: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  horarios: z.string().nullable(),
  contato: z.string().nullable(),
  condicoes_acesso: z.string().nullable(),
  acessibilidade: z.string().nullable(),
  orientacoes_ambientais: z.string().nullable(),
  status,
  atualizado_em: z.string(),
});

const esquemaEvento = z.object({
  id: z.uuid(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  local: z.string().nullable(),
  organizador: z.string().nullable(),
  inicio: z.string(),
  fim: z.string(),
  atrativo_id: z.uuid().nullable(),
  status,
  atualizado_em: z.string(),
  atrativos: z.object({ id: z.uuid(), nome: z.string(), status }).nullable(),
});

const esquemaPrestador = z.object({
  id: z.uuid(),
  nome_publico: z.string(),
  categoria: chavesDe(CATEGORIAS_PRESTADOR),
  servicos: z.string().nullable(),
  descricao: z.string().nullable(),
  contatos_publicos: z.string().nullable(),
  localizacao: z.string().nullable(),
  situacao_rede: chavesDe(SITUACOES_REDE),
  status,
  atualizado_em: z.string(),
});

const esquemaFoto = z.object({
  id: z.uuid(),
  caminho: z.string(),
  legenda: z.string().nullable(),
  credito: z.string().nullable(),
  atrativo_id: z.uuid().nullable(),
  evento_id: z.uuid().nullable(),
  prestador_id: z.uuid().nullable(),
  atividade_id: z.uuid().nullable(),
  ordem: z.number(),
});

const esquemaAdesao = z.object({
  id: z.uuid(),
  data_adesao: z.string(),
  responsavel: z.string(),
  contato_interno: z.string().nullable(),
  observacoes: z.string().nullable(),
  comprovante_caminho: z.string().nullable(),
  criado_em: z.string(),
});

export type Atrativo = z.infer<typeof esquemaAtrativo>;
export type Evento = z.infer<typeof esquemaEvento>;
export type Prestador = z.infer<typeof esquemaPrestador>;
export type Foto = z.infer<typeof esquemaFoto>;
export type Adesao = z.infer<typeof esquemaAdesao>;

const COLUNAS_ATRATIVO =
  "id, nome, categoria, descricao, endereco, latitude, longitude, horarios, contato, condicoes_acesso, acessibilidade, orientacoes_ambientais, status, atualizado_em";
const COLUNAS_EVENTO =
  "id, titulo, descricao, local, organizador, inicio, fim, atrativo_id, status, atualizado_em, atrativos (id, nome, status)";
const COLUNAS_PRESTADOR = "id, nome_publico, categoria, servicos, descricao, contatos_publicos, localizacao, situacao_rede, status, atualizado_em";
const COLUNAS_FOTO = "id, caminho, legenda, credito, atrativo_id, evento_id, prestador_id, atividade_id, ordem";

function falha(o: string, e: { message: string }): never {
  throw new Error(`Falha ao carregar ${o}: ${e.message}`);
}

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

export async function listarAtrativos(municipioId: string, opcoes: { publicados?: boolean } = {}) {
  const supabase = await criarClienteServidor();
  let q = supabase.from("atrativos").select(COLUNAS_ATRATIVO).eq("municipio_id", municipioId);
  if (opcoes.publicados) q = q.eq("status", "publicado");
  const { data, error } = await q.order("nome");
  if (error) falha("atrativos", error);
  return z.array(esquemaAtrativo).parse(data);
}

export async function buscarAtrativo(municipioId: string, id: string, opcoes: { publicado?: boolean } = {}) {
  if (!uuidValido(id)) return null;
  const supabase = await criarClienteServidor();
  let q = supabase.from("atrativos").select(COLUNAS_ATRATIVO).eq("municipio_id", municipioId).eq("id", id);
  if (opcoes.publicado) q = q.eq("status", "publicado");
  const { data, error } = await q.maybeSingle();
  if (error) falha("o atrativo", error);
  return data ? esquemaAtrativo.parse(data) : null;
}

/** Eventos em ordem de início. `aPartirDe`: só os que terminam depois desse instante. */
export async function listarEventos(municipioId: string, opcoes: { publicados?: boolean; aPartirDe?: Date; limite?: number } = {}) {
  const supabase = await criarClienteServidor();
  let q = supabase.from("eventos").select(COLUNAS_EVENTO).eq("municipio_id", municipioId);
  if (opcoes.publicados) q = q.eq("status", "publicado");
  if (opcoes.aPartirDe) q = q.gte("fim", opcoes.aPartirDe.toISOString());
  q = q.order("inicio");
  if (opcoes.limite) q = q.limit(opcoes.limite);
  const { data, error } = await q;
  if (error) falha("eventos", error);
  return z.array(esquemaEvento).parse(data);
}

export async function buscarEvento(municipioId: string, id: string, opcoes: { publicado?: boolean } = {}) {
  if (!uuidValido(id)) return null;
  const supabase = await criarClienteServidor();
  let q = supabase.from("eventos").select(COLUNAS_EVENTO).eq("municipio_id", municipioId).eq("id", id);
  if (opcoes.publicado) q = q.eq("status", "publicado");
  const { data, error } = await q.maybeSingle();
  if (error) falha("o evento", error);
  return data ? esquemaEvento.parse(data) : null;
}

export async function listarPrestadores(municipioId: string, opcoes: { publicados?: boolean } = {}) {
  const supabase = await criarClienteServidor();
  let q = supabase.from("prestadores").select(COLUNAS_PRESTADOR).eq("municipio_id", municipioId);
  // No portal, só quem está na rede ou em adesão: desligados saem da lista pública.
  if (opcoes.publicados) q = q.eq("status", "publicado").neq("situacao_rede", "desligado");
  const { data, error } = await q.order("nome_publico");
  if (error) falha("prestadores", error);
  return z.array(esquemaPrestador).parse(data);
}

export async function buscarPrestador(municipioId: string, id: string, opcoes: { publicado?: boolean } = {}) {
  if (!uuidValido(id)) return null;
  const supabase = await criarClienteServidor();
  let q = supabase.from("prestadores").select(COLUNAS_PRESTADOR).eq("municipio_id", municipioId).eq("id", id);
  // Página pública: só publicado e fora de "desligado", como na lista da rede.
  if (opcoes.publicado) q = q.eq("status", "publicado").neq("situacao_rede", "desligado");
  const { data, error } = await q.maybeSingle();
  if (error) falha("o prestador", error);
  return data ? esquemaPrestador.parse(data) : null;
}

export type DonoFoto = "atrativo_id" | "evento_id" | "prestador_id" | "atividade_id";

/** Fotos de um ou mais conteúdos, em ordem. A RLS esconde do público as de conteúdo não publicado. */
export async function listarFotos(municipioId: string, dono: DonoFoto, ids: string[]) {
  const validos = ids.filter(uuidValido);
  if (!validos.length) return [];
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("fotos")
    .select(COLUNAS_FOTO)
    .eq("municipio_id", municipioId)
    .in(dono, validos)
    .order("ordem")
    .order("criado_em");
  if (error) falha("fotos", error);
  return z.array(esquemaFoto).parse(data);
}

/** Primeira foto de cada conteúdo (para listas e cartões). */
export async function primeiraFotoDe(municipioId: string, dono: DonoFoto, ids: string[]) {
  const mapa = new Map<string, Foto>();
  for (const f of await listarFotos(municipioId, dono, ids)) {
    const id = f[dono];
    if (id && !mapa.has(id)) mapa.set(id, f);
  }
  return mapa;
}

/** Adesões do prestador. Só o gestor do município lê (RLS); para os demais volta vazio. */
export async function listarAdesoes(municipioId: string, prestadorId: string) {
  if (!uuidValido(prestadorId)) return [];
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("adesoes_prestador")
    .select("id, data_adesao, responsavel, contato_interno, observacoes, comprovante_caminho, criado_em")
    .eq("municipio_id", municipioId)
    .eq("prestador_id", prestadorId)
    .order("data_adesao", { ascending: false });
  if (error) falha("adesões", error);
  return z.array(esquemaAdesao).parse(data);
}

/** Quantidade de cadastros por estado, para a tela Conteúdo. */
export async function contarConteudo(municipioId: string) {
  const supabase = await criarClienteServidor();
  const tabelas = ["atrativos", "eventos", "prestadores", "atividades"] as const;
  const resultados = await Promise.all(
    tabelas.map(async (t) => {
      const { data, error } = await supabase.from(t).select("status").eq("municipio_id", municipioId);
      if (error) falha(t, error);
      const linhas = z.array(z.object({ status })).parse(data);
      return [t, { total: linhas.length, publicados: linhas.filter((l) => l.status === "publicado").length, rascunhos: linhas.filter((l) => l.status === "rascunho").length }] as const;
    }),
  );
  return Object.fromEntries(resultados) as Record<(typeof tabelas)[number], { total: number; publicados: number; rascunhos: number }>;
}
