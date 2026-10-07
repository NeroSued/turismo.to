import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Caminho, CapaDetalhe, CorpoDetalhe, FaixaFotos, fotosDaGaleria, Paragrafos } from "@/components/portal/detalhe";
import { CabecalhoPortal, FotoPortal, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { AbrirGaleria, GaleriaProvider } from "@/components/portal/galeria";
import { FormularioReserva } from "@/components/portal/reserva";
import { listarFotos } from "@/lib/cadastros/dados";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { emitirReserva } from "@/lib/voucher/acoes-publicas";
import { dadosDaReserva } from "@/lib/voucher/opcoes";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/atividades/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  const dados = municipio ? await dadosDaReserva(municipio.id, id) : null;
  return { title: dados ? dados.atividade.titulo : "Atividade" };
}

/**
 * Reserva gratuita ou registro de visita. No celular, a tela "Reserva gratuita"; a partir de
 * 768 px, mosaico de fotos, texto à esquerda e o formulário à direita (tela "Atrativo · detalhe").
 */
export default async function Reserva({ params }: PageProps<"/m/[slug]/atividades/[id]">) {
  const { slug, id } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const dados = await dadosDaReserva(municipio.id, id);
  if (!dados) notFound();
  const { atividade } = dados;
  const reserva = atividade.modo === "reserva";
  const fotos = await listarFotos(municipio.id, "atividade_id", [atividade.id]);
  const rotulo = reserva ? "Reserva gratuita" : "Registro de visita";

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, atividade.titulo)} nome={atividade.titulo}>
      <CabecalhoPortal municipio={municipio} soComputador />
      <Caminho municipio={nomeDoMunicipio(municipio)} secao={{ href: "/#atividades", rotulo: "Atividades" }} nome={atividade.titulo} />
      <header className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2.5 md:hidden">
        <Link href="/" aria-label="Voltar ao portal" className="flex size-11 items-center justify-center rounded-xl text-foreground">
          <ArrowLeft aria-hidden="true" className="size-[22px]" />
        </Link>
        <h1 className="text-xl font-bold">{rotulo}</h1>
      </header>
      <CapaDetalhe fotos={fotos} nome={atividade.titulo} voltar="/" rotuloVoltar="Voltar ao portal" soComputador />
      <CorpoDetalhe
        className="pt-0 pb-7 md:pt-9 md:pb-16"
        texto={
          <>
            <div className="order-0 hidden flex-col gap-2.5 md:flex">
              <span className="w-fit rounded-full bg-verde-suave px-2.5 py-0.5 text-[13px] font-bold text-primary">{rotulo}</span>
              <h1 className="text-[clamp(36px,4vw,52px)] leading-[1.02] font-bold tracking-[-0.02em]">{atividade.titulo}</h1>
            </div>
            <div className="order-1 flex flex-col gap-2 overflow-hidden rounded-2xl border bg-superficie p-3.5 md:gap-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0">
              {fotos[0] ? (
                <AbrirGaleria indice={0} className="-mx-3.5 -mt-3.5 mb-1 block p-0 md:hidden">
                  <FotoPortal
                    caminho={fotos[0].caminho}
                    legenda={textoAlternativo(fotos[0].legenda, 0, atividade.titulo)}
                    className="h-48"
                    sizes="(max-width: 576px) 100vw, 576px"
                    prioridade
                  />
                  <span className="sr-only">. Abrir galeria com {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span>
                </AbrirGaleria>
              ) : null}
              <span className="text-[17px] font-bold md:hidden">{atividade.titulo}</span>
              <span className="flex items-start gap-1.5 text-sm text-muted-foreground md:text-lg">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 md:mt-1 md:size-5" />
                {municipio.nome}
                {atividade.local_encontro ? ` · ${reserva ? "ponto de encontro" : "local"}: ${atividade.local_encontro}` : ""}
              </span>
              <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto md:px-2.5 md:text-[13px]">
                Gratuito · sem cobrança
              </span>
              <Paragrafos texto={atividade.descricao} className="text-[15px] whitespace-pre-line md:max-w-[68ch] md:text-[17px] md:leading-[1.55] md:text-[#2A352E]" />
              {atividade.condicoes ? (
                <p className="text-sm text-muted-foreground md:rounded-[18px] md:bg-dourado-suave md:px-6 md:py-5 md:text-base md:text-[#4A3408]">
                  <strong className="text-foreground md:text-[#4A3408]">Condições: </strong>
                  {atividade.condicoes}
                </p>
              ) : null}
            </div>
            <FaixaFotos fotos={fotos} nome={atividade.titulo} className="order-2" />
          </>
        }
        lateral={
          <div className="order-3 lg:sticky lg:top-6">
            <FormularioReserva
              atividade={atividade}
              sessoes={dados.opcoes}
              chave={dados.chave}
              hoje={dados.hoje}
              ultimoDia={dados.ultimoDia}
              acao={emitirReserva}
              rotuloBotao={reserva ? "Emitir voucher gratuito" : "Registrar visita"}
            />
          </div>
        }
      />
      <div className="hidden md:block">
        <RodapePortal municipio={municipio} />
      </div>
    </GaleriaProvider>
  );
}
