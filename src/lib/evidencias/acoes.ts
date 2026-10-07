"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { enviarArquivo, removerArquivo } from "@/lib/arquivos/armazenamento";
import { hojeLocal } from "@/lib/datas";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { esquemaArquivoEvidencia, esquemaEvidencia } from "./esquemas";

// Município pelo host e papel de gestor (ou admin) conferidos aqui e de novo pela RLS e pelas
// políticas do Storage. Autoria, horários e histórico são gravados pelo banco (triggers).

type Estado = ResultadoAcao | undefined;

const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";
const CORRIJA = "Corrija os campos destacados.";
const CAMPOS = ["tipo_acao", "titulo", "descricao", "data_realizacao", "responsavel", "ano_base", "atividade_id"];

function validar(dados: FormData) {
  const entrada = Object.fromEntries(CAMPOS.map((k) => [k, String(dados.get(k) ?? "")]));
  const r = esquemaEvidencia(hojeLocal()).safeParse(entrada);
  return { entrada, r };
}

function erroDoBanco(error: { code?: string; message?: string }): ResultadoAcao {
  if (error.code === "23503") return { ok: false, erro: "A atividade escolhida não pertence a este município. Escolha outra." };
  if (error.message?.includes("data_futura")) {
    return { ok: false, erro: CORRIJA, campos: { data_realizacao: "A data de realização não pode ser no futuro." } };
  }
  return { ok: false, erro: ERRO_GENERICO };
}

export async function criarEvidencia(_: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  const { entrada, r } = validar(dados);
  if (!r.success) return { ok: false, erro: CORRIJA, campos: errosPorCampo(r.error), valores: entrada };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias")
    .insert({ ...r.data, municipio_id: ctx.municipio.id })
    .select("id")
    .single();
  if (error) return { ...erroDoBanco(error), valores: entrada } as ResultadoAcao;
  revalidatePath("/admin/evidencias");
  redirect(`/admin/evidencias/${data.id}?criada=1`);
}

export async function salvarEvidencia(id: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Evidência não encontrada." };
  const { entrada, r } = validar(dados);
  if (!r.success) return { ok: false, erro: CORRIJA, campos: errosPorCampo(r.error), valores: entrada };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias")
    .update(r.data)
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) return { ...erroDoBanco(error), valores: entrada } as ResultadoAcao;
  if (!data.length) return { ok: false, erro: "Evidência não encontrada neste município." };
  revalidatePath(`/admin/evidencias/${id}`);
  revalidatePath("/admin/evidencias");
  return { ok: true, aviso: "Alterações salvas." };
}

export async function arquivarEvidencia(id: string, arquivar: boolean): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Evidência não encontrada." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias")
    .update({ arquivada: arquivar })
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, erro: ERRO_GENERICO };
  if (!data.length) return { ok: false, erro: "Evidência não encontrada neste município." };
  revalidatePath(`/admin/evidencias/${id}`);
  revalidatePath("/admin/evidencias");
  return {
    ok: true,
    aviso: arquivar
      ? "Evidência arquivada. Saiu da lista e da minuta."
      : "Evidência reativada.",
  };
}

export async function enviarArquivoEvidencia(evidenciaId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(evidenciaId).success) return { ok: false, erro: "Evidência não encontrada." };
  const valores = { tipo: String(dados.get("tipo") ?? ""), legenda: String(dados.get("legenda") ?? "") };
  const l = esquemaArquivoEvidencia.safeParse(valores);
  if (!l.success) return { ok: false, erro: CORRIJA, campos: errosPorCampo(l.error), valores };

  const tipoArquivo = l.data.tipo === "foto" ? "foto_interna" : "documento";
  const arquivo = dados.get("arquivo");
  const supabase = await criarClienteServidor();
  const envio = await enviarArquivo(supabase, tipoArquivo, ctx.municipio.id, "evidencias", arquivo);
  if (!envio.ok) return { ok: false, erro: envio.erro, campos: { arquivo: envio.erro }, valores };

  const { error } = await supabase.from("evidencias_arquivos").insert({
    municipio_id: ctx.municipio.id,
    evidencia_id: evidenciaId,
    tipo: l.data.tipo,
    caminho: envio.caminho,
    legenda: l.data.legenda,
    mime: envio.mime,
    tamanho: envio.tamanho,
  });
  if (error) {
    await removerArquivo(supabase, tipoArquivo, envio.caminho);
    return { ok: false, erro: error.code === "23503" ? "Evidência não encontrada neste município." : ERRO_GENERICO, valores };
  }
  revalidatePath(`/admin/evidencias/${evidenciaId}`);
  return { ok: true, aviso: l.data.tipo === "foto" ? "Foto enviada." : "Anexo enviado." };
}

