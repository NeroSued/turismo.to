import { timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho `Authorization: Bearer <CRON_SECRET>` que o Vercel Cron
 * envia. Compara em tempo constante; segredo ausente ou curto nunca autoriza.
 */
export function cronAutorizado(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 16 || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
