// Segundo servidor do E2E (Fase 7.1): mesmo código, com a sessão compartilhada entre
// subdomínios ligada (NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.turismo.test) e domínio raiz turismo.test,
// que o Chromium do teste resolve para 127.0.0.1. O Chromium recusa cookie com Domain=localhost,
// por isso o domínio reservado .test. Build próprio em .next-sessao (as variáveis públicas são
// fixadas no build) e só depois que o servidor principal subiu, para os dois builds não
// disputarem a máquina nem o next-env.d.ts.
import { spawn, spawnSync } from "node:child_process";

const PORTA = process.env.PORTA_SESSAO ?? "3100";

async function esperarPrincipal() {
  for (;;) {
    try {
      const r = await fetch("http://localhost:3000/");
      if (r.status) return;
    } catch {
      // ainda compilando
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}

await esperarPrincipal();
const build = spawnSync("npx next build", { stdio: "inherit", shell: true, env: process.env });
if (build.status !== 0) process.exit(build.status ?? 1);
const servidor = spawn(`npx next start -p ${PORTA}`, { stdio: "inherit", shell: true, env: process.env });
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => servidor.kill(sinal));
servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
