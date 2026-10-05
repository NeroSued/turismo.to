import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Únicos arquivos que podem importar src/lib/supabase/privilegiado.ts
 * (operações privilegiadas do docs/PLANO.md, D8). Acrescentar aqui exige
 * registrar a operação no PLANO.
 */
const PERMITIDOS = new Set([
  "scripts/criar-admin.ts", // D8.3: script criar-admin
  "src/lib/voucher/publico.ts", // D8.1 e D8.2: emissão pública e consulta/cancelamento por token
  "src/lib/equipe/convite.ts", // D8.4: conta da pessoa convidada (depois de conferir quem convida)
  "scripts/backup-storage.ts", // D8.5: cópia e restauração dos arquivos do Storage (máquina confiável)
]);

const PASTAS = ["src", "scripts", "tests"];
const EXTENSOES = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IMPORTA_PRIVILEGIADO = /(from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["'][^"']*supabase\/privilegiado(\.ts)?["']/;

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === "node_modules" ? [] : arquivos(caminho);
    return EXTENSOES.test(nome) ? [caminho] : [];
  });
}

describe("módulo privilegiado (service_role)", () => {
  it("só é importado pelos arquivos permitidos", () => {
    const infratores = PASTAS.flatMap(arquivos)
      .map((f) => relative(process.cwd(), f).split(sep).join("/"))
      .filter((f) => f !== "src/lib/supabase/privilegiado.ts" && f !== "tests/unit/privilegiado.test.ts")
      .filter((f) => IMPORTA_PRIVILEGIADO.test(readFileSync(f, "utf8")))
      .filter((f) => !PERMITIDOS.has(f));
    expect(infratores, `Importação proibida de privilegiado.ts em: ${infratores.join(", ")}`).toEqual([]);
  });

  it("o detector reconhece as formas de importação", () => {
    expect(IMPORTA_PRIVILEGIADO.test(`import { x } from "@/lib/supabase/privilegiado";`)).toBe(true);
    expect(IMPORTA_PRIVILEGIADO.test(`const m = await import("../lib/supabase/privilegiado")`)).toBe(true);
    expect(IMPORTA_PRIVILEGIADO.test(`import "@/lib/supabase/privilegiado.ts";`)).toBe(true);
    expect(IMPORTA_PRIVILEGIADO.test(`import { x } from "@/lib/supabase/servidor";`)).toBe(false);
  });

  it("começa com import 'server-only' e é o único lugar que lê a chave secreta", () => {
    const fonte = readFileSync("src/lib/supabase/privilegiado.ts", "utf8");
    expect(fonte.trimStart().startsWith('import "server-only";')).toBe(true);
    const leemChave = arquivos("src")
      .map((f) => relative(process.cwd(), f).split(sep).join("/"))
      .filter((f) => readFileSync(f, "utf8").includes("SUPABASE_SECRET_KEY"));
    expect(leemChave).toEqual(["src/lib/supabase/privilegiado.ts"]);
  });

  it("nenhuma variável NEXT_PUBLIC_* carrega segredo", () => {
    const usos = arquivos("src").flatMap((f) => readFileSync(f, "utf8").match(/NEXT_PUBLIC_[A-Z_]+/g) ?? []);
    const suspeitas = [...new Set(usos)].filter((v) => /SECRET|SERVICE|PASSWORD|SENHA|PRIVATE/.test(v));
    expect(suspeitas).toEqual([]);
  });
});
