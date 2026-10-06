import sharp from "sharp";

/** Maior lado da foto publicada, em pixels (Fase 7.4). */
export const LADO_MAXIMO = 2000;

export type FotoTratada = { dados: Buffer; largura: number; altura: number; mime: "image/webp"; extensao: "webp" };

/**
 * Versão publicável de uma foto enviada pelo celular (Fase 7.4):
 *   * gira conforme a orientação gravada pela câmera e descarta todos os metadados (EXIF,
 *     inclusive a localização GPS, XMP, IPTC e perfil de cor, convertendo para sRGB);
 *   * reduz para no máximo 2000 px no lado maior, sem ampliar fotos menores;
 *   * grava em WebP com qualidade 82, bem menor que o original.
 * O sharp só copia metadados quando pedido (keepMetadata/withMetadata), e aqui nunca é pedido.
 * Imagem corrompida, animada ou grande demais (bomba de descompressão) lança erro.
 */
export async function tratarFoto(original: Uint8Array): Promise<FotoTratada> {
  const { data, info } = await sharp(original, { failOn: "error", limitInputPixels: 100_000_000, animated: false })
    .rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { dados: data, largura: info.width, altura: info.height, mime: "image/webp", extensao: "webp" };
}

/** Texto alternativo da foto: a legenda ou, sem ela, "Foto N de <nome>" (N começa em 1). */
export function textoAlternativo(legenda: string | null | undefined, indice: number, nome: string): string {
  const l = legenda?.trim();
  return l ? l : `Foto ${indice + 1} de ${nome}`;
}
