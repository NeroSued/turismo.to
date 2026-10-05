import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { envPublico } from "@/lib/env";

/**
 * Cliente de servidor com a sessão do usuário (cookies). Todas as consultas
 * passam pela RLS. Crie um por requisição.
 */
export async function criarClienteServidor() {
  // cookies() primeiro: torna a rota dinâmica antes de qualquer leitura de ambiente.
  const loja = await cookies();
  const env = envPublico();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(paraGravar) {
        try {
          for (const { name, value, options } of paraGravar) loja.set(name, value, options);
        } catch {
          // Chamado de um Server Component, onde cookies são só leitura.
          // O proxy renova a sessão, então pode ser ignorado.
        }
      },
    },
  });
}
