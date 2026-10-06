/** Pastas aceitas para arquivos de município: `<municipio_id>/<pasta>/<uuid>.<extensão>`. */
export const PASTAS = ["fotos", "adesoes", "marca", "evidencias"] as const;
export type Pasta = (typeof PASTAS)[number];

/** Valor do campo de arquivo depois do envio direto ao Storage. */
export const PREFIXO_ENVIADO = "enviado:";
/** Valor do campo quando a autorização recusou: tamanho e bytes iniciais, para o servidor refazer a validação. */
export const PREFIXO_RECUSADO = "recusado:";

/** Valor do campo quando o envio direto ao Storage falhou (rede). */
export const PREFIXO_FALHOU = "falhou:";

export function caminhoNovo(municipioId: string, pasta: string, extensao: string): string {
  return `${municipioId}/${pasta}/${crypto.randomUUID()}.${extensao}`;
}

/** Confere que o caminho é um arquivo gerado por caminhoNovo para este município e pasta. */
export function caminhoDoMunicipio(caminho: string, municipioId: string, pasta: string): boolean {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(`^${municipioId}/${pasta}/${uuid}\.(jpg|png|webp|pdf)$`).test(caminho);
}

export function paraHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function deHex(s: string): Uint8Array {
  const pares = s.match(/[0-9a-f]{2}/g) ?? [];
  return Uint8Array.from(pares, (p) => parseInt(p, 16));
}
