import "server-only";
import { enviarArquivo, removerArquivo } from "@/lib/arquivos/armazenamento";
import { caminhoNovo } from "@/lib/arquivos/caminhos";
import type { criarClienteServidor } from "@/lib/supabase/servidor";
import { tratarFoto } from "./tratamento";

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>;

const ERRO_ENVIO = "Não foi possível publicar a foto agora. Confira a conexão e tente de novo.";

export type FotoPublicada = { ok: true; caminho: string } | { ok: false; erro: string };

/**
 * Publica uma foto enviada pelo painel (Fase 7.4). O original (envio direto ao bucket privado
 * `originais`, ou o arquivo sem JavaScript) é conferido no servidor, tratado por `tratarFoto`
 * (sem EXIF nem GPS, até 2000 px, WebP) e gravado em `publico/<municipio>/<pasta>/`. O original é
 * apagado em qualquer caso, inclusive quando `antes` recusa (ex.: cadastro com 12 fotos).
 * Só o arquivo tratado chega ao bucket público.
 */
export async function publicarFotoTratada(
  supabase: Cliente,
  municipioId: string,
  pasta: "fotos" | "marca",
  campo: FormDataEntryValue | null,
  antes?: () => Promise<string | null>,
): Promise<FotoPublicada> {
  const envio = await enviarArquivo(supabase, "foto_original", municipioId, pasta, campo);
  if (!envio.ok) return envio;
  try {
    const recusa = antes ? await antes() : null;
    if (recusa) return { ok: false, erro: recusa };
    const baixado = await supabase.storage.from("originais").download(envio.caminho);
    if (baixado.error) return { ok: false, erro: ERRO_ENVIO };
    let tratada;
    try {
      tratada = await tratarFoto(new Uint8Array(await baixado.data.arrayBuffer()));
    } catch {
      return { ok: false, erro: "Não conseguimos abrir esta imagem. Ela pode estar corrompida. Tire a foto de novo ou escolha outra." };
    }
    const caminho = caminhoNovo(municipioId, pasta, tratada.extensao);
    const gravado = await supabase.storage
      .from("publico")
      .upload(caminho, tratada.dados, { contentType: tratada.mime, upsert: false, cacheControl: "31536000" });
    if (gravado.error) return { ok: false, erro: ERRO_ENVIO };
    return { ok: true, caminho };
  } finally {
    await removerArquivo(supabase, "foto_original", envio.caminho);
  }
}
