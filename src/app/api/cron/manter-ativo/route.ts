import { createClient } from "@supabase/supabase-js";
import { cronAutorizado } from "@/lib/cron";
import { envPublico } from "@/lib/env";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store" };

/**
 * Chamado uma vez por dia pelo Vercel Cron (vercel.json). Faz uma leitura
 * pública e leve no banco para o projeto gratuito do Supabase não ser
 * suspenso por inatividade. Usa a chave publicável, sem sessão e sem
 * service_role.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401, headers: SEM_CACHE });
  }
  const env = envPublico();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("municipios").select("id").limit(1);
  if (error) {
    console.error("cron manter-ativo: falha na consulta", error.code);
    return Response.json({ ok: false }, { status: 503, headers: SEM_CACHE });
  }
  return Response.json({ ok: true }, { headers: SEM_CACHE });
}
