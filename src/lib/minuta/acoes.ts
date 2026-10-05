"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";

type Estado = ResultadoAcao | undefined;

const texto = z
  .string()
  .trim()
  .max(8000, "Use no máximo 8000 caracteres.")
  .transform((v) => (v === "" ? null : v));

const esquema = z.object({ metodologia: texto, limitacoes: texto, analise: texto, recomendacoes: texto });

/** Salva as seções do responsável na minuta do ano-base (gestor do município ou admin). */
export async function salvarTextosMinuta(ano: number, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.number().int().min(2020).max(2100).safeParse(ano).success) return { ok: false, erro: "Ano-base inválido." };
  const entrada = Object.fromEntries(["metodologia", "limitacoes", "analise", "recomendacoes"].map((k) => [k, String(dados.get(k) ?? "")]));
  const r = esquema.safeParse(entrada);
  if (!r.success) return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error), valores: entrada };

  const supabase = await criarClienteServidor();
  const atualizada = await supabase
    .from("minutas_relatorio")
    .update(r.data)
    .eq("municipio_id", ctx.municipio.id)
    .eq("ano_base", ano)
    .select("ano_base");
  let erro = atualizada.error;
  if (!erro && !atualizada.data?.length) {
    erro = (await supabase.from("minutas_relatorio").insert({ ...r.data, municipio_id: ctx.municipio.id, ano_base: ano })).error;
  }
  if (erro) return { ok: false, erro: "Não foi possível salvar agora. Confira a conexão e tente de novo.", valores: entrada };
  revalidatePath("/admin/relatorios/minuta");
  return { ok: true, aviso: "Seções salvas. Elas já aparecem na minuta abaixo." };
}
