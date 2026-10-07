/**
 * Helper único de datas (CLAUDE.md, "Banco de dados"). Horários ficam em timestamptz no banco;
 * tudo que é exibido ou digitado usa o fuso America/Araguaina, em pt-BR.
 */

export const FUSO = "America/Araguaina";

type Instante = Date | string;

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function comoData(v: Instante): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Datas sem horário ("2026-10-12") são dias do calendário: formatadas sem conversão de fuso. */
function diaParaDate(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDataUtc = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short" });
const fmtSemanaUtc = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDiaIso = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

function semana(d: Date, utc: boolean): string {
  const s = (utc ? fmtSemanaUtc : fmtSemana).format(d).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "12/10/2026". Aceita instante (timestamptz) ou dia ("2026-10-12"). */
export function formatarData(v: Instante): string {
  if (typeof v === "string" && DIA_ISO.test(v)) return fmtDataUtc.format(diaParaDate(v));
  return fmtData.format(comoData(v));
}

/** "Sáb, 12/10/2026". */
export function formatarDataComSemana(v: Instante): string {
  if (typeof v === "string" && DIA_ISO.test(v)) {
    const d = diaParaDate(v);
    return `${semana(d, true)}, ${fmtDataUtc.format(d)}`;
  }
  const d = comoData(v);
  return `${semana(d, false)}, ${fmtData.format(d)}`;
}

/** "Sáb" (dia da semana abreviado). */
export function formatarSemana(v: Instante): string {
  if (typeof v === "string" && DIA_ISO.test(v)) return semana(diaParaDate(v), true);
  return semana(comoData(v), false);
}

/** "08:00". */
export function formatarHora(v: Instante): string {
  return fmtHora.format(comoData(v));
}

const fmtMes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, month: "short" });
const fmtMesAno = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, month: "long", year: "numeric" });

/** Dia do mês e mês abreviado de um instante, para blocos de calendário: { dia: "12", mes: "OUT" }. */
export function diaEMes(v: Instante): { dia: string; mes: string } {
  const d = comoData(v);
  return { dia: diaLocal(d).slice(8, 10), mes: fmtMes.format(d).replace(".", "").toUpperCase() };
}

/** "Outubro de 2026" (agrupamento do calendário). */
export function formatarMesAno(v: Instante): string {
  const s = fmtMesAno.format(comoData(v));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "12/10/2026 às 08:00". */
export function formatarDataHora(v: Instante): string {
  return `${formatarData(v)} às ${formatarHora(v)}`;
}

/** Dia ("2026-10-12") de um instante, no fuso local. */
export function diaLocal(v: Instante = new Date()): string {
  return fmtDiaIso.format(comoData(v));
}

/** Hoje no fuso local ("2026-10-12"). */
export function hojeLocal(): string {
  return diaLocal(new Date());
}

/** Soma dias a um dia ("2026-10-12" + 1 = "2026-10-13"). */
export function somarDias(dia: string, n: number): string {
  const d = diaParaDate(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "12" (dia do mês) de um dia ISO. */
export function diaDoMes(dia: string): string {
  return dia.slice(8, 10);
}

/** Hora local ("HH:MM") de um instante. */
export function horaLocal(v: Instante): string {
  return formatarHora(v);
}

/** Diferença, em minutos, entre o relógio local de America/Araguaina e o UTC naquele instante. */
function deslocamentoMinutos(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const n = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const comoUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Instante correspondente a um dia e hora digitados pelo gestor, interpretados em America/Araguaina.
 * Não presume deslocamento fixo: consulta a base de fusos do ambiente.
 */
export function instanteLocal(dia: string, hora: string): Date {
  if (!DIA_ISO.test(dia) || !/^\d{2}:\d{2}$/.test(hora)) throw new Error("Dia ou hora inválidos.");
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const ingenuo = Date.UTC(a, m - 1, d, h, mi);
  let resultado = ingenuo - deslocamentoMinutos(new Date(ingenuo)) * 60_000;
  resultado = ingenuo - deslocamentoMinutos(new Date(resultado)) * 60_000;
  return new Date(resultado);
}

/** O instante já passou? */
export function jaPassou(v: Instante): boolean {
  return comoData(v).getTime() <= Date.now();
}

const fmtDiaMesExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "numeric", month: "long" });

/** "5 de junho" (dia do mês e nome do mês, no fuso America/Araguaina). */
export function formatarDiaMes(v: Instante): string {
  return fmtDiaMesExtenso.format(comoData(v));
}

/** Período de um evento: "12 de outubro", "5 a 11 de junho" ou "28 de junho a 2 de julho". */
export function formatarPeriodo(inicio: Instante, fim: Instante): string {
  const a = comoData(inicio);
  const b = comoData(fim);
  if (diaLocal(a) === diaLocal(b)) return formatarDiaMes(a);
  if (diaLocal(a).slice(0, 7) === diaLocal(b).slice(0, 7)) return `${Number(diaLocal(a).slice(8, 10))} a ${formatarDiaMes(b)}`;
  return `${formatarDiaMes(a)} a ${formatarDiaMes(b)}`;
}
