"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removerArquivo } from "@/lib/arquivos/armazenamento";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { publicarFotoTratada } from "./publicacao";
import { DONO_FOTO, LIMITE_FOTOS, tipoFotoValido, type TipoFoto } from "./tipos";

// Fotos de cadastro (Fase 7.3 e 7.4). Município pelo host, papel de gestor conferido aqui e de
// novo pela RLS no banco e pelas políticas do Storage. Nenhuma usa a chave service_role.

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

const ERRO_GENERICO = "Não foi possível salvar as fotos agora. Confira a conexão e tente de novo.";
const CHEIO = `Este cadastro já tem ${LIMITE_FOTOS} fotos, o máximo. Retire uma foto para enviar outra.`;

const caminhoDasFotos = (tipo: TipoFoto, donoId: string) => `/admin/${tipo}/${donoId}/fotos`;

async function fotosDoCadastro(supabase: Cliente, municipioId: string, tipo: TipoFoto, donoId: string) {
  const { data, error } = await supabase
    .from("fotos")
    .select("id, caminho, credito, ordem")
    .eq("municipio_id", municipioId)
    .eq(DONO_FOTO[tipo], donoId)
    .order("ordem")
    .order("criado_em");
  if (error) return null;
  return data;
}

/**
 * Recebe o original que o navegador enviou direto ao bucket privado `originais` (ou o arquivo,
 * sem JavaScript), publica a versão tratada (sem EXIF, até 2000 px) e registra a foto no fim
 * da galeria. O limite de 12 é conferido antes do tratamento e de novo pelo banco.
 */
export async function adicionarFoto(tipo: string, donoId: string, dados: FormData): Promise<ResultadoAcao> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoFotoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(donoId).success) return { ok: false, erro: "Cadastro não encontrado." };
  const supabase = await criarClienteServidor();
  const municipioId = ctx.municipio.id;

  let atuais: Awaited<ReturnType<typeof fotosDoCadastro>> = null;
  const publicada = await publicarFotoTratada(supabase, municipioId, "fotos", dados.get("arquivo"), async () => {
    atuais = await fotosDoCadastro(supabase, municipioId, tipo, donoId);
    if (!atuais) return ERRO_GENERICO;
    return atuais.length >= LIMITE_FOTOS ? CHEIO : null;
  });
  if (!publicada.ok) return publicada;
  const existentes: { credito: string | null }[] = atuais ?? [];

  const { error } = await supabase.from("fotos").insert({
    municipio_id: municipioId,
    caminho: publicada.caminho,
    // Mesmo crédito das fotos que já estão no cadastro (um campo para todas, como na tela).
    credito: existentes.find((f) => f.credito)?.credito ?? null,
    atrativo_id: tipo === "atrativos" ? donoId : null,
    evento_id: tipo === "eventos" ? donoId : null,
    prestador_id: tipo === "prestadores" ? donoId : null,
    atividade_id: tipo === "atividades" ? donoId : null,
  });
  if (error) {
    await removerArquivo(supabase, "foto", publicada.caminho);
    if (error.message.includes("limite_fotos")) return { ok: false, erro: CHEIO };
    if (error.code === "23503") return { ok: false, erro: "Cadastro não encontrado neste município." };
    return { ok: false, erro: ERRO_GENERICO };
  }

  revalidatePath(caminhoDasFotos(tipo, donoId));
  return { ok: true, aviso: "Foto enviada. A localização GPS e os demais dados da câmera foram removidos." };
}

const esquemaLegenda = z
  .string()
  .trim()
  .max(200, "Use no máximo 200 caracteres na legenda.")
  .refine((v) => v === "" || v.length >= 3, "Escreva a legenda com pelo menos 3 letras, ou deixe em branco.")
  .transform((v) => (v === "" ? null : v));

