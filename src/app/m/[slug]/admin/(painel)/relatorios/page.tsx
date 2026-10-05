import { ChevronRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Campo, Selecao, Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { BotaoImprimirPdf } from "@/components/painel/imprimir";
import { ListaIndicadores, Tabela, TabelaOrigem } from "@/components/painel/relatorio";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";
import { relatorioCompleto, vouchersDoPeriodo } from "@/lib/relatorios/dados";
import {
  indicadoresRegistro,
  indicadoresReserva,
  MINIMO_POR_CIDADE,
  origemPorCidade,
  origemPorUf,
  prestadoresPorCategoria,
  ROTULO_CATEGORIA_PRESTADOR,
} from "@/lib/relatorios/exportacao";
import { anosDisponiveis, consultaDoPeriodo, lerPeriodo } from "@/lib/relatorios/periodo";
import { cn } from "@/lib/utils";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { origemTexto } from "@/lib/voucher/formatar";

export const metadata: Metadata = { title: "Relatórios" };

const STATUS = {
  emitido: { texto: "Aguardando", tom: "verde" },
  utilizado: { texto: "Utilizado", tom: "dourado" },
  cancelado: { texto: "Cancelado", tom: "erro" },
  expirado: { texto: "Expirado", tom: "cinza" },
} as const;

function Secao({ id, titulo, children, nota }: { id: string; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 print:break-inside-avoid-page">
      <h2 id={id} className="text-xl font-bold">
        {titulo}
      </h2>
      {nota ? <p className="text-sm text-muted-foreground">{nota}</p> : null}
      {children}
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">{children}</p>;
}

/** Relatório por município, período e ano-base (itens 3.1 a 3.3). */
export default async function Relatorios({ params, searchParams }: PageProps<"/m/[slug]/admin/relatorios">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const p = lerPeriodo(await searchParams);
  const divulgacao = p.versao === "divulgacao";

  const [r, vouchers] = await Promise.all([
    relatorioCompleto(municipio.id, p.inicio, p.fim),
    divulgacao ? Promise.resolve([]) : vouchersDoPeriodo(municipio.id, p.inicio, p.fim),
  ]);
  const titulo = p.ano !== null ? `Ano-base ${p.ano}` : `${formatarData(p.inicio)} a ${formatarData(p.fim)}`;

  return (
    <Pagina className="pt-2 print:max-w-none print:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">Relatório de vouchers e registros</h1>
        <p className="font-bold">
          {municipio.nome} · {titulo}
        </p>
        <p className="text-sm text-muted-foreground">
          {divulgacao ? "Versão para divulgação: só números agregados, sem dados pessoais." : "Versão administrativa: uso interno da prefeitura."}{" "}
          Período pelo dia da atividade ({formatarData(p.inicio)} a {formatarData(p.fim)}). Gerado em {formatarDataHora(new Date())}.
        </p>
      </div>

      <nav aria-label="Versão do relatório" className="grid grid-cols-2 gap-1 rounded-2xl border bg-superficie p-1 print:hidden">
        {(["completo", "divulgacao"] as const).map((v) => (
          <Link
            key={v}
            href={`/admin/relatorios?${consultaDoPeriodo(p, v)}`}
            aria-current={p.versao === v ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-xl px-2 text-center text-sm font-bold no-underline",
              p.versao === v ? "bg-primary text-primary-foreground hover:text-primary-foreground" : "text-foreground hover:text-foreground",
            )}
          >
            {v === "completo" ? "Administrativa" : "Para divulgação"}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4 print:hidden">
        <form method="get" className="flex items-end gap-2">
          {divulgacao ? <input type="hidden" name="versao" value="divulgacao" /> : null}
          <Selecao id="ano" rotulo="Ano-base" defaultValue={p.ano ?? ""} className="flex-1">
            {p.ano === null ? <option value="">Período livre</option> : null}
            {anosDisponiveis().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selecao>
          <Button type="submit" variant="outline" className="h-12">
            Ver ano
          </Button>
        </form>
        <details open={p.ano === null}>
          <summary className="flex min-h-11 cursor-pointer items-center font-bold">Escolher outro período</summary>
          <form method="get" className="grid grid-cols-2 gap-3 pt-2">
            {divulgacao ? <input type="hidden" name="versao" value="divulgacao" /> : null}
            <Campo id="inicio" rotulo="De" type="date" defaultValue={p.inicio} required />
            <Campo id="fim" rotulo="Até" type="date" defaultValue={p.fim} required />
            <Button type="submit" variant="outline" className="col-span-2">
              Atualizar período
            </Button>
          </form>
        </details>
      </div>
      {p.aviso ? <p className="rounded-xl bg-dourado-suave p-3 text-dourado-texto">{p.aviso}</p> : null}

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <a
          href={`/admin/relatorios/csv?${consultaDoPeriodo(p)}`}
          download
          className={buttonVariants({ size: "lg", variant: "outline", className: "text-foreground no-underline hover:text-foreground" })}
        >
          <Download aria-hidden="true" className="size-5" /> Baixar CSV
        </a>
        <BotaoImprimirPdf className="whitespace-normal leading-tight" />
      </div>

      <p className="rounded-xl bg-dourado-suave p-3 text-sm text-dourado-texto">
        Números do sistema de vouchers de {municipio.nome}. Reservas não são visitas realizadas, participações não são turistas
        únicos e registros voluntários são adesões ao sistema, não a contagem do fluxo turístico.
      </p>

      <Secao id="reservas" titulo="Reservas gratuitas">
        <ListaIndicadores titulo="Indicadores de reservas" itens={indicadoresReserva(r)} />
      </Secao>

      <Secao id="registros" titulo="Registros voluntários" nota="Adesões ao sistema em atrativos de acesso livre. Não são uma contagem completa do fluxo turístico.">
        <ListaIndicadores titulo="Indicadores de registros voluntários" itens={indicadoresRegistro(r)} />
      </Secao>

      <Secao id="por-atividade" titulo="Atividades envolvidas">
        {r.por_atividade.length === 0 ? (
          <Vazio>Nenhum voucher para atividades neste período. Escolha outro período ou publique atividades no painel (Conteúdo).</Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {r.por_atividade.map((a) => (
              <li key={`${a.modo}-${a.atividade}`} className="flex flex-col gap-1 rounded-2xl border bg-superficie p-3.5 print:break-inside-avoid">
                <span className="font-bold">{a.atividade}</span>
                <span className="text-sm text-muted-foreground">
                  {a.modo === "reserva"
                    ? `${a.emitidos} emitidos · ${a.utilizados} utilizados · ${a.cancelados} cancelados · ${a.expirados} expirados`
                    : `${a.emitidos} registros · ${a.utilizados} confirmados no local · ${a.cancelados} cancelados`}
                </span>
                <span className="text-sm">
                  {a.modo === "reserva"
                    ? `${a.pessoas_reservadas} pessoas reservadas · ${a.participacoes_confirmadas} participações confirmadas`
                    : `${a.pessoas_reservadas} pessoas declaradas · ${a.participacoes_confirmadas} atendidas no local`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        id="origem"
        titulo="Origem dos participantes"
        nota={
          divulgacao
            ? `Cidade e UF declaradas nos vouchers e registros não cancelados. Locais com menos de ${MINIMO_POR_CIDADE} registros aparecem somados.`
            : "Cidade e UF declaradas nos vouchers e registros não cancelados."
        }
      >
        {r.origem.length === 0 ? (
          <Vazio>Sem vouchers ou registros no período, então ainda não há origem para mostrar.</Vazio>
        ) : (
          <>
            <TabelaOrigem rotulo="Origem por UF" linhas={origemPorUf(r, divulgacao)} />
            <TabelaOrigem rotulo="Origem por cidade" linhas={origemPorCidade(r, divulgacao)} />
          </>
        )}
      </Secao>

      <Secao id="prestadores" titulo="Prestadores envolvidos" nota="Prestadores indicados como responsáveis por atividades com vouchers no período.">
        {r.prestadores.length === 0 ? (
          <Vazio>Nenhum prestador ligado a atividades com vouchers no período. Indique o prestador responsável na tela de cada atividade.</Vazio>
        ) : divulgacao ? (
          <Tabela
            rotulo="Prestadores por categoria"
            colunas={["Categoria", "Prestadores", "Vouchers e registros"]}
            linhas={prestadoresPorCategoria(r).map((c) => [c.categoria, c.prestadores, c.vouchers])}
          />
        ) : (
          <Tabela
            rotulo="Prestadores envolvidos"
            colunas={["Prestador", "Atividades", "Vouchers e registros", "Participações"]}
            linhas={r.prestadores.map((x) => [
              `${x.nome} (${ROTULO_CATEGORIA_PRESTADOR[x.categoria] ?? x.categoria})`,
              x.atividades,
              x.vouchers,
              x.participacoes_confirmadas,
            ])}
          />
        )}
        <p className="text-sm">
          Rede de prestadores: <strong>{r.rede.participantes}</strong> participantes hoje ·{" "}
          <strong>{r.rede.adesoes.length}</strong> adesões registradas no período.
        </p>
        {!divulgacao && r.rede.adesoes.length > 0 ? (
          <Tabela
            rotulo="Adesões no período"
            colunas={["Prestador", "Data da adesão"]}
            linhas={r.rede.adesoes.map((a) => [a.nome, formatarData(a.data_adesao)])}
          />
        ) : null}
      </Secao>

      {!divulgacao ? (
        <Secao id="lista" titulo="Vouchers do período" nota="Sem nome nem contato dos visitantes. O CSV traz a lista completa.">
          {vouchers.length === 0 ? (
            <Vazio>Nenhum voucher neste período.</Vazio>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
              {vouchers.map((v) => (
                <li key={v.codigo} data-codigo={v.codigo} className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 print:break-inside-avoid">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold tracking-[0.04em]">{formatarCodigo(v.codigo)}</span>
                    <Selo tom={STATUS[v.status].tom}>{STATUS[v.status].texto}</Selo>
                  </div>
                  <span className="text-sm">{v.atividades?.titulo}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatarData(v.data_visita)} · {origemTexto(v.cidade, v.uf)} · {v.pessoas} reservadas
                    {v.status === "utilizado" ? ` · ${v.pessoas_atendidas} atendidas` : ""}
                    {v.origem === "assistida" ? " · emissão assistida" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {vouchers.length === 200 ? (
            <p className="text-sm text-muted-foreground">Mostrando os 200 mais recentes. Baixe o CSV para ver todos ou reduza o período.</p>
          ) : null}
        </Secao>
      ) : null}

      <nav aria-label="Comprovações" className="print:hidden">
        <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {[
            { href: "/admin/evidencias", titulo: "Evidências", texto: "Ações realizadas, fotos, listas de presença e atas." },
            {
              href: `/admin/relatorios/minuta?ano=${p.ano ?? p.inicio.slice(0, 4)}`,
              titulo: "Minuta do relatório de implantação",
              texto: "Atividades, indicadores e evidências do ano-base, com seções para completar.",
            },
          ].map((l) => (
            <li key={l.href} className="border-b last:border-b-0">
              <Link href={l.href} className="flex min-h-16 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background">
                <span className="flex flex-1 flex-col">
                  <span className="font-bold">{l.titulo}</span>
                  <span className="text-sm text-muted-foreground">{l.texto}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Pagina>
  );
}
