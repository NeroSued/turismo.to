/** Cor primária municipal padrão (CLAUDE.md). */
export const COR_MUNICIPAL_PADRAO = "#1F4D3A";

/** Contraste mínimo exigido para a cor municipal sobre branco (WCAG AA). */
export const CONTRASTE_MINIMO = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

export function ehHexValido(cor: string): boolean {
  return HEX.test(cor);
}

function luminancia(cor: string): number {
  const m = HEX.exec(cor);
  if (!m) throw new Error(`Cor inválida: ${cor}. Use o formato #RRGGBB.`);
  const n = parseInt(m[1], 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

/** Razão de contraste WCAG entre duas cores #RRGGBB (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** A cor pode ser usada como primária municipal (texto branco sobre ela e ela sobre branco). */
export function corMunicipalAceita(cor: string): boolean {
  return ehHexValido(cor) && contraste(cor, "#FFFFFF") >= CONTRASTE_MINIMO;
}
