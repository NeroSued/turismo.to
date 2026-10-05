/** Primeiras ~160 letras de um texto, sem quebras, para descrições de página e Open Graph. */
export function resumo(texto: string | null | undefined, max = 160): string | undefined {
  if (!texto) return undefined;
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max - 1);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}
