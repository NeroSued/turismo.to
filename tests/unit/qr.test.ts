import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { ZXING_WASM_SHA256 } from "barcode-detector/ponyfill";
import { conteudoDoQr, matrizDoQr } from "@/lib/voucher/qr";

/** Desenha a matriz em pixels (RGBA) e decodifica com o jsQR, como um leitor faria. */
function decodificar(matriz: boolean[][], escala = 6) {
  const lado = matriz.length * escala;
  const px = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const v = matriz[Math.floor(y / escala)][Math.floor(x / escala)] ? 0 : 255;
      px.set([v, v, v, 255], (y * lado + x) * 4);
    }
  }
  return jsQR(px, lado, lado);
}

describe("QR Code do voucher", () => {
  it("contém apenas o código (decodificado de volta pelo leitor)", () => {
    const lido = decodificar(matrizDoQr("7KQ4M2XP9WDT"));
    expect(lido?.data).toBe("7KQ4-M2XP-9WDT");
    expect(lido?.data).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(lido?.data).not.toMatch(/https?:|\/|token|@/i);
  });

  it("aceita o código com hífens ou minúsculas e recusa qualquer outra coisa", () => {
    expect(conteudoDoQr("7kq4-m2xp-9wdt")).toBe("7KQ4-M2XP-9WDT");
    expect(() => conteudoDoQr("https://exemplo.test/voucher/abc")).toThrow();
    expect(() => conteudoDoQr("0OIL00000000")).toThrow();
    expect(() => conteudoDoQr("a".repeat(64))).toThrow();
  });

  it("o leitor do operador usa o wasm do zxing servido pelo próprio site, na versão instalada", () => {
    const wasm = readFileSync("public/vendor/zxing_reader.wasm");
    expect(createHash("sha256").update(wasm).digest("hex")).toBe(ZXING_WASM_SHA256);
  });
});
