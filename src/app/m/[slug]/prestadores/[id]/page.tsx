import { MapPin, MessageCircle, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Caminho, CapaDetalhe, CorpoDetalhe, FaixaFotos, fotosDaGaleria, Linha, OutrosCartoes, Paragrafos } from "@/components/portal/detalhe";
import { CabecalhoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { GaleriaProvider } from "@/components/portal/galeria";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarPrestador, listarFotos, listarPrestadores, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_PRESTADOR } from "@/lib/cadastros/esquemas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { resumo } from "@/lib/portal/metadados";

async function carregar(slug: string, id: string) {
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) return null;
  // Rascunho, arquivado ou desligado da rede: 404, como na lista pública.
  const prestador = await buscarPrestador(municipio.id, id, { publicado: true });
  return prestador ? { municipio, prestador } : null;
}

export async function generateMetadata({ params }: PageProps<"/m/[slug]/prestadores/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) return {};
  const [foto] = await listarFotos(d.municipio.id, "prestador_id", [d.prestador.id]);
  const p = d.prestador;
  const descricao = resumo(p.descricao) ?? `${CATEGORIAS_PRESTADOR[p.categoria]} da rede municipal de turismo de ${nomeDoMunicipio(d.municipio)}, Tocantins.`;
  return {
    title: p.nome_publico,
    description: descricao,
    openGraph: {
      title: p.nome_publico,
      description: descricao,
      images: foto ? [{ url: urlPublica(foto.caminho), alt: textoAlternativo(foto.legenda, 0, p.nome_publico) }] : undefined,
    },
  };
}


/**
 * Detalhe público do prestador: só o que é público (nome, categoria, descrição, serviços,
 * contatos autorizados e localização). Adesão, responsável e contato interno nunca entram aqui.
 */
export default async function PrestadorPublico({ params }: PageProps<"/m/[slug]/prestadores/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, prestador: p } = d;
  const [fotos, rede] = await Promise.all([listarFotos(municipio.id, "prestador_id", [p.id]), listarPrestadores(municipio.id, { publicados: true })]);
  // Primeiro os da mesma categoria, depois os demais.
  const outros = [...rede.filter((x) => x.id !== p.id && x.categoria === p.categoria), ...rede.filter((x) => x.id !== p.id && x.categoria !== p.categoria)].slice(0, 4);
  const capasOutros = await primeiraFotoDe(municipio.id, "prestador_id", outros.map((x) => x.id));
  const nomeMunicipio = nomeDoMunicipio(municipio);
  const temInfo = Boolean(p.servicos || p.contatos_publicos || p.localizacao);

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, p.nome_publico)} nome={p.nome_publico}>
      <CabecalhoPortal municipio={municipio} soComputador />
      <Caminho municipio={nomeMunicipio} secao={{ href: "/prestadores", rotulo: "Rede de prestadores" }} nome={p.nome_publico} />
      <CapaDetalhe fotos={fotos} nome={p.nome_publico} voltar="/prestadores" rotuloVoltar="Voltar à rede de prestadores" />
      <CorpoDetalhe
        texto={
          <>
            <div className="order-1 flex flex-col gap-2 md:gap-2.5">
              <span className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">{CATEGORIAS_PRESTADOR[p.categoria]}</span>
                {p.situacao_rede === "em_adesao" ? (
                  <span className="rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">Em adesão à rede</span>
                ) : null}
              </span>
              <h1 className="text-[32px] leading-[1.05] font-bold tracking-[-0.015em] md:text-[clamp(36px,4vw,52px)] md:leading-[1.02] md:tracking-[-0.02em]">{p.nome_publico}</h1>
              <p className="text-[15px] text-muted-foreground md:text-lg">Rede municipal de turismo de {nomeMunicipio}</p>
            </div>
            {p.descricao ? (
              <section aria-labelledby="sobre" className="order-3 flex flex-col gap-2 md:gap-3">
                <h2 id="sobre" className="text-[21px] font-bold md:text-[26px]">Sobre</h2>
                <Paragrafos texto={p.descricao} />
              </section>
            ) : null}
            <FaixaFotos fotos={fotos} nome={p.nome_publico} className="order-4" />
          </>
        }
        lateral={
          temInfo ? (
            <dl className="order-2 -mt-3 overflow-hidden rounded-2xl border bg-superficie md:rounded-[18px] lg:mt-0">
              {p.servicos ? <Linha icone={Wrench} titulo="Serviços">{p.servicos}</Linha> : null}
              {p.contatos_publicos ? <Linha icone={MessageCircle} titulo="Contato">{p.contatos_publicos}</Linha> : null}
              {p.localizacao ? <Linha icone={MapPin} titulo="Localização">{p.localizacao}</Linha> : null}
            </dl>
          ) : null
        }
        depois={
          <OutrosCartoes
            titulo="Outros prestadores da rede"
            itens={outros.map((o) => ({ href: `/prestadores/${o.id}`, nome: o.nome_publico, rotulo: CATEGORIAS_PRESTADOR[o.categoria], foto: capasOutros.get(o.id) }))}
          />
        }
      />
      <RodapePortal municipio={municipio} />
    </GaleriaProvider>
  );
}
