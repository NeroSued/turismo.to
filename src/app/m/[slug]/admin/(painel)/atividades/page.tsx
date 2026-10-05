import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { buttonVariants } from "@/components/ui/button";
import { listarAtividades } from "@/lib/atividades/dados";
import { ROTULO_MODO, ROTULO_STATUS, type StatusAtividade } from "@/lib/atividades/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Atividades" };

const TOM: Record<StatusAtividade, "verde" | "dourado" | "cinza"> = { publicado: "verde", rascunho: "dourado", arquivado: "cinza" };
const ORDEM: StatusAtividade[] = ["publicado", "rascunho", "arquivado"];

export default async function Atividades({ params }: PageProps<"/m/[slug]/admin/atividades">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const atividades = await listarAtividades(municipio.id);

  return (
    <Pagina className="pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold">Atividades com voucher</h1>
      </div>
      <Link href="/admin/atividades/nova" className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}>
        <Plus aria-hidden="true" /> Nova atividade
      </Link>

      {atividades.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-superficie p-4">
          <p className="font-bold">Nenhuma atividade cadastrada.</p>
          <p className="text-muted-foreground">
            Crie uma atividade de reserva gratuita (passeio, visita guiada) ou de registro voluntário (atrativo de acesso
            livre). Depois adicione horários, se for reserva, e publique para que apareça no portal.
          </p>
        </div>
      ) : (
        ORDEM.map((status) => {
          const doStatus = atividades.filter((a) => a.status === status);
          if (!doStatus.length) return null;
          return (
            <section key={status} aria-labelledby={`st-${status}`} className="flex flex-col gap-2">
              <h2 id={`st-${status}`} className="text-lg font-bold">
                {ROTULO_STATUS[status]} ({doStatus.length})
              </h2>
              <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
                {doStatus.map((a) => (
                  <li key={a.id} className="border-b last:border-b-0">
                    <Link
                      href={`/admin/atividades/${a.id}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-bold">{a.titulo}</span>
                        <span className="flex flex-wrap gap-1.5">
                          <Selo tom={TOM[a.status]}>{ROTULO_STATUS[a.status]}</Selo>
                          <span className="text-sm text-muted-foreground">{ROTULO_MODO[a.modo]}</span>
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </Pagina>
  );
}
