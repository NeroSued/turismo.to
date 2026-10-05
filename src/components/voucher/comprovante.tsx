import { Check } from "lucide-react";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { caminhoDoQr, matrizDoQr } from "@/lib/voucher/qr";
import { cn } from "@/lib/utils";

export type DadosComprovante = {
  codigo: string;
  status: "emitido" | "utilizado" | "cancelado" | "expirado";
  municipio: string;
  atividade: string;
  modo: "reserva" | "registro_voluntario";
  data: string; // "Sáb, 12/10/2026"
  horario: string | null; // "08:00" (reserva)
  pessoas: number;
  pessoasAtendidas: number | null;
  origem: string; // "Gurupi/TO"
  localEncontro: string | null;
  responsavel?: string | null;
  utilizadoEm?: string | null; // já formatado
};

export function QrDoVoucher({ codigo, className }: { codigo: string; className?: string }) {
  const matriz = matrizDoQr(codigo);
  return (
    <svg
      role="img"
      aria-label={`QR Code do voucher ${formatarCodigo(codigo)}`}
      viewBox={`0 0 ${matriz.length} ${matriz.length}`}
      shapeRendering="crispEdges"
      className={cn("size-[216px] rounded-xl border bg-white", className)}
    >
      <rect width="100%" height="100%" fill="#FFFFFF" />
      <path d={caminhoDoQr(matriz)} fill="#16211B" />
    </svg>
  );
}

const SITUACAO: Record<DadosComprovante["status"], { texto: string; classe: string }> = {
  emitido: { texto: "Reservado · aguardando atendimento", classe: "bg-verde-suave text-primary" },
  utilizado: { texto: "Utilizado", classe: "bg-[#E4E7E0] text-[#3D4740]" },
  cancelado: { texto: "Cancelado", classe: "bg-erro-suave text-erro" },
  expirado: { texto: "Expirado", classe: "bg-[#E4E7E0] text-[#3D4740]" },
};

/** Cartão do voucher conforme a tela "Voucher emitido" do canvas. */
export function CartaoVoucher({ v }: { v: DadosComprovante }) {
  const situacao =
    v.status === "emitido" && v.modo === "registro_voluntario"
      ? { texto: "Registro voluntário · não condiciona a entrada", classe: "bg-verde-suave text-primary" }
      : SITUACAO[v.status];
  return (
    <article
      aria-label="Voucher turístico"
      className="flex flex-col overflow-hidden rounded-[22px] border bg-superficie print:break-inside-avoid print:border-[#16211B]"
    >
      <div className="flex items-end justify-between gap-3 bg-primary px-[18px] py-4 text-primary-foreground print:bg-white print:text-[#16211B]">
        <div className="flex flex-col leading-tight">
          <span className="text-xs tracking-[0.08em] uppercase">Voucher turístico</span>
          <span className="font-heading text-[22px] font-bold">{v.municipio} · TO</span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[13px] font-bold text-[#16211B] print:border print:border-[#16211B]">
          Gratuito
        </span>
      </div>

      <div className="flex flex-col items-center gap-3.5 px-[18px] pt-[22px] pb-[18px]">
        {v.status === "emitido" ? (
          <QrDoVoucher codigo={v.codigo} />
        ) : (
          <div className="flex size-[216px] items-center justify-center rounded-xl border border-dashed p-4 text-center text-muted-foreground">
            QR Code indisponível: este voucher está {SITUACAO[v.status].texto.toLowerCase()}.
          </div>
        )}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[13px] text-muted-foreground">Código do voucher</span>
          <span data-testid="codigo-voucher" className="font-mono text-2xl font-bold tracking-[0.08em]">
            {formatarCodigo(v.codigo)}
          </span>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-center text-[13px] font-bold", situacao.classe)}>{situacao.texto}</span>
      </div>

      <div aria-hidden="true" className="flex items-center">
        <div className="-ml-px h-7 w-3.5 rounded-r-[14px] border border-l-0 bg-background print:hidden" />
        <div className="flex-1 border-t-2 border-dashed" />
        <div className="-mr-px h-7 w-3.5 rounded-l-[14px] border border-r-0 bg-background print:hidden" />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 px-[18px] pt-4 pb-5">
        <div className="col-span-2 flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Atividade</dt>
          <dd className="text-[17px] font-bold">{v.atividade}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Data</dt>
          <dd className="font-bold">{v.data}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Horário</dt>
          <dd className="font-bold">{v.horario ?? "Livre, no horário de funcionamento"}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Pessoas</dt>
          <dd className="font-bold">
            {v.pessoas}
            {v.status === "utilizado" && v.pessoasAtendidas !== null ? ` (${v.pessoasAtendidas} atendidas)` : ""}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Origem</dt>
          <dd className="font-bold">{v.origem}</dd>
        </div>
        {v.responsavel ? (
          <div className="col-span-2 flex flex-col">
            <dt className="text-[13px] text-muted-foreground">Responsável</dt>
            <dd className="font-bold">{v.responsavel}</dd>
          </div>
        ) : null}
        <div className="col-span-2 flex flex-col">
          <dt className="text-[13px] text-muted-foreground">{v.modo === "reserva" ? "Ponto de encontro" : "Local"}</dt>
          <dd className="font-bold">{v.localEncontro ?? "[Local informado pela Secretaria]"}</dd>
        </div>
        {v.utilizadoEm ? (
          <div className="col-span-2 flex flex-col">
            <dt className="text-[13px] text-muted-foreground">Participação confirmada</dt>
            <dd className="font-bold">{v.utilizadoEm}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function AvisoEmitido({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-[14px] bg-verde-suave px-3.5 py-3 font-bold text-primary print:hidden">
      <Check aria-hidden="true" className="size-[22px] shrink-0" strokeWidth={2.4} />
      {texto}
    </div>
  );
}
