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
 *   3. script criar-admin;
 *   4. conta da pessoa convidada para a equipe (src/lib/equipe/convite.ts), depois de a action
 *      conferir com a sessão de quem convida que ela é gestora do município ou admin.
 *   5. script backup-storage (cópia e restauração dos arquivos do Storage, docs/BACKUP.md).
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
