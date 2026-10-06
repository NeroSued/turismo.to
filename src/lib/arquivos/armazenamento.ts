import "server-only";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  PREFIXO_ENVIADO,
  PREFIXO_FALHOU,
  PREFIXO_RECUSADO,
  caminhoDoMunicipio,
  caminhoNovo,
  deHex,
} from "./caminhos";
import { REGRAS, validarArquivo, type Mime, type TipoArquivo } from "./validacao";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

/** Caminho no Storage, com o tamanho e o tipo real conferidos no servidor. */
export type ResultadoEnvio = { ok: true; caminho: string; tamanho: number; mime: Mime } | { ok: false; erro: string };

const PASTA = /^[a-z][a-z0-9-]{1,30}$/;

/**
 * Valida e envia um arquivo com a sessão do usuário: a política do Storage confere que ele é
 * gestor do município da pasta. Nome gerado aqui (UUID), nunca o nome enviado pelo navegador.
 */
export async function enviarArquivo(
  supabase: Cliente,
  tipo: TipoArquivo,
  municipioId: string,
  pasta: string,
  arquivo: unknown,
): Promise<ResultadoEnvio> {
  if (!PASTA.test(pasta)) throw new Error(`Pasta inválida: ${pasta}`);
  if (typeof arquivo === "string" && arquivo) return conferirEnvioDireto(supabase, tipo, municipioId, pasta, arquivo);
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha um arquivo antes de enviar." };
  const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
  const v = validarArquivo(tipo, arquivo.size, inicio);
  if (!v.ok) return v;

  const caminho = caminhoNovo(municipioId, pasta, v.extensao);
  const { error } = await supabase.storage
    .from(REGRAS[tipo].bucket)
    .upload(caminho, arquivo, { contentType: v.mime, upsert: false, cacheControl: "31536000" });
  if (error) return { ok: false, erro: FALHA_ENVIO };
  return { ok: true, caminho, tamanho: arquivo.size, mime: v.mime };
}

const FALHA_ENVIO = "Não foi possível enviar o arquivo agora. Confira a conexão e tente de novo.";

/**
 * Arquivo que o navegador enviou direto ao Storage (envio-direto.ts). Nada do que o navegador
 * diz é aceito: o caminho tem de ser deste município e pasta, e o tamanho e o tipo real são
 * lidos do próprio Storage (bytes iniciais por Range). Arquivo fora da regra é apagado.
 */
async function conferirEnvioDireto(
  supabase: Cliente,
  tipo: TipoArquivo,
  municipioId: string,
  pasta: string,
  valor: string,
): Promise<ResultadoEnvio> {
  if (valor.startsWith(PREFIXO_RECUSADO)) {
    const [tamanho, inicio] = valor.slice(PREFIXO_RECUSADO.length).split(":");
    const v = validarArquivo(tipo, Number(tamanho) || 0, deHex(inicio ?? ""));
    return v.ok ? { ok: false, erro: FALHA_ENVIO } : v;
  }
  if (valor.startsWith(PREFIXO_FALHOU) || !valor.startsWith(PREFIXO_ENVIADO)) return { ok: false, erro: FALHA_ENVIO };
  const caminho = valor.slice(PREFIXO_ENVIADO.length);
  if (!caminhoDoMunicipio(caminho, municipioId, pasta)) return { ok: false, erro: FALHA_ENVIO };

  const bucket = REGRAS[tipo].bucket;
  const assinada = await supabase.storage.from(bucket).createSignedUrl(caminho, 60);
  if (assinada.error) return { ok: false, erro: FALHA_ENVIO };
  const r = await fetch(assinada.data.signedUrl, { headers: { range: "bytes=0-15" }, cache: "no-store" });
  const total = Number(/\/(\d+)$/.exec(r.headers.get("content-range") ?? "")?.[1] ?? r.headers.get("content-length") ?? 0);
  const inicio = new Uint8Array(await r.arrayBuffer()).subarray(0, 16);
  const v = r.ok ? validarArquivo(tipo, total, inicio) : ({ ok: false, erro: FALHA_ENVIO } as const);
  const extensao = caminho.split(".").pop();
  if (!v.ok || v.extensao !== extensao) {
    await removerArquivo(supabase, tipo, caminho);
    return v.ok ? { ok: false, erro: FALHA_ENVIO } : v;
  }
  return { ok: true, caminho, tamanho: total, mime: v.mime };
}

/** Remove um arquivo (melhor esforço: o registro no banco já foi apagado). */
export async function removerArquivo(supabase: Cliente, tipo: TipoArquivo, caminho: string) {
  await supabase.storage.from(REGRAS[tipo].bucket).remove([caminho]);
}

/** URL assinada de curta duração para um arquivo do bucket interno (a política confere o gestor). */
export async function urlAssinadaInterna(supabase: Cliente, caminho: string, segundos = 60): Promise<string | null> {
  const { data, error } = await supabase.storage.from("interno").createSignedUrl(caminho, segundos);
  return error ? null : data.signedUrl;
}
