import type { Relatorio } from "@/lib/relatorios/dados";

/**
 * Indicadores com rótulos que não confundem reserva com visita (CLAUDE.md, "Conteúdo"):
 * reservas não são visitas, participações não são turistas únicos e registros voluntários
 * são adesões ao sistema, não a contagem do fluxo turístico.
 */
function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: number; nota: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] border bg-superficie p-3">
      <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
      <dd className="font-heading text-[30px] leading-tight font-bold">{valor.toLocaleString("pt-BR")}</dd>
      <dd className="text-xs text-muted-foreground">{nota}</dd>
    </div>
  );
}

export function IndicadoresReserva({ r, completo = false }: { r: Relatorio; completo?: boolean }) {
  return (
    <dl aria-label="Indicadores de reservas" className="grid grid-cols-2 gap-2">
      <Indicador rotulo="Vouchers emitidos" valor={r.emitidos} nota="reservas feitas, não visitas" />
      <Indicador rotulo="Vouchers utilizados" valor={r.utilizados} nota="com presença confirmada" />
      <Indicador rotulo="Participações confirmadas" valor={r.participacoes_confirmadas} nota="pessoas atendidas; não são turistas únicos" />
      <Indicador rotulo="Registros voluntários" valor={r.registros_voluntarios} nota="adesões, não o fluxo total" />
      <Indicador rotulo="Cancelamentos" valor={r.cancelados} nota="vagas devolvidas" />
      <Indicador rotulo="Expirados" valor={r.expirados} nota="reservas sem comparecimento confirmado" />
      {completo ? (
        <>
          <Indicador rotulo="Pessoas reservadas" valor={r.pessoas_reservadas} nota="nas reservas não canceladas; não é público presente" />
          <Indicador rotulo="Aguardando atendimento" valor={r.aguardando} nota="reservas ainda válidas" />
        </>
      ) : null}
    </dl>
  );
}
