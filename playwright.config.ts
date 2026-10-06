import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { ambienteE2E } from "./tests/ambiente";

// Alvo padrão: build local contra o Supabase local. `npm run test:e2e:preview` carrega
// `.env.e2e-preview` (fora do git) com E2E_ALVO=preview e roda contra um deploy de
// preview da Vercel ligado ao projeto "Turismo.TO Teste" (ver README).
const ambiente = ambienteE2E();
const noPreview = ambiente.alvo === "preview";

// Senha aleatória por execução para as contas [DEV]; definida no global-setup.
// Os workers herdam o process.env do processo principal, então todos usam a mesma.
process.env.E2E_SENHA ??= randomBytes(18).toString("base64url");

const PORTA = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // No preview cada página atravessa a internet até a Vercel e o Supabase de teste: mais tempo
  // por teste, as mesmas verificações.
  timeout: noPreview ? 90_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: noPreview ? `https://${process.env.E2E_RAIZ}` : `http://localhost:${PORTA}`,
    // Passa pela Proteção de Deploy da Vercel com o segredo de automação do projeto.
    extraHTTPHeaders: noPreview ? { "x-vercel-protection-bypass": process.env.E2E_VERCEL_BYPASS ?? "" } : undefined,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    isMobile: false,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Araguaina",
  },
  webServer: noPreview
    ? undefined
    : {
        // Build de produção: cabeçalhos de cache e comportamento iguais aos da Vercel.
        command: `npx next build && npx next start -p ${PORTA}`,
        url: `http://localhost:${PORTA}`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: ambiente.url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ambiente.publishable,
          SUPABASE_SECRET_KEY: ambiente.secret,
          NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORTA}`,
          // Override desligado, como em produção: o E2E prova que ?municipio= é ignorado.
          ALLOW_TENANT_OVERRIDE: "false",
        },
      },
});
