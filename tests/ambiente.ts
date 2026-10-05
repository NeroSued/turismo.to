import { execSync } from "node:child_process";

/**
 * URL e chaves do Supabase LOCAL, lidas de `supabase status`. Os testes nunca
 * usam o projeto remoto (PLANO, D11) e nenhuma chave fica em arquivo versionado.
 */
export type AmbienteLocal = { url: string; publishable: string; secret: string };

let cache: AmbienteLocal | undefined;

export function ambienteLocal(): AmbienteLocal {
  if (cache) return cache;
  let saida: string;
  try {
    saida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error("Supabase local não está rodando. Rode `npx supabase start` (precisa do Docker).");
  }
  const v: Record<string, string> = {};
  for (const linha of saida.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linha.trim());
    if (m) v[m[1]] = m[2];
  }
  const url = v.API_URL;
  const publishable = v.PUBLISHABLE_KEY ?? v.ANON_KEY;
  const secret = v.SECRET_KEY ?? v.SERVICE_ROLE_KEY;
  if (!url || !publishable || !secret) throw new Error("`supabase status` não retornou URL e chaves.");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`Recusado: os testes só rodam contra o Supabase local (recebido ${url}).`);
  }
  cache = { url, publishable, secret };
  return cache;
}

export const USUARIOS_DEV = {
  admin: "admin@exemplo.test",
  gestorPalmeiropolis: "gestor.palmeiropolis@exemplo.test",
  operadorPalmeiropolis: "operador.palmeiropolis@exemplo.test",
  gestorPeixe: "gestor.peixe@exemplo.test",
} as const;
