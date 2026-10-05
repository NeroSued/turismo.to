import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarEvento, listarFotos } from "@/lib/cadastros/dados";
import { formatarDataComSemana, formatarHora } from "@/lib/datas";
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
    openGraph: { title: d.evento.titulo, description: descricao, images: foto ? [{ url: urlPublica(foto.caminho), alt: foto.legenda }] : undefined },
  };
}

export default async function EventoPublico({ params }: PageProps<"/m/[slug]/eventos/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, evento: e } = d;
  const fotos = await listarFotos(municipio.id, "evento_id", [e.id]);
  // O atrativo ligado só aparece se estiver publicado.
  const atrativo = e.atrativos?.status === "publicado" ? e.atrativos : null;

  return (
    <>
      <CabecalhoInterno titulo="Evento" voltar="/eventos" rotuloVoltar="Voltar ao calendário" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10">
        {fotos[0] ? (
          <figure className="flex flex-col gap-1.5">
            <FotoPortal caminho={fotos[0].caminho} legenda={fotos[0].legenda} className="h-56 rounded-[18px]" sizes="(max-width: 576px) 100vw, 544px" prioridade />
            <figcaption className="text-sm text-muted-foreground">{fotos[0].legenda}</figcaption>
          </figure>
        ) : null}
        <h1 className="text-[32px] leading-tight font-bold">{e.titulo}</h1>
        <dl className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
          <div>
            <dt className="text-[13px] font-bold text-muted-foreground">Início</dt>
            <dd className="font-bold">{formatarDataComSemana(e.inicio)}, {formatarHora(e.inicio)}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-bold text-muted-foreground">Término</dt>
            <dd className="font-bold">{formatarDataComSemana(e.fim)}, {formatarHora(e.fim)}</dd>
          </div>
          {e.local ? (
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Local</dt>
              <dd>{e.local}</dd>
            </div>
          ) : null}
          {atrativo ? (
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Atrativo</dt>
              <dd>
                <Link href={`/atrativos/${atrativo.id}`} className="inline-flex min-h-11 items-center font-bold">{atrativo.nome}</Link>
              </dd>
            </div>
          ) : null}
          {e.organizador ? (
            <div>
              <dt className="text-[13px] font-bold text-muted-foreground">Organização</dt>
              <dd>{e.organizador}</dd>
            </div>
          ) : null}
        </dl>
        {e.descricao ? <p className="text-[17px] whitespace-pre-line">{e.descricao}</p> : null}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
