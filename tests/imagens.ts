import sharp from "sharp";

/**
 * Imagens de teste geradas na hora (nenhuma foto real no repositório). `jpegComGps` grava EXIF
 * com fabricante, autor e a localização GPS de um ponto no Tocantins, como faria um celular.
 */
export const GPS_DE_TESTE = { latitude: -13.041666666666666, longitude: -48.3 };

export async function jpegComGps(largura = 3000, altura = 2000, opcoes: { orientacao?: number } = {}): Promise<Buffer> {
  // Ruído em blocos: comprime como uma foto de verdade (cor lisa geraria arquivos minúsculos).
  const bruto = Buffer.alloc(largura * altura * 3);
  let x = 0x9e3779b9;
  for (let i = 0; i < bruto.length; i += 3) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const v = x >>> 24;
    bruto[i] = 60 + (v & 0x3f);
    bruto[i + 1] = 110 + ((v >> 2) & 0x3f);
    bruto[i + 2] = 70 + ((v >> 4) & 0x0f);
  }
  return sharp(bruto, { raw: { width: largura, height: altura, channels: 3 } })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: "CelularDeTeste", Model: "Modelo X", Artist: "Fulano de Tal", Copyright: "Fulano de Tal" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "13/1 2/1 30/1", GPSLongitudeRef: "W", GPSLongitude: "48/1 18/1 0/1" },
    })
    .withMetadata(opcoes.orientacao ? { orientation: opcoes.orientacao } : {})
    .toBuffer();
}

/** Metadados que sobraram no arquivo, pelo sharp e por varredura de bytes. Lista vazia = limpo. */
export async function metadadosRestantes(arquivo: Uint8Array): Promise<string[]> {
  const m = await sharp(arquivo).metadata();
  const achados: string[] = [];
  if (m.exif) achados.push("bloco EXIF");
  if (m.xmp) achados.push("bloco XMP");
  if (m.iptc) achados.push("bloco IPTC");
  if (m.orientation && m.orientation !== 1) achados.push(`orientação ${m.orientation}`);
  const texto = Buffer.from(arquivo).toString("latin1");
  for (const marca of ["Exif", "EXIF", "XMP ", "GPS", "CelularDeTeste", "Fulano"]) {
    if (texto.includes(marca)) achados.push(`bytes "${marca}"`);
  }
  return achados;
}
