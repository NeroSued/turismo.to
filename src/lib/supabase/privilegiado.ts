import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { envPublico } from "@/lib/env";

/**
 * Cliente com a chave secreta (service_role): ignora a RLS.
 *
 * Uso restrito às "Operações privilegiadas" do docs/PLANO.md (D8):
 *   1. emissão pública de voucher;
 *   2. consulta e cancelamento pelo token do visitante;
 *   3. script criar-admin.
 *
 * tests/unit/privilegiado.test.ts falha se outro arquivo importar este módulo.
 */
export function criarClientePrivilegiado() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não definida no servidor.");
  return createClient<Database>(envPublico().NEXT_PUBLIC_SUPABASE_URL, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
