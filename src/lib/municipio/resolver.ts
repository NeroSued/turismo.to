/**
 * Descobre qual portal mostrar a partir do host (CLAUDE.md, "Identificação do município").
 *
 *   <slug>.<raiz>  → portal do município
 *   <raiz>         → hub
 *   outro host     → hub (ex.: URL de preview da Vercel), salvo override
 *
 * O override (?municipio=<slug>, lembrado em cookie) só vale com ALLOW_TENANT_OVERRIDE=true.
 * O resultado só escolhe o portal: nunca autoriza nada.
 */

export const COOKIE_MUNICIPIO = "municipio_selecionado";
export const PARAMETRO_MUNICIPIO = "municipio";

const SLUG = /^[a-z0-9]{2,40}$/;

export type Resolucao = { tipo: "hub" } | { tipo: "municipio"; slug: string };

export type EntradaResolucao = {
  host: string | null;
  dominioRaiz: string;
  /** Valor de ?municipio= (null se ausente). */
  parametro: string | null;
  /** Valor do cookie de seleção (null se ausente). */
  cookie: string | null;
  overridePermitido: boolean;
};

function semPorta(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

export function slugValido(slug: string): boolean {
  return SLUG.test(slug);
}

/** Slug do subdomínio, se o host for <slug>.<raiz>. */
export function slugDoHost(host: string | null, dominioRaiz: string): string | null {
  if (!host) return null;
  const h = semPorta(host);
  const raiz = semPorta(dominioRaiz);
  if (!h.endsWith(`.${raiz}`)) return null;
  const sub = h.slice(0, -(raiz.length + 1));
  if (sub === "" || sub === "www") return null;
  // Slug malformado segue adiante: a página valida e responde 404.
  return sub;
}

/**
 * Valor de ?municipio= que vale como escolha de portal: vazio (limpa a escolha) ou um slug
 * válido. Qualquer outro valor (ex.: o id que a auditoria usa no mesmo parâmetro) é da
 * página, não do override, e é ignorado aqui.
 */
export function parametroDeOverride(valor: string | null): string | null {
  if (valor === null) return null;
  const v = valor.trim().toLowerCase();
  return v === "" || slugValido(v) ? v : null;
}

export function resolverMunicipio(e: EntradaResolucao): Resolucao {
  if (e.overridePermitido) {
    const escolhido = e.parametro !== null ? e.parametro : e.cookie;
    if (escolhido) return { tipo: "municipio", slug: escolhido.toLowerCase() };
    if (e.parametro !== null) return { tipo: "hub" }; // ?municipio= vazio limpa a seleção
  }
  const doHost = slugDoHost(e.host, e.dominioRaiz);
  if (doHost) return { tipo: "municipio", slug: doHost };
  return { tipo: "hub" };
}

/** Endereço do hub, para o link "Outros municípios". */
export function urlDoHub(dominioRaiz: string, overridePermitido: boolean): string {
  if (overridePermitido && !dominioRaiz.includes("localhost")) return `/?${PARAMETRO_MUNICIPIO}=`;
  const protocolo = dominioRaiz.includes("localhost") ? "http" : "https";
  return `${protocolo}://${dominioRaiz}/`;
}

/** Endereço público do portal de um município, para links do hub. */
export function urlDoMunicipio(
  slug: string,
  dominioRaiz: string,
  overridePermitido: boolean,
): string {
  if (overridePermitido && !dominioRaiz.includes("localhost")) {
    return `/?${PARAMETRO_MUNICIPIO}=${encodeURIComponent(slug)}`;
  }
  const protocolo = dominioRaiz.includes("localhost") ? "http" : "https";
  return `${protocolo}://${slug}.${dominioRaiz}/`;
}
