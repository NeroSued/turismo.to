import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USUARIOS_DEV } from "../ambiente";
import { clienteAnonimo, clienteServico, entrarComo, idDoMunicipio, sufixo, type Cliente } from "./apoio";

// Storage real do Supabase local: os buckets e as políticas por pasta (item 2.2) valem mesmo
// para quem chama a API direto, sem passar pela validação do servidor da aplicação.

const MB = 1024 * 1024;
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%comprovante de teste\n");

let palmeiropolis: string;
let peixe: string;
let gestorPalm: Cliente;
let gestorPeixe: Cliente;
let operadorPalm: Cliente;
const criados: { bucket: string; caminho: string }[] = [];

beforeAll(async () => {
  [palmeiropolis, peixe] = await Promise.all([idDoMunicipio("palmeiropolis"), idDoMunicipio("peixe")]);
  [gestorPalm, gestorPeixe, operadorPalm] = await Promise.all([
    entrarComo(USUARIOS_DEV.gestorPalmeiropolis),
    entrarComo(USUARIOS_DEV.gestorPeixe),
    entrarComo(USUARIOS_DEV.operadorPalmeiropolis),
  ]);
});

afterAll(async () => {
  const servico = clienteServico();
  for (const bucket of ["publico", "interno"]) {
    const caminhos = criados.filter((c) => c.bucket === bucket).map((c) => c.caminho);
    if (caminhos.length) await servico.storage.from(bucket).remove(caminhos);
  }
});

async function enviar(cliente: Cliente, bucket: string, caminho: string, corpo: Uint8Array, contentType: string) {
  const r = await cliente.storage.from(bucket).upload(caminho, new Blob([corpo], { type: contentType }), { contentType });
  if (!r.error) criados.push({ bucket, caminho });
  return r;
}

describe("Storage: buckets publico e interno", () => {
  it("gestor de Palmeirópolis envia foto na própria pasta e a foto sai pela URL pública", async () => {
    const caminho = `${palmeiropolis}/fotos/${sufixo()}.jpg`;
    const r = await enviar(gestorPalm, "publico", caminho, JPEG, "image/jpeg");
    expect(r.error).toBeNull();
    const url = clienteAnonimo().storage.from("publico").getPublicUrl(caminho).data.publicUrl;
    const resposta = await fetch(url);
    expect(resposta.status).toBe(200);
  });

  it("bucket publico recusa tipo errado (PDF e texto) mesmo vindo do gestor", async () => {
    const pdf = await enviar(gestorPalm, "publico", `${palmeiropolis}/fotos/${sufixo()}.pdf`, PDF, "application/pdf");
    expect(pdf.error?.message).toMatch(/mime type/i);
    const txt = await enviar(gestorPalm, "publico", `${palmeiropolis}/fotos/${sufixo()}.jpg`, new TextEncoder().encode("oi"), "text/plain");
    expect(txt.error?.message).toMatch(/mime type/i);
  });

  it("bucket publico recusa foto acima de 5 MB", async () => {
    const grande = new Uint8Array(5 * MB + 1024);
    grande.set(JPEG);
    const r = await enviar(gestorPalm, "publico", `${palmeiropolis}/fotos/${sufixo()}.jpg`, grande, "image/jpeg");
    expect(r.error?.message).toMatch(/maximum allowed size|exceeded/i);
  });

  it("bucket interno recusa WebP e arquivo acima de 10 MB", async () => {
    const webp = await enviar(gestorPalm, "interno", `${palmeiropolis}/adesoes/${sufixo()}.webp`, new TextEncoder().encode("RIFF0000WEBP"), "image/webp");
    expect(webp.error?.message).toMatch(/mime type/i);
    const grande = new Uint8Array(10 * MB + 1024);
    grande.set(PDF);
    const r = await enviar(gestorPalm, "interno", `${palmeiropolis}/adesoes/${sufixo()}.pdf`, grande, "application/pdf");
    expect(r.error?.message).toMatch(/maximum allowed size|exceeded/i);
  });

  it("gestor de Peixe não grava nem lê na pasta de Palmeirópolis", async () => {
    const foto = await enviar(gestorPeixe, "publico", `${palmeiropolis}/fotos/${sufixo()}.jpg`, JPEG, "image/jpeg");
    expect(foto.error?.message).toMatch(/row-level security/i);
    const doc = await enviar(gestorPeixe, "interno", `${palmeiropolis}/adesoes/${sufixo()}.pdf`, PDF, "application/pdf");
    expect(doc.error?.message).toMatch(/row-level security/i);

    // Documento real de Palmeirópolis: Peixe não lista, não baixa e não assina URL.
    const caminho = `${palmeiropolis}/adesoes/${sufixo()}.pdf`;
    expect((await enviar(gestorPalm, "interno", caminho, PDF, "application/pdf")).error).toBeNull();
    const lista = await gestorPeixe.storage.from("interno").list(`${palmeiropolis}/adesoes`);
    expect(lista.data ?? []).toHaveLength(0);
    expect((await gestorPeixe.storage.from("interno").download(caminho)).error).not.toBeNull();
    expect((await gestorPeixe.storage.from("interno").createSignedUrl(caminho, 60)).error).not.toBeNull();

    // E Peixe grava na própria pasta normalmente.
    expect((await enviar(gestorPeixe, "publico", `${peixe}/fotos/${sufixo()}.jpg`, JPEG, "image/jpeg")).error).toBeNull();
  });

  it("anônimo e operador não leem o bucket interno; o gestor lê por URL assinada curta", async () => {
    const caminho = `${palmeiropolis}/adesoes/${sufixo()}.pdf`;
    expect((await enviar(gestorPalm, "interno", caminho, PDF, "application/pdf")).error).toBeNull();

    const anon = clienteAnonimo();
    expect((await anon.storage.from("interno").download(caminho)).error).not.toBeNull();
    expect((await anon.storage.from("interno").createSignedUrl(caminho, 60)).error).not.toBeNull();
    const publica = anon.storage.from("interno").getPublicUrl(caminho).data.publicUrl;
    expect((await fetch(publica)).status).toBeGreaterThanOrEqual(400);

    expect((await operadorPalm.storage.from("interno").download(caminho)).error).not.toBeNull();
    expect((await enviar(operadorPalm, "publico", `${palmeiropolis}/fotos/${sufixo()}.jpg`, JPEG, "image/jpeg")).error).not.toBeNull();

    const assinada = await gestorPalm.storage.from("interno").createSignedUrl(caminho, 60);
    expect(assinada.error).toBeNull();
    const r = await fetch(assinada.data!.signedUrl);
    expect(r.status).toBe(200);
    expect(new TextDecoder().decode(new Uint8Array(await r.arrayBuffer())).startsWith("%PDF-")).toBe(true);
  });
});
