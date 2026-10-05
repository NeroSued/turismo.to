import "server-only";
import { cookies, headers } from "next/headers";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { buscarMunicipioPorSlug, type Municipio } from "./dados";
import { COOKIE_MUNICIPIO, resolverMunicipio } from "./resolver";

/**
 * Município do portal em que a requisição chegou (host ou override permitido), para server
 * actions e rotas, que não recebem o slug da URL reescrita. Escolhe o portal; não autoriza nada.
 */
export async function municipioDaRequisicao(): Promise<Municipio | null> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const resolucao = resolverMunicipio({
    host: h.get("host"),
    dominioRaiz: envPublico().NEXT_PUBLIC_ROOT_DOMAIN,
    parametro: null,
    cookie: c.get(COOKIE_MUNICIPIO)?.value ?? null,
    overridePermitido: overrideDeMunicipioPermitido(),
  });
  if (resolucao.tipo !== "municipio") return null;
  return buscarMunicipioPorSlug(resolucao.slug);
}
