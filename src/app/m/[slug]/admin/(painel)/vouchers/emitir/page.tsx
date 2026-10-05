import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { listarAtividades } from "@/lib/atividades/dados";
import { ROTULO_MODO } from "@/lib/atividades/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Emitir voucher" };

export default async function EscolherAtividade({ params }: PageProps<"/m/[slug]/admin/vouchers/emitir">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor", "operador"]);
  const atividades = await listarAtividades(municipio.id, true);
  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] leading-tight font-bold">Emitir voucher para visitante sem celular</h1>
      <p className="text-muted-foreground">
        Escolha a atividade. Você preenche os dados com o visitante e entrega o comprovante impresso ou mostra o código na tela.
      </p>
      {atividades.length === 0 ? (
        <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
          Nenhuma atividade publicada. Peça ao gestor para publicar uma atividade no painel (Conteúdo) antes de emitir vouchers.
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {atividades.map((a) => (
            <li key={a.id} className="border-b last:border-b-0">
              <Link
                href={`/admin/vouchers/emitir/${a.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{a.titulo}</span>
                  <span className="text-sm text-muted-foreground">{ROTULO_MODO[a.modo]}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
