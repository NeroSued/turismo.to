import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { envPublico } from "@/lib/env";
import { opcoesCookieSessao } from "./cookies";

/** Cliente para componentes de navegador. Usa só a chave publishable. */
export function criarClienteNavegador() {
  const env = envPublico();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: opcoesCookieSessao(window.location.host),
  });
}
