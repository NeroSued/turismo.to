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
      aviso_privacidade: z.string().nullable(),
      referencia_icms: z.string(),
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
    .select("id, slug, nome, ativo, configuracoes_municipio (nome_exibicao, cor_primaria, contato_secretaria, ouvidoria_url, logo_caminho, capa_caminho, aviso_privacidade, referencia_icms)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar o município: ${error.message}`);
  if (!data) return null;
  const m = esquemaMunicipio.parse(data);
  // Portal público só para município ativo, mesmo que um membro logado o enxergue.
  return m.ativo ? m : null;
});

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
