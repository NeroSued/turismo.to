import "server-only";
import { cache } from "react";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { slugValido } from "./resolver";

const esquemaMunicipio = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
  configuracoes_municipio: z
    .object({
      nome_exibicao: z.string().nullable(),
      cor_primaria: z.string(),
      contato_secretaria: z.string().nullable(),
      ouvidoria_url: z.string().nullable(),
      logo_caminho: z.string().nullable(),
      capa_caminho: z.string().nullable(),
      apresentacao: z.string().nullable(),
      aviso_privacidade: z.string().nullable(),
      referencia_icms: z.string(),
      dias_anonimizacao: z.number().int(),
    })
    .nullable(),
});

export type Municipio = z.infer<typeof esquemaMunicipio>;

/**
 * Município pelo slug, com a sessão do visitante ou usuário (RLS): anônimo só
 * enxerga municípios ativos. null quando não existe ou não é visível.
 */
export const buscarMunicipioPorSlug = cache(async (slug: string): Promise<Municipio | null> => {
  if (!slugValido(slug)) return null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("municipios")
    .select("id, slug, nome, ativo, configuracoes_municipio (nome_exibicao, cor_primaria, contato_secretaria, ouvidoria_url, logo_caminho, capa_caminho, apresentacao, aviso_privacidade, referencia_icms, dias_anonimizacao)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar o município: ${error.message}`);
  if (!data) return null;
  const m = esquemaMunicipio.parse(data);
  // Portal público só para município ativo, mesmo que um membro logado o enxergue.
  return m.ativo ? m : null;
});

const COLUNAS_MUNICIPIO =
  "id, slug, nome, ativo, configuracoes_municipio (nome_exibicao, cor_primaria, contato_secretaria, ouvidoria_url, logo_caminho, capa_caminho, apresentacao, aviso_privacidade, referencia_icms, dias_anonimizacao)";

/**
 * Município pelo id, mesmo inativo, para o painel (RLS: inativo só aparece para membros e admin).
 * Quem chama confere o papel; a RLS confere de novo em cada gravação.
 */
export const buscarMunicipioPorId = cache(async (id: string): Promise<Municipio | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("municipios").select(COLUNAS_MUNICIPIO).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar o município: ${error.message}`);
  return data ? esquemaMunicipio.parse(data) : null;
});

/** Todos os municípios que a sessão enxerga (o admin vê também os inativos). */
export async function listarMunicipiosDoPainel() {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("municipios").select("id, slug, nome, ativo").order("nome");
  if (error) throw new Error(`Falha ao listar os municípios: ${error.message}`);
  return z.array(z.object({ id: z.uuid(), slug: z.string(), nome: z.string(), ativo: z.boolean() })).parse(data);
}

export const listarMunicipiosAtivos = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("municipios")
    .select("slug, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(`Falha ao listar os municípios: ${error.message}`);
  return z.array(z.object({ slug: z.string(), nome: z.string() })).parse(data);
});

/**
 * Cards da home turismo.to (item 9.1): municípios ativos com capa, frase de apresentação e a
 * contagem real do que está publicado. Leitura anônima pela RLS (só publicado de município ativo).
 */
export const listarMunicipiosDaHome = cache(async () => {
  const supabase = await criarClienteServidor();
  const [municipios, atrativos, atividades] = await Promise.all([
    supabase.from("municipios").select("id, slug, nome, configuracoes_municipio (capa_caminho, apresentacao)").eq("ativo", true).order("nome"),
    supabase.from("atrativos").select("municipio_id").eq("status", "publicado"),
    supabase.from("atividades").select("municipio_id").eq("status", "publicado"),
  ]);
  for (const r of [municipios, atrativos, atividades]) if (r.error) throw new Error(`Falha ao montar a home: ${r.error.message}`);
  const contar = (linhas: unknown) => {
    const mapa = new Map<string, number>();
    for (const { municipio_id } of z.array(z.object({ municipio_id: z.uuid() })).parse(linhas)) mapa.set(municipio_id, (mapa.get(municipio_id) ?? 0) + 1);
    return mapa;
  };
  const nAtrativos = contar(atrativos.data);
  const nAtividades = contar(atividades.data);
  return z
    .array(
      z.object({
        id: z.uuid(),
        slug: z.string(),
        nome: z.string(),
        configuracoes_municipio: z.object({ capa_caminho: z.string().nullable(), apresentacao: z.string().nullable() }).nullable(),
      }),
    )
    .parse(municipios.data)
    .map((m) => ({
      slug: m.slug,
      nome: m.nome,
      capa: m.configuracoes_municipio?.capa_caminho ?? null,
      apresentacao: m.configuracoes_municipio?.apresentacao ?? null,
      atrativos: nAtrativos.get(m.id) ?? 0,
      atividades: nAtividades.get(m.id) ?? 0,
    }));
});
