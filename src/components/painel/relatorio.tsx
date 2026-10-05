import { cn } from "@/lib/utils";
import type { Indicador, LinhaOrigem } from "@/lib/relatorios/exportacao";

/** Lista de indicadores com o número e a nota que diz como ler (reserva não é visita etc.). */
export function ListaIndicadores({ titulo, itens }: { titulo: string; itens: Indicador[] }) {
  return (
    <dl aria-label={titulo} className="flex flex-col divide-y rounded-2xl border bg-superficie print:break-inside-avoid">
      {itens.map((i) => (
        <div key={i.rotulo} className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5">
          <dt className="col-start-1 row-start-1">{i.rotulo}</dt>
          <dd className="col-start-2 row-span-2 row-start-1 font-heading text-xl font-bold">{i.valor.toLocaleString("pt-BR")}</dd>
          <dd className="col-start-1 row-start-2 text-xs text-muted-foreground">{i.nota}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tabela compacta que rola dentro da própria caixa no celular. */
export function Tabela({
  rotulo,
  colunas,
  linhas,
  className,
}: {
  rotulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  className?: string;
}) {
  return (
    // Focável para quem rola a tabela pelo teclado quando ela não cabe na largura do celular.
    <div tabIndex={0} role="group" aria-label={`${rotulo} (role para os lados se não couber)`}
      className={cn("overflow-x-auto rounded-2xl border bg-superficie print:overflow-visible", className)}>
      <table aria-label={rotulo} className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-background text-left">
            {colunas.map((c, i) => (
              <th key={c} scope="col" className={cn("px-3 py-2 font-bold", i > 0 && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, n) => (
            <tr key={n} className="border-b last:border-b-0">
              {l.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 text-left font-normal">
                    {v}
                  </th>
                ) : (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">
                    {typeof v === "number" ? v.toLocaleString("pt-BR") : v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaOrigem({ rotulo, linhas }: { rotulo: string; linhas: LinhaOrigem[] }) {
  return (
    <Tabela
      rotulo={rotulo}
      colunas={["Origem", "Vouchers e registros", "Pessoas declaradas", "Participações"]}
      linhas={linhas.map((l) => [l.local, l.vouchers, l.pessoas, l.participacoes_confirmadas])}
    />
  );
}
