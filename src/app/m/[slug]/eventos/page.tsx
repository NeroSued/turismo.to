import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPortal, CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { BlocoData, horarioDoEvento } from "@/components/portal/eventos";
import { listarEventos, primeiraFotoDe, type Evento } from "@/lib/cadastros/dados";
import { formatarMesAno } from "@/lib/datas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
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
  const capas = await primeiraFotoDe(municipio.id, "evento_id", eventos.map((e) => e.id));
  const meses = new Map<string, Evento[]>();
  for (const e of eventos) {
    const m = formatarMesAno(e.inicio);
    meses.set(m, [...(meses.get(m) ?? []), e]);
  }

  return (
    <>
      <CabecalhoInterno titulo="Calendário de eventos" className="md:hidden" />
      <CabecalhoPortal municipio={municipio} soComputador />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col md:max-w-[1248px] md:px-6 gap-6 px-4 pb-10">
        <h1 className="sr-only md:not-sr-only md:pt-6 md:text-[clamp(36px,4vw,48px)] md:leading-[1.05] md:font-bold md:tracking-[-0.02em]">Calendário de eventos de {nomeDoMunicipio(municipio)}</h1>
        {eventos.length === 0 ? (
          <Vazio>Nenhum evento divulgado por enquanto. Festas, feiras e festivais aparecem aqui assim que a Secretaria publicar.</Vazio>
        ) : (
          [...meses].map(([mes, lista]) => (
            <section key={mes} aria-label={mes} className="flex flex-col gap-1">
              <h2 className="text-xl font-bold md:text-[26px] md:first-letter:uppercase">{mes}</h2>
              <ul className="flex flex-col md:grid md:grid-cols-2 md:gap-x-8">
                {lista.map((e) => (
                  <li key={e.id}>
                    <Link href={`/eventos/${e.id}`} className="flex items-center gap-3.5 border-b py-2.5 text-foreground no-underline hover:text-foreground">
                      <BlocoData inicio={e.inicio} fim={e.fim} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[17px] font-bold">{e.titulo}</span>
                        <span className="text-sm text-muted-foreground">{[e.local, horarioDoEvento(e.inicio, e.fim)].filter(Boolean).join(" · ")}</span>
                        {e.organizador ? <span className="text-sm text-muted-foreground">Organização: {e.organizador}</span> : null}
                      </span>
                      {capas.get(e.id) ? (
                        <FotoPortal
                          caminho={capas.get(e.id)?.caminho}
                          legenda={textoAlternativo(capas.get(e.id)?.legenda, 0, e.titulo)}
                          className="size-[72px] shrink-0 rounded-xl"
                          sizes="72px"
                        />
                      ) : null}
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
