import type { DadosComprovante } from "@/components/voucher/comprovante";
import { formatarDataComSemana, formatarDataHora, formatarHora } from "@/lib/datas";

type Origem = {
  codigo: string;
  status: DadosComprovante["status"];
  atividade: string;
  modo: DadosComprovante["modo"];
  local_encontro: string | null;
  data_visita: string;
  sessao_inicio: string | null;
  pessoas: number;
  pessoas_atendidas: number | null;
  cidade: string;
  uf: string;
  utilizado_em: string | null;
  nome_responsavel?: string | null;
};

export function origemTexto(cidade: string, uf: string): string {
  return uf === "EX" ? `${cidade} (exterior)` : `${cidade}/${uf}`;
}

/** Dados do banco → comprovante, com datas no fuso America/Araguaina. */
export function paraComprovante(v: Origem, municipio: string): DadosComprovante {
  return {
    codigo: v.codigo,
    status: v.status,
    municipio,
    atividade: v.atividade,
    modo: v.modo,
    data: formatarDataComSemana(v.sessao_inicio ?? v.data_visita),
    horario: v.sessao_inicio ? formatarHora(v.sessao_inicio) : null,
    pessoas: v.pessoas,
    pessoasAtendidas: v.pessoas_atendidas,
    origem: origemTexto(v.cidade, v.uf),
    localEncontro: v.local_encontro,
    responsavel: v.nome_responsavel ?? null,
    utilizadoEm: v.utilizado_em ? formatarDataHora(v.utilizado_em) : null,
  };
}
