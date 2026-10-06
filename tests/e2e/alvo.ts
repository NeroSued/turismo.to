import { execSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { ambienteE2E } from "../ambiente";

/**
 * Onde o E2E roda. Local: `next start` em localhost:3000 com o Supabase local.
 * Preview: um deploy de preview da Vercel com aliases <slug>.<E2E_RAIZ> (ex.:
 * palmeiropolis.teste.turismo.to), ligado ao projeto "Turismo.TO Teste".
 */
export const AMBIENTE = ambienteE2E();
export const NO_PREVIEW = AMBIENTE.alvo === "preview";
export const RAIZ = NO_PREVIEW ? (process.env.E2E_RAIZ ?? "") : "localhost:3000";
const PROTOCOLO = NO_PREVIEW ? "https" : "http";

if (NO_PREVIEW && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(RAIZ)) throw new Error("E2E_RAIZ inválida.");

/** Endereço do hub (sem subdomínio) ou do portal de um município. */
export function site(subdominio?: string, caminho = ""): string {
  return `${PROTOCOLO}://${subdominio ? `${subdominio}.` : ""}${RAIZ}${caminho}`;
}

/** Host (com porta, no local) de um subdomínio. */
export function hostDe(subdominio?: string): string {
  return `${subdominio ? `${subdominio}.` : ""}${RAIZ}`;
}

/**
 * Requisição direta ao servidor (sem navegador) como o host de um município, com os
 * cookies da página. No local o Node não resolve *.localhost, então vai para
 * localhost:3000 com o cabeçalho Host; no preview vai direto ao alias.
 */
export function pedir(
  page: Page,
  subdominio: string | undefined,
  caminho: string,
  opcoes: Parameters<Page["request"]["fetch"]>[1] = {},
) {
  const cabecalhos = { ...(opcoes.headers ?? {}) };
  if (NO_PREVIEW) return page.request.fetch(site(subdominio, caminho), { ...opcoes, headers: cabecalhos });
  return page.request.fetch(`http://localhost:3000${caminho}`, {
    ...opcoes,
    headers: { host: hostDe(subdominio), ...cabecalhos },
  });
}

/**
 * SQL direto no banco do alvo (local ou projeto de teste, conferido em ambienteE2E).
 * Usa o psql do contêiner do Supabase local; no preview, pelo pooler IPv4.
 */
export function sql(consulta: string): string {
  const destino = NO_PREVIEW ? `"${AMBIENTE.dbUrl}"` : "-U postgres";
  return execSync(`docker exec -i supabase_db_turismo-to psql ${destino} -q -t -A -v ON_ERROR_STOP=1`, {
    input: consulta,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/**
 * E-mail de uma conta criada pelo teste. No local vai para o Mailpit (@exemplo.test);
 * no preview o projeto de teste envia pelo Resend, então usa o endereço de simulação
 * do Resend (delivered+<rótulo>@resend.dev), que não entrega a ninguém.
 */
export function emailDeTeste(rotulo: string): string {
  return NO_PREVIEW ? `delivered+${rotulo}@resend.dev` : `${rotulo}@exemplo.test`;
}
