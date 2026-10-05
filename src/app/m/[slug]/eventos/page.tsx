import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoInterno, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { BlocoData, horarioDoEvento } from "@/components/portal/eventos";
import { listarEventos, type Evento } from "@/lib/cadastros/dados";
import { formatarMesAno } from "@/lib/datas";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/eventos">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  return m ? { title: "Calendário de eventos", description: `Festas, feiras e festivais de ${nomeDoMunicipio(m)}, Tocantins.` } : {};
}

/** Calendário: eventos publicados que ainda não terminaram, agrupados por mês de início. */
export default async function Calendario({ params }: PageProps<"/m/[slug]/eventos">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const eventos = await listarEventos(municipio.id, { publicados: true, aPartirDe: new Date() });
  const meses = new Map<string, Evento[]>();
  for (const e of eventos) {
    const m = formatarMesAno(e.inicio);
    meses.set(m, [...(meses.get(m) ?? []), e]);
  }

  return (
    <>
      <CabecalhoInterno titulo="Calendário de eventos" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-10">
        <h1 className="sr-only">Calendário de eventos de {nomeDoMunicipio(municipio)}</h1>
        {eventos.length === 0 ? (
          <Vazio>Nenhum evento divulgado por enquanto. Festas, feiras e festivais aparecem aqui assim que a Secretaria publicar.</Vazio>
        ) : (
          [...meses].map(([mes, lista]) => (
            <section key={mes} aria-label={mes} className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">{mes}</h2>
              <ul className="flex flex-col">
                {lista.map((e) => (
                  <li key={e.id}>
                    <Link href={`/eventos/${e.id}`} className="flex items-center gap-3.5 border-b py-2.5 text-foreground no-underline hover:text-foreground">
                      <BlocoData inicio={e.inicio} fim={e.fim} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[17px] font-bold">{e.titulo}</span>
                        <span className="text-sm text-muted-foreground">{[e.local, horarioDoEvento(e.inicio, e.fim)].filter(Boolean).join(" · ")}</span>
                        {e.organizador ? <span className="text-sm text-muted-foreground">Organização: {e.organizador}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
