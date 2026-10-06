import { defineConfig, devices } from "@playwright/test";

/**
 * Teste de fumaça SÓ DE LEITURA contra a produção (https://turismo.to). Não entra,
 * não grava e não usa chave nenhuma: abre o hub, um portal e confere que /admin pede
 * login. `FUMACA_RAIZ` troca o domínio (ex.: teste.turismo.to).
 */
export default defineConfig({
  testDir: "tests/fumaca",
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Araguaina",
  },
});
