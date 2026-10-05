"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { enviarArquivo, removerArquivo } from "@/lib/arquivos/armazenamento";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { esquemaConfiguracoes, IMAGENS_MUNICIPIO, type ImagemMunicipio } from "./esquemas";

// Gestor do município (ou admin), conferido aqui e pela RLS de configuracoes_municipio.

type Estado = ResultadoAcao | undefined;
const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";

export async function salvarConfiguracoes(_: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  const campos = ["nome_exibicao", "cor_primaria", "contato_secretaria", "ouvidoria_url", "aviso_privacidade", "referencia_icms"];
  const valores = Object.fromEntries(campos.map((k) => [k, String(dados.get(k) ?? "")]));
  const r = esquemaConfiguracoes.safeParse(valores);
  if (!r.success) return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error), valores };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("configuracoes_municipio")
    .update(r.data)
    .eq("municipio_id", ctx.municipio.id)
    .select("municipio_id");
  if (error) {
    if (error.code === "23514") return { ok: false, erro: "Algum valor foi recusado pelo banco. Confira a cor e os tamanhos dos textos." };
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (!data.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidatePath("/", "layout");
  return { ok: true, aviso: "Configurações salvas. O portal já mostra os novos dados." };
}

const imagemValida = (v: string): v is ImagemMunicipio => z.enum(["logo", "capa"]).safeParse(v).success;

export async function enviarImagemMunicipio(qual: ImagemMunicipio, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !imagemValida(qual)) return { ok: false, erro: SEM_PERMISSAO };
  const supabase = await criarClienteServidor();
  const envio = await enviarArquivo(supabase, "foto", ctx.municipio.id, "marca", dados.get("arquivo"));
  if (!envio.ok) return { ok: false, erro: envio.erro, campos: { arquivo: envio.erro } };

  const coluna = IMAGENS_MUNICIPIO[qual];
  const anterior = ctx.municipio.configuracoes_municipio?.[coluna] ?? null;
  const { data, error } = await supabase
    .from("configuracoes_municipio")
    .update(qual === "logo" ? { logo_caminho: envio.caminho } : { capa_caminho: envio.caminho })
    .eq("municipio_id", ctx.municipio.id)
    .select("municipio_id");
  if (error || !data.length) {
    await removerArquivo(supabase, "foto", envio.caminho);
    return { ok: false, erro: ERRO_GENERICO };
  }
  if (anterior) await removerArquivo(supabase, "foto", anterior);
  revalidatePath("/", "layout");
  return { ok: true, aviso: qual === "logo" ? "Logo atualizado." : "Foto de capa atualizada." };
}

export async function removerImagemMunicipio(qual: ImagemMunicipio): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !imagemValida(qual)) return { ok: false, erro: SEM_PERMISSAO };
  const coluna = IMAGENS_MUNICIPIO[qual];
  const anterior = ctx.municipio.configuracoes_municipio?.[coluna] ?? null;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("configuracoes_municipio")
    .update(qual === "logo" ? { logo_caminho: null } : { capa_caminho: null })
    .eq("municipio_id", ctx.municipio.id)
    .select("municipio_id");
  if (error || !data.length) return { ok: false, erro: ERRO_GENERICO };
  if (anterior) await removerArquivo(supabase, "foto", anterior);
  revalidatePath("/", "layout");
  return { ok: true, aviso: qual === "logo" ? "Logo removido." : "Foto de capa removida." };
}
