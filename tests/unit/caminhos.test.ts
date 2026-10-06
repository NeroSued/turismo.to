import { describe, expect, it } from "vitest";
import { caminhoDoMunicipio, caminhoNovo, deHex, paraHex } from "@/lib/arquivos/caminhos";

const M = "6f1c2c7e-8f5a-4b8e-9a43-0f2d9c8b1a11";
const OUTRO = "0b7e1f1a-2c3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("caminhos de arquivo do envio direto", () => {
  it("aceita só caminhos gerados para o mesmo município e pasta", () => {
    const c = caminhoNovo(M, "fotos", "jpg");
    expect(caminhoDoMunicipio(c, M, "fotos")).toBe(true);
    expect(caminhoDoMunicipio(c, OUTRO, "fotos")).toBe(false);
    expect(caminhoDoMunicipio(c, M, "adesoes")).toBe(false);
  });

  it("recusa caminhos forjados", () => {
    for (const c of [
      `${M}/fotos/../${OUTRO}/fotos/a.jpg`,
      `${M}/fotos/${OUTRO}.svg`,
      `${M}/fotos/nome-escolhido.jpg`,
      `${OUTRO}/fotos/${M}.jpg`,
      `x${M}/fotos/${OUTRO}.jpg`,
      `${M}/fotos/${OUTRO}.jpg/extra`,
    ]) {
      expect(caminhoDoMunicipio(c, M, "fotos"), c).toBe(false);
    }
  });

  it("bytes iniciais vão e voltam em hexadecimal", () => {
    const b = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x25, 0x50]);
    expect(paraHex(b)).toBe("ffd8ff002550");
    expect(Array.from(deHex(paraHex(b)))).toEqual(Array.from(b));
    expect(Array.from(deHex("zz"))).toEqual([]);
  });
});
