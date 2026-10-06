import { deflateSync } from "node:zlib";

// Arquivos de teste gerados na hora (nenhuma foto real no repositório).

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(b: Buffer) {
  let c = 0xffffffff;
  for (const x of b) c = TABELA_CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer) {
  const t = Buffer.from(tipo, "ascii");
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tamanho, t, dados, crc]);
}

/** PNG válido de cor sólida (RGB), decodificável pelo otimizador de imagens. */
export function pngSolido(largura: number, altura: number, [r, g, b]: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  const linha = Buffer.alloc(1 + largura * 3);
  for (let x = 0; x < largura; x++) linha.set([r, g, b], 1 + x * 3);
  const bruto = Buffer.concat(Array.from({ length: altura }, () => linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(bruto)),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * PNG com ruído (não comprime), como uma foto de verdade: a versão AVIF/WebP do otimizador
 * de imagens fica menor que o original. Com uma cor só, o PNG já é menor que qualquer AVIF e
 * o otimizador da Vercel devolve o original.
 */
export function pngRuidoso(largura: number, altura: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  let semente = 12345;
  // Bits altos do gerador congruencial: os baixos se repetem a cada 256 valores e comprimem.
  const aleatorio = () => ((semente = (Math.imul(semente, 1103515245) + 12345) >>> 0) >>> 16) & 0xff;
  const linhas = Array.from({ length: altura }, () => {
    const linha = Buffer.alloc(1 + largura * 3);
    for (let i = 1; i < linha.length; i++) linha[i] = aleatorio();
    return linha;
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(Buffer.concat(linhas))),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

export const PDF_TESTE = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

/** Texto com nome e tipo de foto: o servidor tem de recusar pelo conteúdo. */
export const FOTO_FALSA = Buffer.from("isto é um texto com nome de foto");

/** "JPEG" com assinatura válida e o tamanho pedido (padrão 6 MB), para testar limites. */
export function jpegGrande(megabytes = 6): Buffer {
  const b = Buffer.alloc(megabytes * 1024 * 1024);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
}

/**
 * PDF de 6 MB: acima do limite de 4,5 MB por requisição da Vercel e abaixo dos 10 MB de
 * documentos. Só passa se o arquivo for enviado direto ao Storage (envio-direto.ts).
 */
export function pdfGrande(): Buffer {
  const inicio = Buffer.from("%PDF-1.4\n% comprovante digitalizado\n");
  const fim = Buffer.from("\ntrailer<<>>\n%%EOF\n");
  return Buffer.concat([inicio, Buffer.alloc(6 * 1024 * 1024 - inicio.length - fim.length, 0x20), fim]);
}
