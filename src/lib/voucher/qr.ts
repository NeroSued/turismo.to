import { encode } from "uqr";
import { codigoValido, formatarCodigo } from "./esquemas";

/**
 * Conteúdo do QR Code do voucher (D6): apenas o código, no formato XXXX-XXXX-XXXX.
 * Nada de URL, token, nome ou qualquer outro dado. Confirmar presença exige operador logado.
 */
export function conteudoDoQr(codigo: string): string {
  if (!codigoValido(codigo)) throw new Error("Código de voucher inválido.");
  return formatarCodigo(codigo);
}

/** Matriz de módulos do QR (true = escuro), com margem de 4 módulos. */
export function matrizDoQr(codigo: string): boolean[][] {
  return encode(conteudoDoQr(codigo), { ecc: "M", border: 4 }).data;
}

/** Caminho SVG (um retângulo 1x1 por módulo escuro, unidos num só path). */
export function caminhoDoQr(matriz: boolean[][]): string {
  let d = "";
  matriz.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return d;
}
