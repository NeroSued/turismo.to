import { Building2, CalendarDays, Clock, Landmark, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Caminho, CapaDetalhe, CorpoDetalhe, FaixaFotos, fotosDaGaleria, Linha, OutrosCartoes, Paragrafos } from "@/components/portal/detalhe";
import { CabecalhoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { GaleriaProvider } from "@/components/portal/galeria";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarEvento, listarEventos, listarFotos, primeiraFotoDe } from "@/lib/cadastros/dados";
import { formatarDataComSemana, formatarHora, formatarPeriodo } from "@/lib/datas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { resumo } from "@/lib/portal/metadados";

async function carregar(slug: string, id: string) {
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) return null;
  const evento = await buscarEvento(municipio.id, id, { publicado: true });
  return evento ? { municipio, evento } : null;
}

export async function generateMetadata({ params }: PageProps<"/m/[slug]/eventos/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) return {};
  const [foto] = await listarFotos(d.municipio.id, "evento_id", [d.evento.id]);
  const descricao = resumo(d.evento.descricao) ?? `${formatarDataComSemana(d.evento.inicio)} em ${nomeDoMunicipio(d.municipio)}, Tocantins.`;
  return {
    title: d.evento.titulo,
    description: descricao,
    openGraph: {
      title: d.evento.titulo,
      description: descricao,
      images: foto ? [{ url: urlPublica(foto.caminho), alt: textoAlternativo(foto.legenda, 0, d.evento.titulo) }] : undefined,
    },
  };
}


/** Detalhe do evento, com capa e galeria como o atrativo. */
export default async function EventoPublico({ params }: PageProps<"/m/[slug]/eventos/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, evento: e } = d;
  const [fotos, proximos] = await Promise.all([
    listarFotos(municipio.id, "evento_id", [e.id]),
    listarEventos(municipio.id, { publicados: true, aPartirDe: new Date(), limite: 5 }),
  ]);
  const outros = proximos.filter((x) => x.id !== e.id).slice(0, 4);
  const capasOutros = await primeiraFotoDe(municipio.id, "evento_id", outros.map((x) => x.id));
  const nomeMunicipio = nomeDoMunicipio(municipio);
  // O atrativo ligado só aparece se estiver publicado.
  const atrativo = e.atrativos?.status === "publicado" ? e.atrativos : null;

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, e.titulo)} nome={e.titulo}>
      <CabecalhoPortal municipio={municipio} soComputador />
      <Caminho municipio={nomeMunicipio} secao={{ href: "/eventos", rotulo: "Eventos" }} nome={e.titulo} />
      <CapaDetalhe fotos={fotos} nome={e.titulo} voltar="/eventos" rotuloVoltar="Voltar ao calendário" />
      <CorpoDetalhe
        texto={
          <>
            <div className="order-1 flex flex-col gap-2 md:gap-2.5">
              <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary md:px-2.5 md:text-[13px]">Evento</span>
              <h1 className="text-[32px] leading-[1.05] font-bold tracking-[-0.015em] md:text-[clamp(36px,4vw,52px)] md:leading-[1.02] md:tracking-[-0.02em]">{e.titulo}</h1>
              <p className="text-[15px] text-muted-foreground md:text-lg">
                {nomeMunicipio}, Tocantins<span className="hidden md:inline"> · {formatarPeriodo(e.inicio, e.fim)}</span>
              </p>
            </div>
            {e.descricao ? (
              <section aria-labelledby="sobre" className="order-3 flex flex-col gap-2 md:gap-3">
                <h2 id="sobre" className="text-[21px] font-bold md:text-[26px]">Sobre</h2>
                <Paragrafos texto={e.descricao} />
              </section>
            ) : null}
            <FaixaFotos fotos={fotos} nome={e.titulo} className="order-4" />
          </>
        }
        lateral={
          <dl className="order-2 -mt-3 overflow-hidden rounded-2xl border bg-superficie md:rounded-[18px] lg:mt-0">
            <Linha icone={CalendarDays} titulo="Início">
              {formatarDataComSemana(e.inicio)}, {formatarHora(e.inicio)}
            </Linha>
            <Linha icone={Clock} titulo="Término">
              {formatarDataComSemana(e.fim)}, {formatarHora(e.fim)}
            </Linha>
            {e.local ? <Linha icone={MapPin} titulo="Local">{e.local}</Linha> : null}
            {atrativo ? (
              <Linha icone={Landmark} titulo="Atrativo">
                <Link href={`/atrativos/${atrativo.id}`} className="inline-flex min-h-11 items-center">{atrativo.nome}</Link>
              </Linha>
            ) : null}
            {e.organizador ? <Linha icone={Building2} titulo="Organização">{e.organizador}</Linha> : null}
          </dl>
        }
        depois={
          <OutrosCartoes
            titulo="Próximos eventos"
            itens={outros.map((o) => ({ href: `/eventos/${o.id}`, nome: o.titulo, rotulo: formatarPeriodo(o.inicio, o.fim), foto: capasOutros.get(o.id) }))}
          />
        }
      />
      <RodapePortal municipio={municipio} />
    </GaleriaProvider>
  );
}
