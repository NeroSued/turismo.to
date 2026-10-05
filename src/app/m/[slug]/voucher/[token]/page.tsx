import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagina } from "@/components/pagina";
import { BotoesComprovante, CancelarPeloVisitante } from "@/components/voucher/acoes-comprovante";
import { AvisoEmitido, CartaoVoucher } from "@/components/voucher/comprovante";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { paraComprovante } from "@/lib/voucher/formatar";
import { consultarPorToken } from "@/lib/voucher/publico";

export const metadata: Metadata = {
  title: "Seu voucher",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function NaoEncontrado({ limite }: { limite?: boolean }) {
  return (
    <Pagina>
      <h1 className="text-[28px] font-bold">{limite ? "Muitas consultas seguidas" : "Voucher não encontrado"}</h1>
      <p className="text-muted-foreground">
        {limite
          ? "Aguarde 10 minutos e abra o link de novo."
          : "Confira se o link está completo, do jeito que foi recebido. Se o voucher foi emitido em outro município, abra o link pelo portal desse município."}
      </p>
      <Link href="/" className="flex min-h-11 items-center font-bold">
        Voltar ao portal
      </Link>
    </Pagina>
  );
}

/** Comprovante do visitante, aberto pelo link com token (D6). Sem cache e sem referrer. */
export default async function Comprovante({ params }: PageProps<"/m/[slug]/voucher/[token]">) {
  const { slug, token } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const v = await consultarPorToken(municipio.id, token);
  if (v === "limite") return <NaoEncontrado limite />;
  if (!v) return <NaoEncontrado />;

  const dados = paraComprovante(v, v.municipio);
  return (
    <Pagina className="gap-[18px] print:max-w-none print:p-0">
      {v.status === "emitido" ? (
        <AvisoEmitido texto={v.modo === "reserva" ? "Voucher emitido. Guarde este comprovante." : "Registro feito. Guarde este comprovante."} />
      ) : null}
      <h1 className="sr-only">Voucher {formatarCodigo(v.codigo)}</h1>
      <CartaoVoucher v={dados} />
      {v.condicoes ? (
        <p className="text-sm text-[#3D4740]">
          <strong>Condições: </strong>
          {v.condicoes}
        </p>
      ) : null}
      <p className="text-sm text-[#3D4740]">
        Apresente este código à equipe no local. A presença só é confirmada por um operador da prefeitura.
      </p>
      <BotoesComprovante urlImagem={`/voucher/${token}/comprovante`} nomeArquivo={`voucher-${formatarCodigo(v.codigo)}.png`} />
      <CancelarPeloVisitante token={token} cancelavel={v.status === "emitido"} />
      <Link href="/" className="flex min-h-11 items-center font-bold print:hidden">
        Voltar ao portal de {v.municipio}
      </Link>
    </Pagina>
  );
}
