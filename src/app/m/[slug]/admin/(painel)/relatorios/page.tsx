import type { Metadata } from "next";
import { z } from "zod";
import { Campo, Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { IndicadoresReserva } from "@/components/painel/indicadores";
import { Button } from "@/components/ui/button";
import { formatarData, hojeLocal } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";
import { relatorioDoPeriodo, vouchersDoPeriodo } from "@/lib/relatorios/dados";
import { formatarCodigo } from "@/lib/voucher/esquemas";
import { origemTexto } from "@/lib/voucher/formatar";

export const metadata: Metadata = { title: "Relatórios" };

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const STATUS = {
  emitido: { texto: "Aguardando", tom: "verde" },
  utilizado: { texto: "Utilizado", tom: "dourado" },
  cancelado: { texto: "Cancelado", tom: "erro" },
  expirado: { texto: "Expirado", tom: "cinza" },
} as const;

export default async function Relatorios({ params, searchParams }: PageProps<"/m/[slug]/admin/relatorios">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const sp = await searchParams;
  const ano = hojeLocal().slice(0, 4);
  const inicioOk = dia.safeParse(sp.inicio);
  const fimOk = dia.safeParse(sp.fim);
  let inicio = inicioOk.success ? inicioOk.data : `${ano}-01-01`;
  let fim = fimOk.success ? fimOk.data : `${ano}-12-31`;
  let aviso: string | null = null;
  if (fim < inicio) {
    [inicio, fim] = [fim, inicio];
    aviso = "A data final era anterior à inicial; o período foi invertido.";
  }

  const [r, vouchers] = await Promise.all([relatorioDoPeriodo(municipio.id, inicio, fim), vouchersDoPeriodo(municipio.id, inicio, fim)]);
  const reservas = r.por_atividade.filter((a) => a.modo === "reserva");
  const registros = r.por_atividade.filter((a) => a.modo === "registro_voluntario");

  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Relatório de vouchers</h1>
      <form method="get" className="grid grid-cols-2 gap-3 rounded-2xl border bg-superficie p-4">
        <Campo id="inicio" rotulo="De" type="date" defaultValue={inicio} required />
        <Campo id="fim" rotulo="Até" type="date" defaultValue={fim} required />
        <Button type="submit" variant="outline" className="col-span-2">
          Atualizar período
        </Button>
      </form>
      {aviso ? <p className="rounded-xl bg-dourado-suave p-3 text-dourado-texto">{aviso}</p> : null}
      <p className="text-sm text-muted-foreground">
        Período pelo dia da atividade: {formatarData(inicio)} a {formatarData(fim)}. Números do sistema de vouchers de{" "}
        {municipio.nome}; não representam o total de visitantes do município.
      </p>

      <section aria-labelledby="reservas" className="flex flex-col gap-3">
        <h2 id="reservas" className="text-xl font-bold">Reservas gratuitas</h2>
        <IndicadoresReserva r={r} completo />
      </section>

      <section aria-labelledby="registros" className="flex flex-col gap-2">
        <h2 id="registros" className="text-xl font-bold">Registros voluntários</h2>
        <p className="text-sm text-muted-foreground">
          Adesões ao sistema em atrativos de acesso livre. Não são uma contagem completa do fluxo turístico.
        </p>
        <dl className="flex flex-col divide-y rounded-2xl border bg-superficie">
          {[
            ["Registros voluntários", r.registros_voluntarios],
            ["Pessoas declaradas nos registros", r.pessoas_registros_voluntarios],
            ["Registros confirmados no local", r.registros_confirmados],
            ["Pessoas atendidas nos registros confirmados", r.pessoas_registros_confirmados],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt>{rotulo}</dt>
              <dd className="font-bold">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="por-atividade" className="flex flex-col gap-2">
        <h2 id="por-atividade" className="text-xl font-bold">Por atividade</h2>
        {r.por_atividade.length === 0 ? (
          <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
            Nenhum voucher para atividades neste período. Escolha outro período ou publique atividades no painel (Conteúdo).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...reservas, ...registros].map((a) => (
              <li key={`${a.modo}-${a.atividade}`} className="flex flex-col gap-1 rounded-2xl border bg-superficie p-3.5">
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
      </section>

      <section aria-labelledby="lista" className="flex flex-col gap-2">
        <h2 id="lista" className="text-xl font-bold">Vouchers do período</h2>
        {vouchers.length === 0 ? (
          <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">Nenhum voucher neste período.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
            {vouchers.map((v) => (
              <li key={v.codigo} data-codigo={v.codigo} className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0">
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
          <p className="text-sm text-muted-foreground">Mostrando os 200 mais recentes. Reduza o período para ver os demais.</p>
        ) : null}
      </section>
    </Pagina>
  );
}
