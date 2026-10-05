import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { TelaBloqueio } from "@/components/painel/atendimento";
import { buttonVariants } from "@/components/ui/button";
import { BotaoImprimir } from "@/components/voucher/acoes-comprovante";
import { AvisoEmitido, CartaoVoucher } from "@/components/voucher/comprovante";
import { exigirPainel } from "@/lib/painel/contexto";
import { normalizarCodigo } from "@/lib/voucher/esquemas";
import { paraComprovante } from "@/lib/voucher/formatar";
import { conferirVoucher } from "@/lib/voucher/painel";

export const metadata: Metadata = { title: "Comprovante" };

/** Comprovante de um voucher do município, para imprimir ou mostrar ao visitante (emissão assistida). */
export default async function ComprovantePainel({ params, searchParams }: PageProps<"/m/[slug]/admin/vouchers/[codigo]">) {
  const { slug, codigo: bruto } = await params;
  const { emitido } = await searchParams;
  const { municipio } = await exigirPainel(slug, ["gestor", "operador"]);
  const codigo = normalizarCodigo(decodeURIComponent(bruto));
  const r = await conferirVoucher(municipio.id, codigo);
  if (r.resultado !== "encontrado" || !r.voucher) {
    return (
      <Pagina className="pt-4">
        <TelaBloqueio resultado={r} codigo={codigo} municipio={municipio.nome} />
      </Pagina>
    );
  }
  const v = r.voucher;
  return (
    <Pagina className="gap-[18px] pt-2 print:max-w-none print:p-0">
      {emitido && v.status === "emitido" ? (
        <AvisoEmitido texto="Voucher emitido. Imprima o comprovante ou mostre o código ao visitante." />
      ) : null}
      <h1 className="sr-only">Comprovante do voucher</h1>
      <CartaoVoucher v={paraComprovante(v, municipio.nome)} />
      <p className="text-sm text-[#3D4740]">
        Apresente este código à equipe no local. A presença só é confirmada por um operador da prefeitura.
      </p>
      <div className="grid grid-cols-2 gap-2.5 print:hidden">
        <BotaoImprimir />
        <Link href="/admin/vouchers/emitir" className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}>
          Emitir outro
        </Link>
      </div>
      <Link href="/admin/atendimento" className="flex min-h-11 items-center font-bold print:hidden">
        Voltar ao atendimento
      </Link>
    </Pagina>
  );
}
