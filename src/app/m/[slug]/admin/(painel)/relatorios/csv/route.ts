import { NextResponse } from "next/server";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { contextoDaAcao } from "@/lib/painel/contexto";
import { relatorioCompleto, todosVouchersDoPeriodo } from "@/lib/relatorios/dados";
import { csvCompleto, csvDivulgacao } from "@/lib/relatorios/exportacao";
import { lerPeriodo } from "@/lib/relatorios/periodo";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

/**
 * Exportação CSV do relatório (itens 3.2 e 3.3). Só gestor do município do host ou admin;
 * o banco confere o papel de novo. `?versao=divulgacao` gera a versão sem dados pessoais.
 */
export async function GET(request: Request) {
  const ctx = await contextoDaAcao(["gestor"]);
  if (!ctx) {
    return new NextResponse("Sem acesso a este relatório. Entre com uma conta de gestor deste município.", {
      status: 403,
      headers: { ...SEM_CACHE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const p = lerPeriodo(Object.fromEntries(new URL(request.url).searchParams));
  const r = await relatorioCompleto(ctx.municipio.id, p.inicio, p.fim);
  const cabecalho = {
    municipio: ctx.municipio.nome,
    periodo: `${formatarData(p.inicio)} a ${formatarData(p.fim)}`,
    geradoEm: formatarDataHora(new Date()),
  };
  const csv =
    p.versao === "divulgacao"
      ? csvDivulgacao(cabecalho, r)
      : csvCompleto(cabecalho, r, await todosVouchersDoPeriodo(ctx.municipio.id, p.inicio, p.fim));
  const nome = `relatorio-${ctx.municipio.slug}-${p.ano ?? `${p.inicio}_${p.fim}`}${p.versao === "divulgacao" ? "-divulgacao" : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      ...SEM_CACHE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
