import exifr from "exifr";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LADO_MAXIMO, textoAlternativo, tratarFoto } from "@/lib/fotos/tratamento";
import { GPS_DE_TESTE, jpegComGps, metadadosRestantes } from "../imagens";

describe("tratamento da foto antes de publicar (7.4)", () => {
  it("o arquivo de teste tem EXIF com GPS (prova que o teste vale)", async () => {
    const original = await jpegComGps();
    const gps = await exifr.gps(original);
    expect(gps.latitude).toBeCloseTo(GPS_DE_TESTE.latitude, 6);
    expect(gps.longitude).toBeCloseTo(GPS_DE_TESTE.longitude, 6);
    expect((await exifr.parse(original)).Make).toBe("CelularDeTeste");
    expect(await metadadosRestantes(original)).toContain("bloco EXIF");
  });

  it("remove EXIF, GPS e demais metadados e reduz para 2000 px no lado maior", async () => {
    const original = await jpegComGps(3000, 2000);
    const t = await tratarFoto(original);
    expect(await metadadosRestantes(t.dados)).toEqual([]);
    const m = await sharp(t.dados).metadata();
    expect(m.format).toBe("webp");
    expect([m.width, m.height]).toEqual([LADO_MAXIMO, 1333]);
    expect([t.largura, t.altura]).toEqual([2000, 1333]);
    expect(t.dados.length).toBeLessThan(original.length);
  });

  it("foto em pé também fica com no máximo 2000 px no lado maior", async () => {
    const t = await tratarFoto(await jpegComGps(1500, 2600));
    expect([t.largura, t.altura]).toEqual([1154, 2000]);
  });

  it("aplica a orientação da câmera antes de apagar o EXIF", async () => {
    // Orientação 6: a câmera gravou deitada; a foto deve aparecer em pé.
    const t = await tratarFoto(await jpegComGps(600, 400, { orientacao: 6 }));
    expect([t.largura, t.altura]).toEqual([400, 600]);
    expect(await metadadosRestantes(t.dados)).toEqual([]);
  });

  it("não amplia foto pequena e aceita PNG e WebP", async () => {
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#1F4D3A" } }).png().toBuffer();
    const webp = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#C99A3B" } }).webp().toBuffer();
    expect((await tratarFoto(png)).largura).toBe(800);
    expect((await tratarFoto(webp)).largura).toBe(640);
  });

  it("recusa arquivo que não é imagem válida", async () => {
    const falso = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("não sou uma foto")]);
    await expect(tratarFoto(falso)).rejects.toThrow();
  });

  it("texto alternativo: a legenda ou 'Foto N de <nome>'", () => {
    expect(textoAlternativo("Queda d'água", 0, "Cachoeira")).toBe("Queda d'água");
    expect(textoAlternativo(null, 0, "Cachoeira")).toBe("Foto 1 de Cachoeira");
    expect(textoAlternativo("   ", 2, "Cachoeira")).toBe("Foto 3 de Cachoeira");
  });
});
