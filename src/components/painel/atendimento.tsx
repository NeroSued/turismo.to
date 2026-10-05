"use client";

import { Check, Minus, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { MensagemEstado } from "@/components/formulario";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatarDataComSemana, formatarDataHora, formatarHora, diaLocal, hojeLocal } from "@/lib/datas";
import { cancelarNoPainel, confirmarParticipacao } from "@/lib/voucher/acoes-painel";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { origemTexto } from "@/lib/voucher/formatar";
import type { ResultadoVoucher, VoucherConferido } from "@/lib/voucher/painel";

const LER_OUTRO = (
  <Link href="/admin/atendimento" className={buttonVariants({ size: "lg", className: "mt-auto w-full no-underline hover:text-primary-foreground" })}>
    Ler outro voucher
  </Link>
);

function quando(v: VoucherConferido): string {
  if (!v.sessao_inicio) return `${formatarDataComSemana(v.data_visita)} (registro do dia)`;
  const hoje = diaLocal(v.sessao_inicio) === hojeLocal();
  return `${hoje ? "Hoje" : formatarDataComSemana(v.sessao_inicio)}, ${formatarHora(v.sessao_inicio)}`;
}

function pessoas(n: number) {
  return n === 1 ? "1 pessoa" : `${n} pessoas`;
}

type Bloqueio = { titulo: string; texto: string; fundo: string; cor: string };

function bloqueio(r: ResultadoVoucher, municipio: string): Bloqueio | null {
  const v = r.voucher;
  switch (r.resultado) {
    case "ja_utilizado":
      return {
        titulo: "Voucher já utilizado",
        texto: v
          ? `Participação confirmada em ${formatarDataHora(v.utilizado_em!)}${v.utilizado_por_nome ? ` por ${v.utilizado_por_nome}` : ""}, com ${pessoas(v.pessoas_atendidas ?? 0)}. Nenhuma nova contagem foi registrada.`
          : "Este voucher já foi utilizado. Nenhuma nova contagem foi registrada.",
        fundo: "#F6ECD6",
        cor: "#5C3F0B",
      };
    case "cancelado":
    case "ja_cancelado":
      return {
        titulo: "Voucher cancelado",
        texto: "Este voucher foi cancelado e não pode ser utilizado. As vagas já voltaram para a atividade.",
        fundo: "#F6E1DB",
        cor: "#7A2C1D",
      };
    case "expirado":
      return {
        titulo: "Voucher expirado",
        texto: v
          ? `O prazo deste voucher terminou (${quando(v)}). Ele não pode mais ser utilizado. Se o visitante quiser participar, emita um novo voucher.`
          : "O prazo deste voucher terminou. Se o visitante quiser participar, emita um novo voucher.",
        fundo: "#E4E7E0",
        cor: "#2E3832",
      };
    case "fora_do_dia":
      return {
        titulo: "Voucher de outro dia",
        texto: v
          ? `Este voucher é para ${quando(v)}. A participação só pode ser confirmada no dia da atividade.`
          : "A participação só pode ser confirmada no dia da atividade.",
        fundo: "#F3E6C8",
        cor: "#6B4A0E",
      };
    case "outro_municipio":
      return {
        titulo: "Voucher de outro município",
        texto: `Este código não pertence a ${municipio}. Oriente o visitante a procurar o município que emitiu o voucher.`,
        fundo: "#E1E7EF",
        cor: "#23405F",
      };
    case "nao_encontrado":
      return {
        titulo: "Código não encontrado",
        texto: "Nenhum voucher tem este código. Confira as letras e os números com o visitante e tente de novo.",
        fundo: "#F6E1DB",
        cor: "#7A2C1D",
      };
    default:
      return null;
  }
}

export function TelaBloqueio({ resultado, codigo, municipio }: { resultado: ResultadoVoucher; codigo: string; municipio: string }) {
  const b = bloqueio(resultado, municipio);
  if (!b) return null;
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div role="alert" className="flex flex-col gap-2.5 rounded-[18px] p-5" style={{ background: b.fundo, color: b.cor }}>
        <TriangleAlert aria-hidden="true" className="size-9" />
        <h1 className="text-[26px] leading-tight font-bold">{b.titulo}</h1>
        <p>{b.texto}</p>
      </div>
      <span className="font-mono font-bold tracking-[0.06em] text-muted-foreground">Código lido: {formatarCodigo(codigo)}</span>
      {LER_OUTRO}
    </div>
  );
}

function TelaConfirmado({ v }: { v: VoucherConferido }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 py-6 text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-verde-suave text-primary">
        <Check aria-hidden="true" className="size-12" strokeWidth={2.4} />
      </div>
      <h1 role="status" className="text-[28px] font-bold">
        Participação confirmada
      </h1>
      <p className="text-lg">
        <strong>
          {v.pessoas_atendidas} de {v.pessoas}
        </strong>{" "}
        pessoas atendidas
      </p>
      <p className="text-sm text-muted-foreground">
        Registrado em {formatarDataHora(v.utilizado_em!)}
        {v.utilizado_por_nome ? ` por ${v.utilizado_por_nome}` : ""}. Uma nova leitura deste código não gera outra contagem.
      </p>
      <Link href="/admin/atendimento" className={buttonVariants({ size: "lg", className: "mt-5 w-full no-underline hover:text-primary-foreground" })}>
        Ler próximo voucher
      </Link>
    </div>
  );
}

