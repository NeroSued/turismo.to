import "server-only";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { REGRAS, validarArquivo, type TipoArquivo } from "./validacao";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

export type ResultadoEnvio = { ok: true; caminho: string } | { ok: false; erro: string };

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
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha um arquivo antes de enviar." };
  if (!PASTA.test(pasta)) throw new Error(`Pasta inválida: ${pasta}`);
  const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
  const v = validarArquivo(tipo, arquivo.size, inicio);
  if (!v.ok) return v;

  const caminho = `${municipioId}/${pasta}/${crypto.randomUUID()}.${v.extensao}`;
  const { error } = await supabase.storage
    .from(REGRAS[tipo].bucket)
    .upload(caminho, arquivo, { contentType: v.mime, upsert: false, cacheControl: "31536000" });
  if (error) return { ok: false, erro: "Não foi possível enviar o arquivo agora. Confira a conexão e tente de novo." };
  return { ok: true, caminho };
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
