import { NextResponse } from "next/server";
import { z } from "zod";
import { urlAssinadaInterna } from "@/lib/arquivos/armazenamento";
import { contextoDaAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const SEM_CACHE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/**
 * Foto ou anexo de evidência (bucket interno): só para o gestor do município, por URL assinada
 * de 60 segundos. A RLS da tabela e a política do Storage conferem o município de novo.
 */
export async function GET(_: Request, { params }: RouteContext<"/m/[slug]/admin/evidencias/[id]/arquivos/[arquivo]">) {
  const { id, arquivo } = await params;
  const naoEncontrado = () => new NextResponse("Arquivo não encontrado.", { status: 404, headers: SEM_CACHE });
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(arquivo).success) return naoEncontrado();

  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return naoEncontrado();
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("evidencias_arquivos")
    .select("caminho, retirado")
    .eq("municipio_id", ctx.municipio.id)
    .eq("evidencia_id", id)
    .eq("id", arquivo)
    .maybeSingle();
  // Arquivo retirado pelo gestor só abre para a assessoria (que decide a exclusão LGPD).
  if (!data || (data.retirado && ctx.papel !== "admin")) return naoEncontrado();
  const url = await urlAssinadaInterna(supabase, data.caminho, 60);
  if (!url) return naoEncontrado();
  return NextResponse.redirect(url, { status: 303, headers: SEM_CACHE });
}
