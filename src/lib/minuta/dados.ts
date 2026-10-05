import "server-only";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { SecaoEditavel } from "./conteudo";

/** Seções escritas pelo responsável para o ano-base (RLS: só gestor do município ou admin). */
export async function buscarTextosMinuta(municipioId: string, ano: number): Promise<Partial<Record<SecaoEditavel, string | null>>> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("minutas_relatorio")
    .select("metodologia, limitacoes, analise, recomendacoes")
    .eq("municipio_id", municipioId)
    .eq("ano_base", ano)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a minuta: ${error.message}`);
  return data ?? {};
}
