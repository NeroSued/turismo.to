import { envPublico } from "@/lib/env";

/** URL pública de um arquivo do bucket `publico` (fotos publicadas, logo e capa). */
export function urlPublica(caminho: string): string {
  const base = envPublico().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/publico/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}
