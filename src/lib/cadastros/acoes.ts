"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { enviarArquivo, removerArquivo } from "@/lib/arquivos/armazenamento";
import { instanteLocal } from "@/lib/datas";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  esquemaAdesao,
  esquemaAtrativo,
  esquemaEvento,
  esquemaLegenda,
  esquemaPrestador,
  STATUS_CONTEUDO,
  TIPOS_CADASTRO,
  type TipoCadastro,
} from "./esquemas";

// Todas as actions: município pelo host, papel de gestor (ou admin) conferido aqui e de novo
// pela RLS no banco e nas políticas do Storage. Nenhuma usa a chave service_role.

type Estado = ResultadoAcao | undefined;

const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";
const CORRIJA = "Corrija os campos destacados.";

/** Campos do formulário; ausente vira undefined (o esquema aplica o padrão), vazio vira "". */
function ler(dados: FormData, chaves: string[]) {
  const v: Record<string, unknown> = {};
  for (const k of chaves) {
    const x = dados.get(k);
    v[k] = typeof x === "string" ? x : undefined;
  }
  return v;
}

const CHAVES = {
  atrativos: ["nome", "categoria", "descricao", "endereco", "latitude", "longitude", "horarios", "contato", "condicoes_acesso", "acessibilidade", "orientacoes_ambientais"],
  eventos: ["titulo", "dia_inicio", "hora_inicio", "dia_fim", "hora_fim", "local", "organizador", "descricao", "atrativo_id"],
  prestadores: ["nome_publico", "categoria", "situacao_rede", "servicos", "contatos_publicos", "localizacao"],
} satisfies Record<TipoCadastro, string[]>;

type Validado = { ok: true; linha: Record<string, unknown> } | { ok: false; estado: ResultadoAcao };

/** Valida os campos enviados e devolve só as colunas presentes no formulário. */
function validar(tipo: TipoCadastro, dados: FormData): Validado {
  const entrada = ler(dados, CHAVES[tipo]);
  // Devolvidos no erro: o React reseta o formulário depois da action e o gestor não perde o que digitou.
  const valores = Object.fromEntries(Object.entries(entrada).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const presentes = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => entrada[k] !== undefined));

  if (tipo === "eventos") {
    const r = esquemaEvento.safeParse(entrada);
    if (!r.success) return { ok: false, estado: { ok: false, erro: CORRIJA, campos: errosPorCampo(r.error), valores } };
    const { dia_inicio, hora_inicio, dia_fim, hora_fim, ...resto } = r.data;
    const inicio = instanteLocal(dia_inicio, hora_inicio);
    const fim = instanteLocal(dia_fim, hora_fim);
    if (fim.getTime() - inicio.getTime() > 60 * 86_400_000) {
      return { ok: false, estado: { ok: false, erro: CORRIJA, campos: { dia_fim: "Um evento pode durar no máximo 60 dias." }, valores } };
    }
    return { ok: true, linha: { ...presentes(resto), inicio: inicio.toISOString(), fim: fim.toISOString() } };
  }
  const esquema = tipo === "atrativos" ? esquemaAtrativo : esquemaPrestador;
  const r = esquema.safeParse(entrada);
  if (!r.success) return { ok: false, estado: { ok: false, erro: CORRIJA, campos: errosPorCampo(r.error), valores } };
  return { ok: true, linha: presentes(r.data) };
}

function tipoValido(tipo: string): tipo is TipoCadastro {
  return (TIPOS_CADASTRO as readonly string[]).includes(tipo);
}

function erroDoBanco(error: { code?: string }): string {
  if (error.code === "23503") return "O atrativo escolhido não pertence a este município. Escolha outro.";
  return ERRO_GENERICO;
}

export async function criarCadastro(tipo: TipoCadastro, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  const v = validar(tipo, dados);
  if (!v.ok) return v.estado;

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from(tipo)
    .insert({ ...v.linha, municipio_id: ctx.municipio.id, status: "rascunho" } as never)
    .select("id")
    .single();
  if (error) return { ok: false, erro: erroDoBanco(error) };
  revalidatePath(`/admin/${tipo}`);
  redirect(`/admin/${tipo}/${(data as { id: string }).id}?criado=1`);
}

export async function salvarCadastro(tipo: TipoCadastro, id: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Cadastro não encontrado." };
  const v = validar(tipo, dados);
  if (!v.ok) return v.estado;

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from(tipo)
    .update(v.linha as never)
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, erro: erroDoBanco(error) };
  if (!data.length) return { ok: false, erro: "Cadastro não encontrado neste município." };
  revalidatePath(`/admin/${tipo}/${id}`);
  return { ok: true, aviso: "Alterações salvas." };
}

