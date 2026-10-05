import { describe, expect, it } from "vitest";
import { detectarTipo, validarArquivo } from "@/lib/arquivos/validacao";

const MB = 1024 * 1024;
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const PDF = new TextEncoder().encode("%PDF-1.7\n");
const TEXTO = new TextEncoder().encode("isto não é uma foto");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
const GIF = new TextEncoder().encode("GIF89a......");

describe("upload: validação no servidor", () => {
  it("detecta o tipo pelos bytes iniciais", () => {
    expect(detectarTipo(JPEG)).toBe("image/jpeg");
    expect(detectarTipo(PNG)).toBe("image/png");
    expect(detectarTipo(WEBP)).toBe("image/webp");
    expect(detectarTipo(PDF)).toBe("application/pdf");
    expect(detectarTipo(TEXTO)).toBeNull();
    expect(detectarTipo(SVG)).toBeNull();
    expect(detectarTipo(GIF)).toBeNull();
  });

  it("aceita foto JPEG, PNG ou WebP até 5 MB", () => {
    expect(validarArquivo("foto", 5 * MB, JPEG)).toEqual({ ok: true, mime: "image/jpeg", extensao: "jpg" });
    expect(validarArquivo("foto", 1000, PNG)).toMatchObject({ ok: true, extensao: "png" });
    expect(validarArquivo("foto", 1000, WEBP)).toMatchObject({ ok: true, extensao: "webp" });
  });

  it("recusa foto acima de 5 MB", () => {
    const r = validarArquivo("foto", 5 * MB + 1, JPEG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/limite é 5 MB/);
  });

  it("recusa foto de tipo errado, mesmo com nome .jpg (o nome nem é olhado)", () => {
    for (const bytes of [PDF, TEXTO, SVG, GIF]) {
      const r = validarArquivo("foto", 100, bytes);
      expect(r).toEqual({ ok: false, erro: "Tipo de arquivo não aceito. Envie JPEG, PNG ou WebP até 5 MB." });
    }
  });

  it("aceita documento PDF, JPEG ou PNG até 10 MB e recusa WebP, texto e excesso", () => {
    expect(validarArquivo("documento", 10 * MB, PDF)).toMatchObject({ ok: true, extensao: "pdf" });
    expect(validarArquivo("documento", 100, JPEG)).toMatchObject({ ok: true });
    expect(validarArquivo("documento", 100, WEBP).ok).toBe(false);
    expect(validarArquivo("documento", 100, TEXTO).ok).toBe(false);
    expect(validarArquivo("documento", 10 * MB + 1, PDF).ok).toBe(false);
  });

  it("recusa arquivo vazio", () => {
    expect(validarArquivo("foto", 0, new Uint8Array())).toEqual({ ok: false, erro: "Escolha um arquivo antes de enviar." });
  });
});
