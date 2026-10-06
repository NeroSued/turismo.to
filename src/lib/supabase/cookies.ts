import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Sessão compartilhada entre os subdomínios dos municípios (Fase 7.1).
 *
 * Com NEXT_PUBLIC_AUTH_COOKIE_DOMAIN (ex.: ".turismo.to", só em produção), o cookie de sessão
 * vale para todos os subdomínios: quem entra em um município não precisa entrar de novo em
 * outro, e sair encerra a sessão em todos. Sem a variável (local e preview), o cookie continua
 * restrito ao endereço em que a pessoa entrou, como antes.
 *
 * A sessão só identifica a pessoa. Cada página e cada operação continua conferindo o vínculo
 * com o município do recurso (perfis e vinculos), nunca o endereço.
 *
 * O nome do cookie muda junto com o domínio: um cookie antigo, preso a um único endereço, tem
 * outro nome e é ignorado, em vez de disputar com o compartilhado.
 */
export const NOME_COOKIE_COMPARTILHADO = "sb-turismo-sessao";

const DOMINIO = /^\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function dominioDaSessao(): string | null {
  const d = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim().toLowerCase();
  return d && DOMINIO.test(d) ? d : null;
}

/**
 * Opções do cookie de sessão para quem atende `host`. Um host fora do domínio configurado
 * (ex.: o endereço *.vercel.app de um deploy) segue com o cookie do próprio endereço, porque
 * o navegador recusaria um cookie de outro domínio.
 */
export function opcoesCookieSessao(host: string | null | undefined): CookieOptionsWithName | undefined {
  const dominio = dominioDaSessao();
  if (!dominio || !host) return undefined;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (h !== dominio.slice(1) && !h.endsWith(dominio)) return undefined;
  return { name: NOME_COOKIE_COMPARTILHADO, domain: dominio, path: "/", sameSite: "lax" };
}

/** A sessão vale em todos os municípios deste endereço? (texto do seletor de município) */
export function sessaoCompartilhada(host: string | null | undefined): boolean {
  return opcoesCookieSessao(host) !== undefined;
}
