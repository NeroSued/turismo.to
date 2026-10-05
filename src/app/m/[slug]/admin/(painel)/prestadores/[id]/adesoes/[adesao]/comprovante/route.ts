import { NextResponse } from "next/server";
import { z } from "zod";
import { urlAssinadaInterna } from "@/lib/arquivos/armazenamento";
import { contextoDaAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const SEM_CACHE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/**
 * Comprovante de adesão (bucket interno): só para o gestor do município, por URL assinada de
 * 60 segundos. A RLS da tabela e a política do Storage conferem o município de novo.
 */
export async function GET(_: Request, { params }: RouteContext<"/m/[slug]/admin/prestadores/[id]/adesoes/[adesao]/comprovante">) {
  const { id, adesao } = await params;
  const naoEncontrado = () => new NextResponse("Comprovante não encontrado.", { status: 404, headers: SEM_CACHE });
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(adesao).success) return naoEncontrado();

  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) return naoEncontrado();
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("adesoes_prestador")
    .select("comprovante_caminho")
    .eq("municipio_id", ctx.municipio.id)
    .eq("prestador_id", id)
    .eq("id", adesao)
    .maybeSingle();
  if (!data?.comprovante_caminho) return naoEncontrado();
  const url = await urlAssinadaInterna(supabase, data.comprovante_caminho, 60);
  if (!url) return naoEncontrado();
  return NextResponse.redirect(url, { status: 303, headers: SEM_CACHE });
}
