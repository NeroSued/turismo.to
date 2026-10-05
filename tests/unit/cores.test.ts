import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste, corMunicipalAceita, COR_MUNICIPAL_PADRAO } from "@/lib/cores";

describe("contraste", () => {
  it("preto sobre branco é 21:1", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("aceita a cor municipal padrão e recusa cores claras", () => {
    expect(corMunicipalAceita(COR_MUNICIPAL_PADRAO)).toBe(true);
    expect(corMunicipalAceita("#C99A3B")).toBe(false);
    expect(corMunicipalAceita("verde")).toBe(false);
  });

  it("pares de texto da paleta passam de 4.5:1", () => {
    const pares: [string, string][] = [
      ["#16211B", "#EEF0EA"], // texto sobre fundo
      ["#4F5A52", "#EEF0EA"], // secundário sobre fundo
      ["#4F5A52", "#FFFFFF"], // secundário sobre superfície
      ["#1F4D3A", "#DCE7DF"], // primária sobre verde suave
      ["#6B4A0E", "#F3E6C8"], // dourado texto sobre dourado suave
      ["#A3402B", "#F6E1DB"], // erro sobre fundo de erro
    ];
    for (const [a, b] of pares) expect(contraste(a, b)).toBeGreaterThanOrEqual(4.5);
  });

  it("globals.css usa as cores do CLAUDE.md", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    for (const cor of ["#eef0ea", "#ffffff", "#d5dad0", "#16211b", "#4f5a52", "#1f4d3a", "#dce7df", "#c99a3b", "#f3e6c8", "#6b4a0e", "#a3402b", "#f6e1db"]) {
      expect(css).toContain(cor);
    }
    expect(css).toMatch(/:focus-visible\s*{\s*outline:\s*3px solid var\(--dourado\)/);
  });
});
