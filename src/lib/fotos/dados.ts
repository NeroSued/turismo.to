import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CADASTRO_FOTO, type TipoFoto } from "./tipos";

/** Nome do cadastro dono das fotos, ou null se não existir neste município (RLS confere o resto). */
export async function nomeDoCadastro(municipioId: string, tipo: TipoFoto, id: string): Promise<string | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await criarClienteServidor();
  const coluna = CADASTRO_FOTO[tipo].coluna;
  const { data, error } = await supabase.from(tipo).select(coluna).eq("municipio_id", municipioId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar o cadastro: ${error.message}`);
  if (!data) return null;
  return z.record(z.string(), z.string()).parse(data)[coluna] ?? null;
}
