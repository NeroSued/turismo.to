import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "email", "magiclink"];

/**
 * Destino dos links de convite e de recuperação (supabase/templates).
 * Rota global: o proxy não a reescreve, então atende o hub e os subdomínios.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const tokenHash = p.get("token_hash");
  const tipo = p.get("type") as EmailOtpType | null;
  const next = p.get("next") ?? "/conta/nova-senha";
  // Só caminhos internos, para não virar redirecionamento aberto.
  const caminho = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/conta/nova-senha";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origem = `${proto}://${host}`;

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(caminho, origem));
  }
  return NextResponse.redirect(new URL("/conta/link-expirado", origem));
}
