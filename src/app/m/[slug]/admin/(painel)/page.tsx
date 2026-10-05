import { ArrowRight, Layers, ScanLine, Ticket } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagina } from "@/components/pagina";
import { IndicadoresReserva } from "@/components/painel/indicadores";
import { listarAtividades, listarSessoesDoPeriodo } from "@/lib/atividades/dados";
import { formatarHora, hojeLocal, instanteLocal, somarDias } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";
import { relatorioDoPeriodo } from "@/lib/relatorios/dados";

const atalho =
  "flex min-h-[92px] flex-col items-start justify-between rounded-2xl p-3 text-sm leading-tight font-bold no-underline";

/** Visão geral do gestor conforme a tela "Gestor" do canvas. */
export default async function VisaoGeral({ params }: PageProps<"/m/[slug]/admin">) {
  const { slug } = await params;
  const { municipio, papel } = await exigirPainel(slug);
  // O operador vê só atendimento e emissão (CLAUDE.md, "Interface").
  if (papel === "operador") redirect("/admin/atendimento");

  const hoje = hojeLocal();
  const ano = hoje.slice(0, 4);
  const [r, sessoesHoje, atividades] = await Promise.all([
    relatorioDoPeriodo(municipio.id, `${ano}-01-01`, `${ano}-12-31`),
    listarSessoesDoPeriodo(municipio.id, instanteLocal(hoje, "00:00"), instanteLocal(somarDias(hoje, 1), "00:00")),
    listarAtividades(municipio.id),
  ]);
  const emElaboracao = atividades.filter((a) => a.status === "rascunho").length;

  return (
    <Pagina className="gap-6 pt-1">
      <h1 className="text-[26px] font-bold">Visão geral</h1>
      <section aria-label="Atalhos" className="grid grid-cols-3 gap-2">
        <Link href="/admin/atendimento" className={`${atalho} bg-primary text-primary-foreground hover:text-primary-foreground`}>
          <ScanLine aria-hidden="true" className="size-6" /> Ler QR Code
        </Link>
        <Link href="/admin/vouchers/emitir" className={`${atalho} border bg-superficie text-foreground hover:text-foreground`}>
          <Ticket aria-hidden="true" className="size-6" /> Emitir voucher assistido
        </Link>
        <Link href="/admin/atividades/nova" className={`${atalho} border bg-superficie text-foreground hover:text-foreground`}>
          <Layers aria-hidden="true" className="size-6" /> Nova atividade
        </Link>
      </section>

      <section aria-labelledby="indicadores" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="indicadores" className="text-[21px] font-bold">Indicadores</h2>
          <span className="text-sm font-bold text-muted-foreground">Ano-base {ano}</span>
        </div>
        <IndicadoresReserva r={r} />
        <Link href="/admin/relatorios" className="flex min-h-11 items-center gap-1.5 font-bold">
          Abrir relatório completo <ArrowRight aria-hidden="true" className="size-[18px]" />
        </Link>
      </section>

      <section aria-labelledby="hoje" className="flex flex-col gap-2.5">
        <h2 id="hoje" className="text-[21px] font-bold">Hoje</h2>
        {sessoesHoje.length === 0 ? (
          <p className="rounded-[14px] border bg-superficie p-4 text-muted-foreground">
            Nenhum horário de atividade hoje. Os horários são criados em cada atividade (Conteúdo).
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[14px] border bg-superficie">
            {sessoesHoje.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0">
                <span className="w-[52px] text-[17px] font-bold">{formatarHora(s.inicio)}</span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-bold">{s.atividades?.titulo}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {s.capacidade_pessoas === null
                      ? `${s.pessoas_reservadas} pessoas com reserva`
                      : `${s.pessoas_reservadas} de ${s.capacidade_pessoas} vagas reservadas`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {emElaboracao > 0 ? (
        <section aria-labelledby="pendencias" className="flex flex-col gap-2.5">
          <h2 id="pendencias" className="text-[21px] font-bold">Pendências</h2>
          <Link
            href="/admin/atividades"
            className="flex min-h-[52px] items-center gap-3 rounded-[14px] border bg-superficie px-3.5 text-foreground no-underline hover:text-foreground"
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[#B07A14]" />
            <span className="flex-1">
              {emElaboracao === 1 ? "1 atividade em elaboração" : `${emElaboracao} atividades em elaboração`}
            </span>
          </Link>
        </section>
      ) : null}
    </Pagina>
  );
}
