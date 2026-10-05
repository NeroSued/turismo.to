import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { ambienteLocal } from "./tests/ambiente";

const local = ambienteLocal();

// Senha aleatória por execução para as contas [DEV]; definida no global-setup.
// Os workers herdam o process.env do processo principal, então todos usam a mesma.
process.env.E2E_SENHA ??= randomBytes(18).toString("base64url");

const PORTA = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    isMobile: false,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Araguaina",
  },
  webServer: {
    command: `npx next dev -p ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: local.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishable,
      SUPABASE_SECRET_KEY: local.secret,
      NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORTA}`,
      // Override desligado, como em produção: o E2E prova que ?municipio= é ignorado.
      ALLOW_TENANT_OVERRIDE: "false",
    },
  },
});
