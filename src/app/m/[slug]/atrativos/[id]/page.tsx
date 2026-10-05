import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarAtrativo, listarFotos } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO } from "@/lib/cadastros/esquemas";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { atividadesPublicadas } from "@/lib/portal/dados";
import { resumo } from "@/lib/portal/metadados";

async function carregar(slug: string, id: string) {
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) return null;
  // Rascunho ou arquivado: 404, como se não existisse (mesmo para um membro logado).
  const atrativo = await buscarAtrativo(municipio.id, id, { publicado: true });
  return atrativo ? { municipio, atrativo } : null;
}

export async function generateMetadata({ params }: PageProps<"/m/[slug]/atrativos/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) return {};
  const [foto] = await listarFotos(d.municipio.id, "atrativo_id", [d.atrativo.id]);
  const descricao = resumo(d.atrativo.descricao) ?? `${CATEGORIAS_ATRATIVO[d.atrativo.categoria]} em ${nomeDoMunicipio(d.municipio)}, Tocantins.`;
  return {
    title: d.atrativo.nome,
    description: descricao,
    openGraph: {
      title: d.atrativo.nome,
      description: descricao,
      images: foto ? [{ url: urlPublica(foto.caminho), alt: foto.legenda }] : undefined,
    },
  };
}

function Info({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] font-bold text-muted-foreground">{titulo}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default async function Atrativo({ params }: PageProps<"/m/[slug]/atrativos/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, atrativo: a } = d;
  const [fotos, atividades] = await Promise.all([
    listarFotos(municipio.id, "atrativo_id", [a.id]),
    atividadesPublicadas(municipio.id),
  ]);
  const ligadas = atividades.filter((x) => x.atrativo_id === a.id);
  const mapa =
    a.latitude !== null && a.longitude !== null
      ? `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=16/${a.latitude}/${a.longitude}`
      : null;

  return (
    <>
      <CabecalhoInterno titulo="Atrativo" voltar="/atrativos" rotuloVoltar="Voltar aos atrativos" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10">
        {fotos.length ? (
          <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1" aria-label="Fotos">
            {fotos.map((f, i) => (
              <li key={f.id} className="w-[88%] shrink-0 snap-start">
                <figure className="flex flex-col gap-1.5">
                  <FotoPortal caminho={f.caminho} legenda={f.legenda} className="h-56 rounded-[18px]" sizes="(max-width: 576px) 88vw, 480px" prioridade={i === 0} />
                  <figcaption className="text-sm text-muted-foreground">{f.legenda}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className="w-fit rounded-full bg-verde-suave px-2.5 py-0.5 text-[13px] font-bold text-primary">{CATEGORIAS_ATRATIVO[a.categoria]}</span>
          <h1 className="text-[32px] leading-tight font-bold">{a.nome}</h1>
          {a.descricao ? <p className="text-[17px] whitespace-pre-line">{a.descricao}</p> : null}
        </div>
        <dl className="flex flex-col gap-3.5 rounded-2xl border bg-superficie p-4">
          {a.endereco ? <Info titulo="Endereço ou como chegar">{a.endereco}</Info> : null}
          {mapa ? (
            <Info titulo="Localização">
              <a href={mapa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-bold">
                Ver no mapa <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">(abre o OpenStreetMap em outra aba)</span>
              </a>
            </Info>
          ) : null}
          {a.horarios ? <Info titulo="Horários">{a.horarios}</Info> : null}
          {a.contato ? <Info titulo="Contato">{a.contato}</Info> : null}
          {a.condicoes_acesso ? <Info titulo="Condições de acesso">{a.condicoes_acesso}</Info> : null}
          {a.acessibilidade ? <Info titulo="Acessibilidade">{a.acessibilidade}</Info> : null}
          {a.orientacoes_ambientais ? <Info titulo="Orientações ambientais">{a.orientacoes_ambientais}</Info> : null}
          {!a.endereco && !mapa && !a.horarios && !a.contato && !a.condicoes_acesso && !a.acessibilidade && !a.orientacoes_ambientais ? (
            <p className="text-muted-foreground">Horários e orientações de visita ainda não foram informados. Fale com a Secretaria de Turismo antes de ir.</p>
          ) : null}
        </dl>
        {ligadas.length ? (
          <section aria-labelledby="atividades-atrativo" className="flex flex-col gap-2">
            <h2 id="atividades-atrativo" className="text-xl font-bold">Atividades gratuitas aqui</h2>
            {ligadas.map((x) => (
              <Link key={x.id} href={`/atividades/${x.id}`} className="flex min-h-14 items-center rounded-2xl border bg-superficie px-4 font-bold text-foreground no-underline hover:border-primary hover:text-foreground">
                {x.titulo} · {x.modo === "reserva" ? "reservar" : "registrar visita"}
              </Link>
            ))}
          </section>
        ) : null}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
