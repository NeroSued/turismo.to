"use client";

import { Download, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { MensagemEstado } from "@/components/formulario";
import { Button, buttonVariants } from "@/components/ui/button";
import { cancelarReserva } from "@/lib/voucher/acoes-publicas";

export function BotaoImprimir({ className }: { className?: string }) {
  return (
    <Button type="button" size="lg" variant="outline" className={className} onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-5" /> Imprimir
    </Button>
  );
}

/** "Salvar": baixa o comprovante como imagem (PNG), que fica na galeria ou nos downloads do celular. */
export function BotoesComprovante({ urlImagem, nomeArquivo }: { urlImagem: string; nomeArquivo: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 print:hidden">
      <a href={urlImagem} download={nomeArquivo} className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}>
        <Download aria-hidden="true" className="size-5" /> Salvar
      </a>
      <BotaoImprimir />
    </div>
  );
}

/** Fica montado mesmo depois do cancelamento, para a confirmação não sumir quando a página atualiza. */
export function CancelarPeloVisitante({ token, cancelavel }: { token: string; cancelavel: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState(cancelarReserva.bind(null, token), undefined);
  const router = useRouter();
  useEffect(() => {
    if (estado?.cancelado) router.refresh();
  }, [estado, router]);

  if (estado?.cancelado) {
    return <MensagemEstado aviso="Voucher cancelado. As vagas voltaram para a atividade. Obrigado por avisar." />;
  }
  if (!cancelavel) return null;
  return (
    <div className="flex flex-col gap-2 border-t pt-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        Este link é a única forma de consultar ou desmarcar sem cadastro. Não compartilhe.
      </p>
      <MensagemEstado erro={estado?.erro} />
      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)} className="flex min-h-11 w-fit items-center font-bold text-[#8A3322]">
          Não vou mais: liberar minhas vagas
        </button>
      ) : (
        <form action={acao} className="flex flex-col gap-2 rounded-2xl border bg-superficie p-3.5">
          <p className="font-bold">Cancelar este voucher?</p>
          <p className="text-sm text-muted-foreground">As vagas voltam para a atividade e o código deixa de valer. Não dá para desfazer.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Manter voucher
            </Button>
            <Button type="submit" variant="destructive" disabled={pendente}>
              {pendente ? "Cancelando…" : "Cancelar voucher"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
