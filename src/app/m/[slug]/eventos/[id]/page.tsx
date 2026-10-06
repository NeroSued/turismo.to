import { Building2, CalendarDays, Clock, Landmark, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CapaDetalhe, FaixaFotos, fotosDaGaleria, Linha, Paragrafos } from "@/components/portal/detalhe";
import { nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { GaleriaProvider } from "@/components/portal/galeria";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarEvento, listarFotos } from "@/lib/cadastros/dados";
import { formatarDataComSemana, formatarHora } from "@/lib/datas";
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
  const fotos = await listarFotos(municipio.id, "evento_id", [e.id]);
  // O atrativo ligado só aparece se estiver publicado.
  const atrativo = e.atrativos?.status === "publicado" ? e.atrativos : null;

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, e.titulo)} nome={e.titulo}>
      <CapaDetalhe fotos={fotos} nome={e.titulo} voltar="/eventos" rotuloVoltar="Voltar ao calendário" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 pt-[18px] pb-10">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">Evento</span>
          <h1 className="text-[32px] leading-[1.05] font-bold tracking-[-0.015em]">{e.titulo}</h1>
          <p className="text-[15px] text-muted-foreground">{nomeDoMunicipio(municipio)}, Tocantins</p>
        </div>
        <dl className="-mt-3 overflow-hidden rounded-2xl border bg-superficie">
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
        {e.descricao ? (
          <section aria-labelledby="sobre" className="flex flex-col gap-2">
            <h2 id="sobre" className="text-[21px] font-bold">Sobre</h2>
            <Paragrafos texto={e.descricao} />
          </section>
        ) : null}
        <FaixaFotos fotos={fotos} nome={e.titulo} />
      </main>
      <RodapePortal municipio={municipio} />
    </GaleriaProvider>
  );
}
