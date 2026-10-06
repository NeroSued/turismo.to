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

/** Projeto Supabase "Turismo.TO Teste", o único remoto em que os testes podem escrever. */
export const REF_TESTE = "lcpkzcjkijgtomoepcbe";
/** Projeto de produção: nunca recebe dados de teste (CLAUDE.md). */
export const REF_PRODUCAO = "kytbiyiltfpyvwuumfds";

export type AmbienteE2E = AmbienteLocal & {
  alvo: "local" | "preview";
  /** Conexão Postgres do projeto de teste (só no alvo preview). */
  dbUrl?: string;
};

/**
 * Ambiente do E2E. Por padrão, o Supabase local. Com E2E_ALVO=preview, o projeto
 * "Turismo.TO Teste" (variáveis E2E_* de `.env.e2e-preview`, fora do git). Qualquer
 * outro endereço, e em especial o projeto de produção, é recusado.
 */
export function ambienteE2E(): AmbienteE2E {
  if (process.env.E2E_ALVO !== "preview") return { ...ambienteLocal(), alvo: "local" };
  const url = process.env.E2E_SUPABASE_URL ?? "";
  const publishable = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secret = process.env.E2E_SUPABASE_SECRET_KEY ?? "";
  const dbUrl = process.env.E2E_DB_URL ?? "";
  const tudo = [url, dbUrl].join(" ");
  if (tudo.includes(REF_PRODUCAO)) throw new Error("Recusado: o E2E nunca roda contra o projeto de produção.");
  if (url !== `https://${REF_TESTE}.supabase.co` || !dbUrl.includes(`postgres.${REF_TESTE}:`)) {
    throw new Error("Recusado: com E2E_ALVO=preview, só o projeto Turismo.TO Teste é aceito.");
  }
  if (!publishable || !secret) throw new Error("Faltam as chaves do projeto de teste em .env.e2e-preview.");
  return { url, publishable, secret, dbUrl, alvo: "preview" };
}

export const USUARIOS_DEV = {
  admin: "admin@exemplo.test",
  gestorPalmeiropolis: "gestor.palmeiropolis@exemplo.test",
  operadorPalmeiropolis: "operador.palmeiropolis@exemplo.test",
  gestorPeixe: "gestor.peixe@exemplo.test",
} as const;
