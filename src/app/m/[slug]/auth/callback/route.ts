import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Destino do link de convite e de recuperação de senha (fluxo PKCE). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/admin";
  // Só caminhos internos, para não virar redirecionamento aberto.
  const caminho = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origem = `${proto}://${host}`;

  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(caminho, origem));
  }
  return NextResponse.redirect(new URL("/admin/login?link=expirado", origem));
}
