import { diaEMes, diaLocal, formatarData, formatarHora } from "@/lib/datas";

/** Bloco de data do calendário (tela "Portal municipal"): "12 OUT" ou "26–28 OUT". */
export function BlocoData({ inicio, fim }: { inicio: string; fim: string }) {
  const a = diaEMes(inicio);
  const b = diaEMes(fim);
  const mesmoDia = diaLocal(inicio) === diaLocal(fim);
  const mesmoMes = a.mes === b.mes;
  const rotulo = mesmoDia ? formatarData(inicio) : `${formatarData(inicio)} a ${formatarData(fim)}`;
  return (
    <span
      aria-label={rotulo}
      role="img"
      className="flex size-[58px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-verde-suave leading-none text-primary"
    >
      <span className={`font-heading font-bold ${mesmoDia ? "text-[22px]" : "text-[18px]"}`}>
        {mesmoDia ? a.dia : mesmoMes ? `${a.dia}–${b.dia}` : a.dia}
      </span>
      <span className="text-xs font-bold tracking-[0.06em]">{mesmoDia || mesmoMes ? a.mes : `${a.mes}+`}</span>
    </span>
  );
}

/** "19:00 às 23:00" (um dia) ou "de 12/10/2026 a 14/10/2026" quando dura vários dias. */
export function horarioDoEvento(inicio: string, fim: string): string {
  if (diaLocal(inicio) === diaLocal(fim)) return `${formatarHora(inicio)} às ${formatarHora(fim)}`;
  return `de ${formatarData(inicio)} a ${formatarData(fim)}`;
}
