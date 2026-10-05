/**
 * Validação de uploads no servidor (CLAUDE.md, "Uploads"). O tipo vem dos bytes iniciais do
 * arquivo, não do nome nem do tipo declarado pelo navegador. Os buckets repetem os mesmos
 * limites (migration storage_buckets), então um envio que escape daqui ainda é recusado.
 */

export type TipoArquivo = "foto" | "documento";

export type Mime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const MB = 1024 * 1024;

export const REGRAS: Record<TipoArquivo, { bucket: "publico" | "interno"; tipos: Mime[]; maximo: number; descricao: string }> = {
  foto: { bucket: "publico", tipos: ["image/jpeg", "image/png", "image/webp"], maximo: 5 * MB, descricao: "JPEG, PNG ou WebP até 5 MB" },
  documento: { bucket: "interno", tipos: ["application/pdf", "image/jpeg", "image/png"], maximo: 10 * MB, descricao: "PDF, JPEG ou PNG até 10 MB" },
};

export const EXTENSAO: Record<Mime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Tipo real do arquivo pela assinatura (magic bytes), ou null se não for um dos aceitos. */
export function detectarTipo(b: Uint8Array): Mime | null {
  const ascii = (inicio: number, fim: number) => String.fromCharCode(...b.subarray(inicio, fim));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 5 && ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export type ResultadoValidacao = { ok: true; mime: Mime; extensao: string } | { ok: false; erro: string };

function tamanhoLegivel(bytes: number) {
  return `${(bytes / MB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Confere presença, tamanho e tipo real. `inicio`: os primeiros bytes do arquivo (16 bastam). */
export function validarArquivo(tipo: TipoArquivo, tamanho: number, inicio: Uint8Array): ResultadoValidacao {
  const regra = REGRAS[tipo];
  if (tamanho <= 0) return { ok: false, erro: "Escolha um arquivo antes de enviar." };
  if (tamanho > regra.maximo) {
    return {
      ok: false,
      erro: `O arquivo tem ${tamanhoLegivel(tamanho)} e o limite é ${tamanhoLegivel(regra.maximo)}. Reduza o tamanho e envie de novo.`,
    };
  }
  const mime = detectarTipo(inicio);
  if (!mime || !regra.tipos.includes(mime)) {
    return { ok: false, erro: `Tipo de arquivo não aceito. Envie ${regra.descricao}.` };
  }
  return { ok: true, mime, extensao: EXTENSAO[mime] };
}
