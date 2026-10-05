import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Selo } from "@/components/formulario";
import { buttonVariants } from "@/components/ui/button";
import { ROTULO_STATUS, TEXTOS, TOM_STATUS, type StatusConteudo, type TipoCadastro } from "@/lib/cadastros/esquemas";

export type ItemLista = { id: string; titulo: string; status: StatusConteudo; detalhe?: string };

/** Lista de um tipo de cadastro, agrupada por estado, com estado vazio que explica o próximo passo. */
export function ListaCadastros({ tipo, itens, extra }: { tipo: TipoCadastro; itens: ItemLista[]; extra?: React.ReactNode }) {
  const t = TEXTOS[tipo];
  const ordem: StatusConteudo[] = ["publicado", "rascunho", "arquivado"];
  return (
    <>
      <Voltar href="/admin/conteudo" rotulo="Conteúdo" />
      <h1 className="text-[26px] font-bold">{t.plural}</h1>
      <Link href={`/admin/${tipo}/novo`} className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}>
        <Plus aria-hidden="true" /> {t.novo}
      </Link>
      {extra}
      {itens.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-superficie p-4">
          <p className="font-bold">Nenhum {t.singular} cadastrado.</p>
          <p className="text-muted-foreground">{t.vazio}</p>
        </div>
      ) : (
        ordem.map((status) => {
          const doStatus = itens.filter((i) => i.status === status);
          if (!doStatus.length) return null;
          return (
            <section key={status} aria-labelledby={`st-${status}`} className="flex flex-col gap-2">
              <h2 id={`st-${status}`} className="text-lg font-bold">
                {ROTULO_STATUS[status]} ({doStatus.length})
              </h2>
              <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
                {doStatus.map((i) => (
                  <li key={i.id} className="border-b last:border-b-0">
                    <Link
                      href={`/admin/${tipo}/${i.id}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-bold">{i.titulo}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Selo tom={TOM_STATUS[i.status]}>{ROTULO_STATUS[i.status]}</Selo>
                          {i.detalhe ? <span className="text-sm text-muted-foreground">{i.detalhe}</span> : null}
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
    </>
  );
}

export function Voltar({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="flex min-h-11 w-fit items-center gap-1.5 font-bold">
      <ArrowLeft aria-hidden="true" className="size-5" /> {rotulo}
    </Link>
  );
}

export function CabecalhoCadastro({ titulo, status, detalhe }: { titulo: string; status: StatusConteudo; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[26px] leading-tight font-bold">{titulo}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom={TOM_STATUS[status]}>{ROTULO_STATUS[status]}</Selo>
        {detalhe ? <span className="text-sm text-muted-foreground">{detalhe}</span> : null}
      </div>
    </div>
  );
}
