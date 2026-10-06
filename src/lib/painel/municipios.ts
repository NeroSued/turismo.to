import "server-only";
import { z } from "zod";
import type { Papel } from "@/lib/auth/acesso";
import { listarMunicipiosAtivos } from "@/lib/municipio/dados";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type MunicipioDaTroca = { slug: string; nome: string };

/**
 * Municípios para o seletor do cabeçalho do painel (Fase 7.2): o admin vê todos os ativos;
 * gestor e operador, só os ativos em que têm vínculo ativo (a RLS de `vinculos` mostra só as
 * linhas da própria pessoa). O seletor é só um atalho: o painel de destino confere o vínculo.
 */
export async function municipiosParaTrocar(userId: string, papel: Papel): Promise<MunicipioDaTroca[]> {
  if (papel === "admin") return listarMunicipiosAtivos();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("vinculos")
    .select("municipios (slug, nome, ativo)")
    .eq("user_id", userId)
    .eq("ativo", true);
  if (error) throw new Error(`Falha ao listar os vínculos: ${error.message}`);
  const linhas = z
    .array(z.object({ municipios: z.object({ slug: z.string(), nome: z.string(), ativo: z.boolean() }).nullable() }))
    .parse(data);
  return linhas
    .flatMap((l) => (l.municipios?.ativo ? [{ slug: l.municipios.slug, nome: l.municipios.nome }] : []))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
