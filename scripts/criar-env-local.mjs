/**
 * Gera .env.local com a URL e as chaves do Supabase LOCAL, lidas de `npx supabase status`.
 *
 *   npm run env:local            cria .env.local (não sobrescreve)
 *   npm run env:local -- --forcar   sobrescreve
 *
 * Não imprime nenhuma chave. Recusa URL que não seja 127.0.0.1/localhost (D11).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const destino = ".env.local";
if (existsSync(destino) && !process.argv.includes("--forcar")) {
  console.log(`${destino} já existe; nada foi alterado. Use "npm run env:local -- --forcar" para recriar.`);
  process.exit(0);
}

let saida;
try {
  saida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error("Supabase local não está rodando. Rode `npx supabase start` (precisa do Docker).");
  process.exit(1);
}
const v = {};
for (const linha of saida.split(/\r?\n/)) {
  const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linha.trim());
  if (m) v[m[1]] = m[2];
}
const url = v.API_URL;
const publica = v.PUBLISHABLE_KEY ?? v.ANON_KEY;
const secreta = v.SECRET_KEY ?? v.SERVICE_ROLE_KEY;
if (!url || !publica || !secreta) {
  console.error("`supabase status` não retornou URL e chaves.");
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("Recusado: este script só grava valores do Supabase local.");
  process.exit(1);
}

const exemplo = readFileSync(".env.example", "utf8");
const conteudo = exemplo
  .replace(/^NEXT_PUBLIC_SUPABASE_URL=.*$/m, `NEXT_PUBLIC_SUPABASE_URL=${url}`)
  .replace(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*$/m, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publica}`)
  .replace(/^SUPABASE_SECRET_KEY=.*$/m, `SUPABASE_SECRET_KEY=${secreta}`);
writeFileSync(destino, conteudo);
console.log(`${destino} criado com a URL e as chaves do Supabase local (${url}).`);