/** Gestor retira o arquivo da evidência: sai da tela e da minuta, mas fica guardado (item 4.5). */
export async function removerArquivoEvidencia(evidenciaId: string, arquivoId: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(arquivoId).success) return { ok: false, erro: "Arquivo não encontrado." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("evidencias_arquivos")
    .update({ retirado: true })
    .eq("municipio_id", ctx.municipio.id)
    .eq("evidencia_id", evidenciaId)
    .eq("id", arquivoId)
    .eq("retirado", false)
    .select("id");
  if (error || !data.length) return { ok: false, erro: "Arquivo não encontrado neste município." };
  revalidatePath(`/admin/evidencias/${evidenciaId}`);
  return {
    ok: true,
    aviso: "Arquivo retirado da evidência. Continua guardado no histórico.",
  };
}

const esquemaMotivo = z
  .string()
  .trim()
  .min(10, { error: "Descreva o motivo em pelo menos 10 caracteres." })
  .max(500, { error: "Use até 500 caracteres." });

const ERROS_LGPD: Record<string, string> = {
  sem_permissao: SEM_PERMISSAO,
  motivo_invalido: "Descreva o motivo em 10 a 500 caracteres.",
  arquivo_inexistente: "Arquivo não encontrado. Ele pode já ter sido excluído.",
  arquivo_ainda_no_storage: "O arquivo não pôde ser apagado do armazenamento. Tente de novo em alguns minutos.",
};

/**
 * Exclusão definitiva a pedido do titular (LGPD, item 4.5). Só o admin da assessoria, com a própria
 * sessão: apaga o objeto do Storage (a política só deixa o admin apagar arquivo de evidência) e depois
 * a função do banco confere que ele sumiu, registra quem, quando e o motivo e apaga a linha.
 * Nenhuma cópia do arquivo é guardada.
 */
export async function excluirArquivoEvidenciaLgpd(evidenciaId: string, arquivoId: string, motivo: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["admin"]);
  if (!ctx || ctx.papel !== "admin") return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(evidenciaId).success || !z.uuid().safeParse(arquivoId).success) return { ok: false, erro: "Arquivo não encontrado." };
  const m = esquemaMotivo.safeParse(motivo);
  if (!m.success) return { ok: false, erro: m.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { data: arquivo } = await supabase
    .from("evidencias_arquivos")
    .select("caminho")
    .eq("municipio_id", ctx.municipio.id)
    .eq("evidencia_id", evidenciaId)
    .eq("id", arquivoId)
    .maybeSingle();
  if (!arquivo) return { ok: false, erro: ERROS_LGPD.arquivo_inexistente };

  const remocao = await supabase.storage.from("interno").remove([arquivo.caminho]);
  if (remocao.error) return { ok: false, erro: ERROS_LGPD.arquivo_ainda_no_storage };

  const { error } = await supabase.rpc("excluir_arquivo_evidencia_lgpd", { p_arquivo_id: arquivoId, p_motivo: m.data });
  if (error) {
    const chave = Object.keys(ERROS_LGPD).find((k) => error.message.includes(k));
    return { ok: false, erro: chave ? ERROS_LGPD[chave] : ERRO_GENERICO };
  }
  revalidatePath(`/admin/evidencias/${evidenciaId}`);
  return { ok: true, aviso: "Arquivo excluído definitivamente." };
}
