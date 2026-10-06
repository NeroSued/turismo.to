import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { autorizarEnvio } from "./acoes";
import { PREFIXO_ENVIADO, PREFIXO_FALHOU, PREFIXO_RECUSADO, paraHex, type Pasta } from "./caminhos";
import type { TipoArquivo } from "./validacao";

/**
 * No navegador, antes de chamar a action: troca o arquivo do campo pelo caminho dele no
 * Storage, enviado direto ao Supabase com uma URL assinada (autorizarEnvio). Assim o
 * arquivo não passa pela Vercel, que recusa requisições acima de 4,5 MB. Se a autorização
 * recusar, o campo leva só o tamanho e os bytes iniciais, e a action devolve o mesmo erro.
 */
export async function enviarDireto(
  dados: FormData,
  campo: string,
  tipo: TipoArquivo,
  pasta: Pasta,
  municipioId?: string,
): Promise<FormData> {
  const arquivo = dados.get(campo);
  if (!(arquivo instanceof File) || arquivo.size === 0) return dados;
  const inicio = paraHex(new Uint8Array(await arquivo.slice(0, 16).arrayBuffer()));
  const novo = new FormData();
  for (const [k, v] of dados) if (k !== campo) novo.append(k, v);

  const a = await autorizarEnvio({ municipioId, tipo, pasta, tamanho: arquivo.size, inicio });
  if (!a.ok) {
    novo.set(campo, `${PREFIXO_RECUSADO}${arquivo.size}:${inicio}`);
    return novo;
  }
  const { error } = await criarClienteNavegador()
    .storage.from(a.bucket)
    .uploadToSignedUrl(a.caminho, a.token, arquivo, { contentType: a.mime, cacheControl: "31536000" });
  novo.set(campo, error ? PREFIXO_FALHOU : `${PREFIXO_ENVIADO}${a.caminho}`);
  return novo;
}
