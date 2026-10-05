import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { ListaCadastros } from "@/components/painel/telas-cadastro";
import { listarEventos } from "@/lib/cadastros/dados";
import { formatarData } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Eventos" };

export default async function Eventos({ params }: PageProps<"/m/[slug]/admin/eventos">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const itens = await listarEventos(municipio.id);
  return (
    <Pagina className="pt-2">
      <ListaCadastros
        tipo="eventos"
        itens={itens.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          status: e.status,
          detalhe:
            formatarData(e.inicio) === formatarData(e.fim) ? formatarData(e.inicio) : `${formatarData(e.inicio)} a ${formatarData(e.fim)}`,
        }))}
        extra={
          <Link
            href="/admin/atividades"
            className="flex min-h-14 items-center gap-3 rounded-2xl border bg-superficie px-4 py-3 text-foreground no-underline hover:text-foreground"
          >
            <span className="flex flex-1 flex-col">
              <span className="font-bold">Atividades com voucher</span>
              <span className="text-sm text-muted-foreground">
                Passeios com reserva gratuita e registros voluntários ficam em Atividades.
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
          </Link>
        }
      />
    </Pagina>
  );
}
