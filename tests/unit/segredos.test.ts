import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const versionados = execSync("git ls-files -z", { encoding: "utf8" }).split("\0").filter(Boolean);

// Padrões de credenciais. Mantidos genéricos: o teste nunca contém um segredo real.
const PADROES: [string, RegExp][] = [
  ["chave secreta do Supabase", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["JWT (chave legada anon/service_role)", /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["URL do Postgres com senha", /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{3,}@/],
  ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["senha literal no código", /\b(senha|password|pass|pwd)\w*["']?\s*[:=]\s*["'](?!env\()[^"'\s]{6,}["']/i],
  ["senha em linha de configuração", /^\s*[A-Za-z_]*(password|_pw|senha)\s*[:=]\s*[^\s"'$<{(),;]{6,}\s*$/im],
];

describe("segredos fora do git", () => {
  it("nenhum arquivo .env versionado, exceto .env.example", () => {
    const envs = versionados.filter((f) => /(^|\/)\.env/.test(f));
    expect(envs).toEqual([".env.example"]);
  });

  it(".gitignore cobre .env* e libera só o exemplo", () => {
    const ignorados = execSync("git check-ignore --no-index .env .env.local .env.production .env.example || true", {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
    expect(ignorados).toEqual([".env", ".env.local", ".env.production"]);
  });

  it(".env.example não tem valores secretos", () => {
    const linhas = readFileSync(".env.example", "utf8").split(/\r?\n/);
    const valor = (nome: string) => linhas.find((l) => l.startsWith(`${nome}=`))?.split("=")[1] ?? null;
    expect(valor("SUPABASE_SECRET_KEY")).toBe("");
    expect(valor("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toBe("");
  });

  it("nenhum arquivo versionado contém chaves ou senhas", () => {
    const achados: string[] = [];
    for (const f of versionados) {
      if (/\.(ico|png|jpe?g|webp|gif|woff2?)$/.test(f) || f === "package-lock.json") continue;
      let texto: string;
      try {
        texto = readFileSync(f, "utf8");
      } catch {
        continue; // arquivo removido do disco e ainda não do índice
      }
      for (const [nome, re] of PADROES) if (re.test(texto)) achados.push(`${f}: ${nome}`);
    }
    expect(achados).toEqual([]);
  });
});