const esquemaCredito = z
  .string()
  .trim()
  .max(120, "Use no máximo 120 caracteres no crédito.")
  .refine((v) => v === "" || v.length >= 2, "Escreva o crédito com pelo menos 2 letras, ou deixe em branco.")
  .transform((v) => (v === "" ? null : v));

const esquemaOperacao = z
  .string()
  .regex(/^(salvar|(capa|subir|descer|retirar):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);

type Estado = ResultadoAcao | undefined;

/**
 * Formulário da tela de fotos: grava legendas e crédito e, se um dos botões da foto foi usado,
 * executa a operação (tornar capa, subir, descer ou retirar). Assim nada do que foi digitado
 * se perde ao reordenar, e a tela funciona sem JavaScript.
 */
export async function salvarFotos(tipo: string, donoId: string, _: Estado, dados: FormData): Promise<Estado> {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx || !tipoFotoValido(tipo)) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(donoId).success) return { ok: false, erro: "Cadastro não encontrado." };
  const op = esquemaOperacao.safeParse(dados.get("operacao") ?? "salvar");
  if (!op.success) return { ok: false, erro: "Pedido inválido. Recarregue a página e tente de novo." };

  const supabase = await criarClienteServidor();
  const municipioId = ctx.municipio.id;
  const fotos = await fotosDoCadastro(supabase, municipioId, tipo, donoId);
  if (!fotos) return { ok: false, erro: ERRO_GENERICO };

  const valores: Record<string, string> = {};
  const campos: Record<string, string> = {};
  const legendas = new Map<string, string | null>();
  for (const f of fotos) {
    const bruto = dados.get(`legenda:${f.id}`);
    if (typeof bruto !== "string") continue;
    valores[`legenda:${f.id}`] = bruto;
    const r = esquemaLegenda.safeParse(bruto);
    if (r.success) legendas.set(f.id, r.data);
    else campos[`legenda:${f.id}`] = r.error.issues[0].message;
  }
  const creditoBruto = String(dados.get("credito") ?? "");
  valores.credito = creditoBruto;
  const credito = esquemaCredito.safeParse(creditoBruto);
  if (!credito.success) campos.credito = credito.error.issues[0].message;
  if (!credito.success || Object.keys(campos).length) {
    return { ok: false, erro: "Corrija os campos destacados.", campos, valores };
  }

  for (const f of fotos) {
    const mudanca: { legenda?: string | null; credito: string | null } = { credito: credito.data };
    if (legendas.has(f.id)) mudanca.legenda = legendas.get(f.id) ?? null;
    const { error } = await supabase.from("fotos").update(mudanca).eq("municipio_id", municipioId).eq("id", f.id);
    if (error) return { ok: false, erro: ERRO_GENERICO, valores };
  }

  let aviso = "Fotos salvas.";
  if (op.data !== "salvar") {
    const [acao, fotoId] = op.data.split(":") as ["capa" | "subir" | "descer" | "retirar", string];
    const indice = fotos.findIndex((f) => f.id === fotoId);
    if (indice < 0) return { ok: false, erro: "Foto não encontrada neste cadastro." };
    if (acao === "retirar") {
      const { data, error } = await supabase
        .from("fotos")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("id", fotoId)
        .select("caminho");
      if (error || !data.length) return { ok: false, erro: "Foto não encontrada neste cadastro." };
      await removerArquivo(supabase, "foto", data[0].caminho);
      aviso = indice === 0 ? "Foto retirada. A próxima da galeria virou a capa." : "Foto retirada.";
    } else {
      const destino = Math.max(0, acao === "capa" ? 0 : acao === "subir" ? indice - 1 : indice + 1);
      const { error } = await supabase.rpc("posicionar_foto", { p_foto: fotoId, p_posicao: destino });
      if (error) return { ok: false, erro: ERRO_GENERICO };
      aviso = destino === 0 ? "Capa trocada." : `Foto movida para a posição ${destino + 1}.`;
    }
  }
  revalidatePath(caminhoDasFotos(tipo, donoId));
  return { ok: true, aviso };
}
