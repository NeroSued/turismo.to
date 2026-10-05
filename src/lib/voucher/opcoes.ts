import "server-only";
import { randomUUID } from "node:crypto";
import type { SessaoOpcao } from "@/components/portal/reserva";
import { buscarAtividade, listarSessoes, type AtividadeLinha } from "@/lib/atividades/dados";
import { diaDoMes, diaLocal, formatarData, formatarHora, formatarSemana, hojeLocal, somarDias } from "@/lib/datas";

/** Atividade publicada e horários abertos, já formatados no fuso local, para o formulário de reserva. */
export async function dadosDaReserva(municipioId: string, atividadeId: string) {
  const atividade = await buscarAtividade(municipioId, atividadeId);
  if (!atividade || atividade.status !== "publicado") return null;
  const sessoes = atividade.modo === "reserva" ? await listarSessoes(municipioId, atividade.id, { futuras: true }) : [];
  const opcoes: SessaoOpcao[] = sessoes.map((s) => ({
    id: s.id,
    dia: diaLocal(s.inicio),
    semana: formatarSemana(s.inicio),
    diaMes: diaDoMes(diaLocal(s.inicio)),
    dataCurta: formatarData(s.inicio).slice(0, 5),
    hora: formatarHora(s.inicio),
    vagas: s.capacidade_pessoas === null ? null : Math.max(0, s.capacidade_pessoas - s.pessoas_reservadas),
  }));
  const hoje = hojeLocal();
  return {
    atividade: atividade as AtividadeLinha,
    opcoes,
    // Chave de idempotência (D5) gerada a cada abertura da página e reenviada em novas tentativas.
    chave: randomUUID(),
    hoje,
    ultimoDia: somarDias(hoje, 365),
  };
}
