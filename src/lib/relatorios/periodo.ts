import { z } from "zod";
import { hojeLocal } from "@/lib/datas";

export type Versao = "completo" | "divulgacao";

export type Periodo = {
  inicio: string;
  fim: string;
  /** Ano-base quando o período é o ano inteiro; null num período livre. */
  ano: number | null;
  versao: Versao;
  aviso: string | null;
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ano = z.coerce.number().int().min(2020).max(2100);

type Parametros = Record<string, string | string[] | undefined>;

function um(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Período do relatório a partir da URL: `?ano=2026` (ano-base inteiro) ou `?inicio=&fim=`.
 * Sem parâmetros, o ano-base corrente. `?versao=divulgacao` escolhe a versão sem dados pessoais.
 */
export function lerPeriodo(sp: Parametros): Periodo {
  const versao: Versao = um(sp.versao) === "divulgacao" ? "divulgacao" : "completo";
  const i = dia.safeParse(um(sp.inicio));
  const f = dia.safeParse(um(sp.fim));
  if (i.success && f.success) {
    let [inicio, fim] = [i.data, f.data];
    let aviso: string | null = null;
    if (fim < inicio) {
      [inicio, fim] = [fim, inicio];
      aviso = "A data final era anterior à inicial; o período foi invertido.";
    }
    const anoInteiro = inicio.endsWith("-01-01") && fim === `${inicio.slice(0, 4)}-12-31`;
    return { inicio, fim, ano: anoInteiro ? Number(inicio.slice(0, 4)) : null, versao, aviso };
  }
  const a = ano.safeParse(um(sp.ano));
  const escolhido = a.success ? a.data : Number(hojeLocal().slice(0, 4));
  return { inicio: `${escolhido}-01-01`, fim: `${escolhido}-12-31`, ano: escolhido, versao, aviso: null };
}

/** Parâmetros de URL que reproduzem o período (para links de CSV, impressão e versões). */
export function consultaDoPeriodo(p: Periodo, versao: Versao = p.versao): string {
  const q = new URLSearchParams(p.ano !== null ? { ano: String(p.ano) } : { inicio: p.inicio, fim: p.fim });
  if (versao === "divulgacao") q.set("versao", "divulgacao");
  return q.toString();
}

/** Anos oferecidos no seletor de ano-base: do corrente até 2024. */
export function anosDisponiveis(): number[] {
  const atual = Number(hojeLocal().slice(0, 4));
  const anos: number[] = [];
  for (let a = atual; a >= Math.min(2024, atual); a--) anos.push(a);
  return anos;
}
