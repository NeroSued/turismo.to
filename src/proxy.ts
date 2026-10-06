import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import {
  COOKIE_MUNICIPIO,
  PARAMETRO_MUNICIPIO,
  parametroDeOverride,
  resolverMunicipio,
} from "@/lib/municipio/resolver";

/**
 * 1. Escolhe o portal pelo host (ou pelo override em dev/preview) e reescreve
 *    para /m/<slug>/... internamente.
 * 2. Renova a sessão do Supabase (getClaims valida a assinatura do token).
 * 3. Marca rotas do painel como privadas e sem cache.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // A árvore interna /m/<slug> só é alcançada pela reescrita, nunca diretamente.
  if (pathname === "/m" || pathname.startsWith("/m/")) {
    return new NextResponse("Página não encontrada.", { status: 404 });
  }

  const env = envPublico();
  const overridePermitido = overrideDeMunicipioPermitido();
  const parametro = overridePermitido ? parametroDeOverride(searchParams.get(PARAMETRO_MUNICIPIO)) : null;

  const resolucao = resolverMunicipio({
    host: request.headers.get("host"),
    dominioRaiz: env.NEXT_PUBLIC_ROOT_DOMAIN,
    parametro,
    cookie: request.cookies.get(COOKIE_MUNICIPIO)?.value ?? null,
    overridePermitido,
  });

  // /auth, /conta e /api são globais: atendem o hub e todos os subdomínios.
  const global = /^\/(auth|conta|api)(\/|$)/.test(pathname);
  const reescrever = resolucao.tipo === "municipio" && !global;

  const destino = request.nextUrl.clone();
  if (reescrever) {
    destino.pathname = `/m/${resolucao.slug}${pathname === "/" ? "" : pathname}`;
  }

  const criarResposta = () =>
    reescrever
      ? NextResponse.rewrite(destino, { request })
      : NextResponse.next({ request });

  let resposta = criarResposta();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(paraGravar, cabecalhos) {
          for (const { name, value } of paraGravar) request.cookies.set(name, value);
          resposta = criarResposta();
          for (const { name, value, options } of paraGravar) resposta.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(cabecalhos)) resposta.headers.set(k, v);
        },
      },
    },
  );
  await supabase.auth.getClaims();

  if (parametro !== null) {
    if (parametro) {
      resposta.cookies.set(COOKIE_MUNICIPIO, parametro.toLowerCase(), {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
      });
    } else {
      resposta.cookies.delete(COOKIE_MUNICIPIO);
    }
  }

  if (/^\/(admin|auth|conta|voucher|api)(\/|$)/.test(pathname)) {
    resposta.headers.set("Cache-Control", "private, no-store");
  }
  // O link do visitante carrega o token: não vaza por Referer nem é indexado.
  if (/^\/voucher(\/|$)/.test(pathname)) {
    resposta.headers.set("Referrer-Policy", "no-referrer");
    resposta.headers.set("X-Robots-Tag", "noindex");
  }

  return resposta;
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos e imagens otimizadas.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|wasm)$).*)",
  ],
};
