import { Accessibility, ChevronRight, Clock, ExternalLink, MapPin, Mountain, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Caminho, CapaDetalhe, CorpoDetalhe, FaixaFotos, fotosDaGaleria, Linha, OutrosCartoes, Paragrafos } from "@/components/portal/detalhe";
import { CabecalhoPortal, FotoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { BlocoData, horarioDoEvento } from "@/components/portal/eventos";
import { GaleriaProvider } from "@/components/portal/galeria";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarAtrativo, listarAtrativos, listarEventos, listarFotos, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO } from "@/lib/cadastros/esquemas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
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
      images: foto ? [{ url: urlPublica(foto.caminho), alt: textoAlternativo(foto.legenda, 0, d.atrativo.nome) }] : undefined,
    },
  };
}

const OUTROS = 4;

/** Detalhe do atrativo: tela "Atrativo · capa e galeria" no celular e "Atrativo · detalhe" no computador. */
export default async function Atrativo({ params }: PageProps<"/m/[slug]/atrativos/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, atrativo: a } = d;
  const [fotos, atividades, todos, eventos] = await Promise.all([
    listarFotos(municipio.id, "atrativo_id", [a.id]),
    atividadesPublicadas(municipio.id),
    listarAtrativos(municipio.id, { publicados: true }),
    listarEventos(municipio.id, { publicados: true, aPartirDe: new Date() }),
  ]);
  const ligadas = atividades.filter((x) => x.atrativo_id === a.id);
  const eventosAqui = eventos.filter((e) => e.atrativo_id === a.id);
  const outros = todos.filter((x) => x.id !== a.id).slice(0, OUTROS);
  const [capasAtividades, capasOutros] = await Promise.all([
    primeiraFotoDe(municipio.id, "atividade_id", ligadas.map((x) => x.id)),
    primeiraFotoDe(municipio.id, "atrativo_id", outros.map((x) => x.id)),
  ]);
  const mapa =
    a.latitude !== null && a.longitude !== null
      ? `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=16/${a.latitude}/${a.longitude}`
      : null;
  const temInfo = Boolean(a.horarios || a.condicoes_acesso || a.acessibilidade || a.contato);
  const nomeMunicipio = nomeDoMunicipio(municipio);

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, a.nome)} nome={a.nome}>
      <CabecalhoPortal municipio={municipio} soComputador />
      <Caminho municipio={nomeMunicipio} secao={{ href: "/#atrativos", rotulo: "Atrativos" }} nome={a.nome} />
      <CapaDetalhe fotos={fotos} nome={a.nome} voltar="/atrativos" rotuloVoltar="Voltar aos atrativos" />
      <CorpoDetalhe
        texto={
          <>
            <div className="order-1 flex flex-col gap-2 md:gap-2.5">
              <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary md:px-2.5 md:text-[13px]">
                {CATEGORIAS_ATRATIVO[a.categoria]}
              </span>
              <h1 className="text-[32px] leading-[1.05] font-bold tracking-[-0.015em] md:text-[clamp(36px,4vw,52px)] md:leading-[1.02] md:tracking-[-0.02em]">
                {a.nome}
              </h1>
              <p className="text-[15px] text-muted-foreground md:text-lg">{nomeMunicipio}, Tocantins</p>
            </div>

            {a.descricao ? (
              <section aria-labelledby="sobre" className="order-3 flex flex-col gap-2 md:gap-3">
                <h2 id="sobre" className="text-[21px] font-bold md:text-[26px]">Sobre</h2>
                <Paragrafos texto={a.descricao} />
              </section>
            ) : null}

            <FaixaFotos fotos={fotos} nome={a.nome} className="order-4" />

            {a.orientacoes_ambientais ? (
              <section
                aria-labelledby="orientacoes"
                className="order-7 flex flex-col gap-2 rounded-2xl bg-dourado-suave p-4 text-[#4A3408] md:rounded-[18px] md:px-6 md:py-[22px]"
              >
                <h2 id="orientacoes" className="text-[17px] font-bold md:text-[19px]">Orientações ambientais</h2>
                <Paragrafos texto={a.orientacoes_ambientais} className="text-[15px] whitespace-pre-line md:text-base" />
              </section>
            ) : null}

            {eventosAqui.length ? (
              <section aria-labelledby="eventos-aqui" className="order-8 hidden flex-col gap-3 md:flex">
                <h2 id="eventos-aqui" className="text-[26px] font-bold">Eventos aqui</h2>
                <ul className="flex flex-col gap-3">
                  {eventosAqui.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/eventos/${e.id}`}
                        className="flex items-center gap-4 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground"
                      >
                        <BlocoData inicio={e.inicio} fim={e.fim} className="size-[72px]" />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-lg font-bold">{e.titulo}</span>
                          <span className="text-[15px] text-muted-foreground">{[horarioDoEvento(e.inicio, e.fim), e.organizador].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        }
        lateral={
          <>
            {temInfo ? (
              <dl className="order-2 -mt-3 overflow-hidden rounded-2xl border bg-superficie md:rounded-[18px] lg:mt-0">
                {a.horarios ? <Linha icone={Clock} titulo="Horário">{a.horarios}</Linha> : null}
                {a.condicoes_acesso ? <Linha icone={Mountain} titulo="Acesso">{a.condicoes_acesso}</Linha> : null}
                {a.acessibilidade ? <Linha icone={Accessibility} titulo="Acessibilidade">{a.acessibilidade}</Linha> : null}
                {a.contato ? <Linha icone={Phone} titulo="Contato">{a.contato}</Linha> : null}
              </dl>
            ) : (
              <p className="order-2 -mt-3 rounded-2xl border bg-superficie p-4 text-muted-foreground lg:mt-0">
                Horários e orientações de visita ainda não foram informados. Fale com a Secretaria de Turismo antes de ir.
              </p>
            )}

            {ligadas.length ? (
              <section aria-labelledby="atividades-atrativo" className="order-5 flex flex-col gap-2.5">
                <h2 id="atividades-atrativo" className="text-[21px] font-bold">Atividades com voucher aqui</h2>
                {ligadas.map((x) => {
                  const capa = capasAtividades.get(x.id) ?? fotos[0];
                  return (
                    <Link
                      key={x.id}
                      href={`/atividades/${x.id}`}
                      className="flex items-center gap-3 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground"
                    >
                      <FotoPortal caminho={capa?.caminho} legenda="" className="size-[72px] shrink-0 rounded-xl" sizes="72px" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {x.modo === "reserva" ? (
                          <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">Reserva gratuita</span>
                        ) : (
                          <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">Registro voluntário</span>
                        )}
                        <span className="font-bold">{x.titulo}</span>
                        <span className="text-sm text-muted-foreground">{x.modo === "reserva" ? "Reservar vaga gratuita" : "Registrar minha visita"}</span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </section>
            ) : null}

            {a.endereco || mapa ? (
              <section aria-labelledby="como-chegar" className="order-6 flex flex-col gap-2.5 lg:rounded-[18px] lg:border lg:bg-superficie lg:p-[18px]">
                <h2 id="como-chegar" className="text-[21px] font-bold">Como chegar</h2>
                {a.endereco ? <p className="text-[15px] whitespace-pre-line text-[#2A352E]">{a.endereco}</p> : null}
                {mapa ? (
                  <a
                    href={mapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="box-border flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-foreground font-bold text-foreground no-underline hover:text-foreground"
                  >
                    <MapPin aria-hidden="true" className="size-5" /> Abrir no mapa
                    <ExternalLink aria-hidden="true" className="size-4" />
                    <span className="sr-only">(abre o OpenStreetMap em outra aba)</span>
                  </a>
                ) : null}
              </section>
            ) : null}
          </>
        }
        depois={
          <OutrosCartoes
            titulo={`Outros atrativos em ${nomeMunicipio}`}
            itens={outros.map((o) => ({ href: `/atrativos/${o.id}`, nome: o.nome, rotulo: CATEGORIAS_ATRATIVO[o.categoria], foto: capasOutros.get(o.id) }))}
          />
        }
      />
      <RodapePortal municipio={municipio} />
    </GaleriaProvider>
  );
}
