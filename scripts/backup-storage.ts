/**
 * Cópia dos arquivos do Storage (buckets publico e interno), que o backup do banco do Supabase não inclui.
 *
 *   npm run backup:storage -- exportar <pasta>    baixa todos os arquivos e grava manifesto.json com SHA-256
 *   npm run backup:storage -- importar <pasta>    envia de volta os que faltam ou diferem e confere o SHA-256
 *
 * Operação privilegiada 5 do docs/PLANO.md (D8): roda só numa máquina confiável, com as variáveis do
 * ambiente escolhido em .env.local (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY). Procedimento em docs/BACKUP.md.
 * A pasta de backup tem documentos internos (listas de presença, atas, comprovantes): guarde-a cifrada.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { criarClientePrivilegiado } from "@/lib/supabase/privilegiado";

const BUCKETS = ["publico", "interno"] as const;
type Item = { bucket: string; caminho: string; tipo: string; bytes: number; sha256: string };

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
type Cliente = ReturnType<typeof criarClientePrivilegiado>;

/** Lista todos os objetos de um bucket, descendo nas pastas. */
async function listar(supabase: Cliente, bucket: string, prefixo = ""): Promise<{ caminho: string; tipo: string }[]> {
  const saida: { caminho: string; tipo: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefixo, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Falha ao listar ${bucket}/${prefixo}: ${error.message}`);
    for (const e of data) {
      const caminho = prefixo ? `${prefixo}/${e.name}` : e.name;
      if (e.id === null) saida.push(...(await listar(supabase, bucket, caminho)));
      else saida.push({ caminho, tipo: String(e.metadata?.mimetype ?? "application/octet-stream") });
    }
    if (data.length < 1000) return saida;
  }
}

async function exportar(supabase: Cliente, pasta: string) {
  const manifesto: Item[] = [];
  for (const bucket of BUCKETS) {
    for (const { caminho, tipo } of await listar(supabase, bucket)) {
      const { data, error } = await supabase.storage.from(bucket).download(caminho);
      if (error) throw new Error(`Falha ao baixar ${bucket}/${caminho}: ${error.message}`);
      const conteudo = Buffer.from(await data.arrayBuffer());
      const destino = join(pasta, bucket, caminho);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, conteudo);
      manifesto.push({ bucket, caminho, tipo, bytes: conteudo.length, sha256: sha256(conteudo) });
    }
  }
  await writeFile(join(pasta, "manifesto.json"), JSON.stringify({ gerado_em: new Date().toISOString(), arquivos: manifesto }, null, 2));
  const porBucket = BUCKETS.map((b) => `${b}: ${manifesto.filter((m) => m.bucket === b).length}`).join(", ");
  console.log(`Exportados ${manifesto.length} arquivos (${porBucket}) para ${pasta}.`);
}

async function importar(supabase: Cliente, pasta: string) {
  const { arquivos } = JSON.parse(await readFile(join(pasta, "manifesto.json"), "utf8")) as { arquivos: Item[] };
  let enviados = 0;
  let iguais = 0;
  for (const a of arquivos) {
    const conteudo = await readFile(join(pasta, a.bucket, a.caminho));
    if (sha256(conteudo) !== a.sha256) throw new Error(`Arquivo da cópia corrompido: ${a.bucket}/${a.caminho}`);
    const atual = await supabase.storage.from(a.bucket).download(a.caminho);
    if (!atual.error && sha256(Buffer.from(await atual.data.arrayBuffer())) === a.sha256) {
      iguais++;
      continue;
    }
    const { error } = await supabase.storage.from(a.bucket).upload(a.caminho, conteudo, { contentType: a.tipo, upsert: true });
    if (error) throw new Error(`Falha ao enviar ${a.bucket}/${a.caminho}: ${error.message}`);
    const conferido = await supabase.storage.from(a.bucket).download(a.caminho);
    if (conferido.error || sha256(Buffer.from(await conferido.data.arrayBuffer())) !== a.sha256) {
      throw new Error(`Conferência falhou depois do envio: ${a.bucket}/${a.caminho}`);
    }
    enviados++;
  }
  console.log(`Restauração conferida: ${arquivos.length} arquivos no manifesto, ${enviados} enviados de volta, ${iguais} já estavam iguais.`);
}

async function principal() {
  const [acao, pasta] = process.argv.slice(2);
  if ((acao !== "exportar" && acao !== "importar") || !pasta) {
    console.error("Uso: npm run backup:storage -- exportar|importar <pasta>");
    process.exitCode = 2;
    return;
  }
  const supabase = criarClientePrivilegiado();
  if (acao === "exportar") await exportar(supabase, resolve(pasta));
  else await importar(supabase, resolve(pasta));
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
