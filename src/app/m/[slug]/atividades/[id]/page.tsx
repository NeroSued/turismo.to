import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioReserva } from "@/components/portal/reserva";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { emitirReserva } from "@/lib/voucher/acoes-publicas";
import { dadosDaReserva } from "@/lib/voucher/opcoes";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/atividades/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  const dados = municipio ? await dadosDaReserva(municipio.id, id) : null;
  return { title: dados ? dados.atividade.titulo : "Atividade" };
}

export default async function Reserva({ params }: PageProps<"/m/[slug]/atividades/[id]">) {
  const { slug, id } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const dados = await dadosDaReserva(municipio.id, id);
  if (!dados) notFound();
  const { atividade } = dados;
  const reserva = atividade.modo === "reserva";

  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2.5">
        <Link href="/" aria-label="Voltar ao portal" className="flex size-11 items-center justify-center rounded-xl text-foreground">
          <ArrowLeft aria-hidden="true" className="size-[22px]" />
        </Link>
        <h1 className="text-xl font-bold">{reserva ? "Reserva gratuita" : "Registro de visita"}</h1>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 pb-7">
        <div className="flex flex-col gap-2 rounded-2xl border bg-superficie p-3.5">
          <span className="text-[17px] font-bold">{atividade.titulo}</span>
          <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {municipio.nome}
            {atividade.local_encontro ? ` · ${reserva ? "ponto de encontro" : "local"}: ${atividade.local_encontro}` : ""}
          </span>
          <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">
            Gratuito · sem cobrança
          </span>
          {atividade.descricao ? <p className="text-[15px]">{atividade.descricao}</p> : null}
          {atividade.condicoes ? (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Condições: </strong>
              {atividade.condicoes}
            </p>
          ) : null}
        </div>
        <FormularioReserva
          atividade={atividade}
          sessoes={dados.opcoes}
          chave={dados.chave}
          hoje={dados.hoje}
          ultimoDia={dados.ultimoDia}
          acao={emitirReserva}
          rotuloBotao={reserva ? "Emitir voucher gratuito" : "Registrar visita"}
        />
      </main>
    </>
  );
}
