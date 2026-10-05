import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagina } from "@/components/pagina";
import { FormularioReserva } from "@/components/portal/reserva";
import { exigirPainel } from "@/lib/painel/contexto";
import { emitirAssistida } from "@/lib/voucher/acoes-painel";
import { dadosDaReserva } from "@/lib/voucher/opcoes";

export const metadata: Metadata = { title: "Emissão assistida" };

export default async function EmissaoAssistida({ params }: PageProps<"/m/[slug]/admin/vouchers/emitir/[atividade]">) {
  const { slug, atividade: atividadeId } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor", "operador"]);
  const dados = await dadosDaReserva(municipio.id, atividadeId);
  if (!dados) notFound();
  return (
    <Pagina className="pt-2">
      <Link href="/admin/vouchers/emitir" className="flex min-h-11 w-fit items-center gap-1.5 font-bold">
        <ArrowLeft aria-hidden="true" className="size-5" /> Escolher outra atividade
      </Link>
      <div className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Emissão assistida</span>
        <h1 className="text-[26px] leading-tight font-bold">{dados.atividade.titulo}</h1>
      </div>
      <FormularioReserva
        atividade={dados.atividade}
        sessoes={dados.opcoes}
        chave={dados.chave}
        hoje={dados.hoje}
        ultimoDia={dados.ultimoDia}
        acao={emitirAssistida}
        rotuloBotao="Emitir voucher"
        assistida
      />
    </Pagina>
  );
}