/** Conferência conforme a tela "Operador": dados mínimos, quantidade atendida e confirmação. */
export function ConferenciaVoucher({ v, municipio }: { v: VoucherConferido; municipio: string }) {
  const [atendidas, setAtendidas] = useState(v.pessoas);
  const [estado, confirmar, confirmando] = useActionState(confirmarParticipacao.bind(null, v.codigo), undefined);
  const [estadoCancel, cancelar, cancelando] = useActionState(cancelarNoPainel.bind(null, v.codigo), undefined);
  const [perguntaCancelar, setPerguntaCancelar] = useState(false);

  const r = estado?.resultado ?? estadoCancel?.resultado;
  if (r?.resultado === "confirmado" && r.voucher) return <TelaConfirmado v={r.voucher} />;
  if (r?.resultado === "cancelado") {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <MensagemEstado aviso={`Voucher ${formatarCodigo(v.codigo)} cancelado. ${pessoas(v.pessoas)} voltaram para as vagas da atividade.`} />
        {LER_OUTRO}
      </div>
    );
  }
  if (r) return <TelaBloqueio resultado={r} codigo={v.codigo} municipio={municipio} />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <span className="w-fit rounded-full bg-verde-suave px-3 py-1 text-[13px] font-bold text-primary">
        {v.modo === "reserva" ? "Reservado · válido para hoje" : "Registro voluntário · válido para hoje"}
      </span>
      <div className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
        <h1 className="font-mono text-lg font-bold tracking-[0.06em]">{formatarCodigo(v.codigo)}</h1>
        <dl className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
          <div className="col-span-2">
            <dt className="text-[13px] text-muted-foreground">Atividade</dt>
            <dd className="font-bold">{v.atividade}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">Horário</dt>
            <dd className="font-bold">{quando(v)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted-foreground">{v.modo === "reserva" ? "Reservadas" : "Declaradas"}</dt>
            <dd className="font-bold">{pessoas(v.pessoas)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[13px] text-muted-foreground">Origem</dt>
            <dd className="font-bold">{origemTexto(v.cidade, v.uf)}</dd>
          </div>
        </dl>
      </div>

      <form action={confirmar} className="flex flex-1 flex-col gap-4">
        <input type="hidden" name="pessoas_atendidas" value={atendidas} />
        <div className="flex flex-col gap-2">
          <span id="rotulo-atendidas" className="text-[15px] font-bold">
            Pessoas atendidas agora
          </span>
          <div className="flex items-center justify-between rounded-[14px] border bg-superficie p-2">
            <Button type="button" variant="outline" className="size-14 bg-background" aria-label="Diminuir pessoas atendidas"
              disabled={atendidas <= 1} onClick={() => setAtendidas((n) => Math.max(1, n - 1))}>
              <Minus aria-hidden="true" className="size-[22px]" />
            </Button>
            <output aria-live="polite" aria-labelledby="rotulo-atendidas" className="font-heading text-4xl font-bold">
              {atendidas}
            </output>
            <Button type="button" variant="outline" className="size-14 bg-background" aria-label="Aumentar pessoas atendidas"
              disabled={atendidas >= v.pessoas} onClick={() => setAtendidas((n) => Math.min(v.pessoas, n + 1))}>
              <Plus aria-hidden="true" className="size-[22px]" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">Pode ser menor que o reservado, nunca maior.</span>
        </div>
        <MensagemEstado erro={estado?.erro ?? estadoCancel?.erro} />
        <div className="mt-auto flex flex-col gap-2">
          <Button type="submit" size="lg" className="h-[58px]" disabled={confirmando || cancelando}>
            {confirmando ? "Confirmando…" : "Confirmar participação"}
          </Button>
          <Link href="/admin/atendimento" className={buttonVariants({ variant: "ghost", size: "lg", className: "no-underline" })}>
            Cancelar leitura
          </Link>
        </div>
      </form>

      <div className="border-t pt-3">
        {!perguntaCancelar ? (
          <button type="button" className="flex min-h-11 items-center font-bold text-[#8A3322]" onClick={() => setPerguntaCancelar(true)}>
            O visitante desistiu: cancelar este voucher
          </button>
        ) : (
          <form action={cancelar} className="flex flex-col gap-2 rounded-2xl border bg-superficie p-3.5">
            <p className="font-bold">Cancelar o voucher {formatarCodigo(v.codigo)}?</p>
            <p className="text-sm text-muted-foreground">{pessoas(v.pessoas)} voltam para as vagas. Não dá para desfazer.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setPerguntaCancelar(false)}>
                Manter
              </Button>
              <Button type="submit" variant="destructive" disabled={cancelando}>
                Cancelar voucher
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
