import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { ConferenciaVoucher, TelaBloqueio } from "@/components/painel/atendimento";
import { exigirPainel } from "@/lib/painel/contexto";
import { normalizarCodigo } from "@/lib/voucher/esquemas";
import { conferirVoucher, type ResultadoVoucher } from "@/lib/voucher/painel";

export const metadata: Metadata = { title: "Conferir voucher" };

/** Conferência do código lido ou digitado. O banco decide o estado; a tela só mostra. */
export default async function Conferir({ params }: PageProps<"/m/[slug]/admin/atendimento/[codigo]">) {
  const { slug, codigo: bruto } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor", "operador"]);
  const codigo = normalizarCodigo(decodeURIComponent(bruto));
  const r = await conferirVoucher(municipio.id, codigo);

  let tela: ResultadoVoucher = r;
  if (r.resultado === "encontrado" && r.voucher) {
    const v = r.voucher;
    if (v.status === "emitido" && v.valido_hoje) {
      return (
        <Pagina className="gap-4 pt-2">
          <ConferenciaVoucher v={v} municipio={municipio.nome} />
        </Pagina>
      );
    }
    const porStatus = { emitido: "fora_do_dia", utilizado: "ja_utilizado", cancelado: "cancelado", expirado: "expirado" } as const;
    tela = { resultado: porStatus[v.status], voucher: v };
  }
  return (
    <Pagina className="gap-4 pt-4">
      <TelaBloqueio resultado={tela} codigo={codigo} municipio={municipio.nome} />
    </Pagina>
  );
}
