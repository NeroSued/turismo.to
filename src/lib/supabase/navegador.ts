import { createBrowserClient } from "@supabase/ssr";
import { envPublico } from "@/lib/env";

/** Cliente para componentes de navegador. Usa só a chave publishable. */
export function criarClienteNavegador() {
  const env = envPublico();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