export async function mudarStatusCadastro(tipo: TipoCadastro, id: string, status: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  const s = z.enum(STATUS_CONTEUDO).safeParse(status);
  if (!s.success || !z.uuid().safeParse(id).success) return { ok: false, erro: "Pedido inválido." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from(tipo)
    .update({ status: s.data })
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, erro: ERRO_GENERICO };
  if (!data.length) return { ok: false, erro: "Cadastro não encontrado neste município." };
  revalidatePath(`/admin/${tipo}/${id}`);
  revalidatePath(`/admin/${tipo}`);
  const avisos = {
    publicado: "Publicado. Já aparece no portal do município.",
    arquivado: "Arquivado. Saiu do portal e continua guardado no painel.",
    rascunho: "Voltou para elaboração e saiu do portal.",
  } as const;
  return { ok: true, aviso: avisos[s.data] };
}

const DONO = { atrativos: "atrativo_id", eventos: "evento_id", prestadores: "prestador_id" } as const;

export async function enviarFoto(tipo: TipoCadastro, donoId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(donoId).success) return { ok: false, erro: "Cadastro não encontrado." };
  const legenda = String(dados.get("legenda") ?? "");
  const l = esquemaLegenda.safeParse({ legenda });
  if (!l.success) return { ok: false, erro: CORRIJA, campos: errosPorCampo(l.error), valores: { legenda } };

  const supabase = await criarClienteServidor();
  const envio = await enviarArquivo(supabase, "foto", ctx.municipio.id, "fotos", dados.get("arquivo"));
  if (!envio.ok) return { ok: false, erro: envio.erro, campos: { arquivo: envio.erro }, valores: { legenda } };

  const { error } = await supabase.from("fotos").insert({
    municipio_id: ctx.municipio.id,
    caminho: envio.caminho,
    legenda: l.data.legenda,
    atrativo_id: DONO[tipo] === "atrativo_id" ? donoId : null,
    evento_id: DONO[tipo] === "evento_id" ? donoId : null,
    prestador_id: DONO[tipo] === "prestador_id" ? donoId : null,
  });
  if (error) {
    await removerArquivo(supabase, "foto", envio.caminho);
    return { ok: false, erro: erroDoBanco(error) };
  }
  revalidatePath(`/admin/${tipo}/${donoId}`);
  return { ok: true, aviso: "Foto enviada." };
}

export async function removerFoto(tipo: TipoCadastro, donoId: string, fotoId: string): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(fotoId).success) return { ok: false, erro: "Foto não encontrada." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("fotos")
    .delete()
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", fotoId)
    .select("caminho");
  if (error || !data.length) return { ok: false, erro: "Foto não encontrada neste município." };
  await removerArquivo(supabase, "foto", data[0].caminho);
  revalidatePath(`/admin/${tipo}/${donoId}`);
  return { ok: true, aviso: "Foto removida." };
}

export async function registrarAdesao(prestadorId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(prestadorId).success) return { ok: false, erro: "Prestador não encontrado." };
  const entrada = ler(dados, ["data_adesao", "responsavel", "contato_interno", "observacoes"]);
  const valores = entrada as Record<string, string>;
  const r = esquemaAdesao.safeParse(entrada);
  if (!r.success) return { ok: false, erro: CORRIJA, campos: errosPorCampo(r.error), valores };

  const supabase = await criarClienteServidor();
  let comprovante: string | null = null;
  const arquivo = dados.get("comprovante");
  if (arquivo instanceof File && arquivo.size > 0) {
    const envio = await enviarArquivo(supabase, "documento", ctx.municipio.id, "adesoes", arquivo);
    if (!envio.ok) return { ok: false, erro: envio.erro, campos: { comprovante: envio.erro }, valores };
    comprovante = envio.caminho;
  }

  const { error } = await supabase.from("adesoes_prestador").insert({
    ...r.data,
    municipio_id: ctx.municipio.id,
    prestador_id: prestadorId,
    comprovante_caminho: comprovante,
  });
  if (error) {
    if (comprovante) await removerArquivo(supabase, "documento", comprovante);
    return { ok: false, erro: error.code === "23503" ? "Prestador não encontrado neste município." : ERRO_GENERICO };
  }
  revalidatePath(`/admin/prestadores/${prestadorId}`);
  return { ok: true, aviso: "Adesão registrada. Esses dados ficam só no painel." };
}
