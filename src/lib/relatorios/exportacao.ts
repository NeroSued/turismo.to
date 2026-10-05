import type { RelatorioCompleto, VoucherLinha } from "./dados";

/**
 * Conteúdo dos relatórios para tela, CSV e impressão (itens 3.2 e 3.3). Rótulos que não
 * confundem reserva com visita, nem participação com turista único (CLAUDE.md, "Conteúdo").
 *
 * Versão para divulgação: só números agregados. Sem código de voucher, nome, contato,
 * nome de prestador ou linha individual; cidades com poucos registros entram em
 * "Outras cidades" para que ninguém seja identificável pela origem.
 */

export const MINIMO_POR_CIDADE = 3;

export const ROTULO_CATEGORIA_PRESTADOR: Record<string, string> = {
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  guias: "Guias e condutores",
  transporte: "Transporte",
  artesanato: "Artesanato",
  agencia: "Agência",
  outro: "Outros serviços",
};

const ROTULO_STATUS = { emitido: "Aguardando", utilizado: "Utilizado", cancelado: "Cancelado", expirado: "Expirado" } as const;

export type Indicador = { rotulo: string; valor: number; nota: string };

export function indicadoresReserva(r: RelatorioCompleto): Indicador[] {
  return [
    { rotulo: "Vouchers emitidos", valor: r.emitidos, nota: "reservas feitas, não visitas" },
    { rotulo: "Vouchers utilizados", valor: r.utilizados, nota: "com presença confirmada" },
    { rotulo: "Cancelamentos", valor: r.cancelados, nota: "vagas devolvidas" },
    { rotulo: "Expirados", valor: r.expirados, nota: "reservas sem comparecimento confirmado" },
    { rotulo: "Aguardando atendimento", valor: r.aguardando, nota: "reservas ainda válidas" },
    { rotulo: "Pessoas reservadas", valor: r.pessoas_reservadas, nota: "nas reservas não canceladas; não é público presente" },
    { rotulo: "Participações confirmadas", valor: r.participacoes_confirmadas, nota: "pessoas atendidas; não são turistas únicos" },
  ];
}

export function indicadoresRegistro(r: RelatorioCompleto): Indicador[] {
  return [
    { rotulo: "Registros voluntários", valor: r.registros_voluntarios, nota: "adesões, não o fluxo total" },
    { rotulo: "Pessoas declaradas nos registros", valor: r.pessoas_registros_voluntarios, nota: "informado pelo visitante" },
    { rotulo: "Registros confirmados no local", valor: r.registros_confirmados, nota: "conferidos por operador" },
    { rotulo: "Pessoas atendidas nos registros confirmados", valor: r.pessoas_registros_confirmados, nota: "não são turistas únicos" },
  ];
}

export type LinhaOrigem = { local: string; vouchers: number; pessoas: number; participacoes_confirmadas: number };

/** Origem por cidade/UF. Na divulgação, cidades abaixo do mínimo são somadas numa linha só. */
export function origemPorCidade(r: RelatorioCompleto, divulgacao: boolean): LinhaOrigem[] {
  const linhas: LinhaOrigem[] = [];
  const outras: LinhaOrigem = { local: `Outras cidades (menos de ${MINIMO_POR_CIDADE} registros cada)`, vouchers: 0, pessoas: 0, participacoes_confirmadas: 0 };
  for (const o of r.origem) {
    const linha = { local: `${o.cidade}/${o.uf}`, vouchers: o.vouchers, pessoas: o.pessoas, participacoes_confirmadas: o.participacoes_confirmadas };
    if (divulgacao && o.vouchers < MINIMO_POR_CIDADE) {
      outras.vouchers += o.vouchers;
      outras.pessoas += o.pessoas;
      outras.participacoes_confirmadas += o.participacoes_confirmadas;
    } else {
      linhas.push(linha);
    }
  }
  if (outras.vouchers > 0) linhas.push(outras);
  return linhas;
}

/** Origem somada por UF (mesma regra de agregação mínima na divulgação). */
export function origemPorUf(r: RelatorioCompleto, divulgacao: boolean): LinhaOrigem[] {
  const porUf = new Map<string, LinhaOrigem>();
  for (const o of r.origem) {
    const l = porUf.get(o.uf) ?? { local: o.uf, vouchers: 0, pessoas: 0, participacoes_confirmadas: 0 };
    l.vouchers += o.vouchers;
    l.pessoas += o.pessoas;
    l.participacoes_confirmadas += o.participacoes_confirmadas;
    porUf.set(o.uf, l);
  }
  const todas = [...porUf.values()].sort((a, b) => b.vouchers - a.vouchers || a.local.localeCompare(b.local));
  if (!divulgacao) return todas;
  const outras: LinhaOrigem = { local: `Outras UFs (menos de ${MINIMO_POR_CIDADE} registros cada)`, vouchers: 0, pessoas: 0, participacoes_confirmadas: 0 };
  const linhas = todas.filter((l) => {
    if (l.vouchers >= MINIMO_POR_CIDADE) return true;
    outras.vouchers += l.vouchers;
    outras.pessoas += l.pessoas;
    outras.participacoes_confirmadas += l.participacoes_confirmadas;
    return false;
  });
  if (outras.vouchers > 0) linhas.push(outras);
  return linhas;
}

/** Prestadores por categoria (divulgação: sem nomes, que podem ser de pessoas físicas). */
export function prestadoresPorCategoria(r: RelatorioCompleto): { categoria: string; prestadores: number; vouchers: number }[] {
  const m = new Map<string, { categoria: string; prestadores: number; vouchers: number }>();
  for (const p of r.prestadores) {
    const c = ROTULO_CATEGORIA_PRESTADOR[p.categoria] ?? p.categoria;
    const l = m.get(c) ?? { categoria: c, prestadores: 0, vouchers: 0 };
    l.prestadores += 1;
    l.vouchers += p.vouchers;
    m.set(c, l);
  }
  return [...m.values()].sort((a, b) => a.categoria.localeCompare(b.categoria));
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

type Celula = string | number;

/** Célula CSV com aspas quando preciso; texto que começa com = + - @ é neutralizado (injeção em planilhas). */
export function celulaCsv(v: Celula): string {
  if (typeof v === "number") return String(v);
  let t = v;
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** CSV com ponto e vírgula (Excel em pt-BR) e BOM UTF-8 para acentos. */
export function montarCsv(linhas: Celula[][]): string {
  return "﻿" + linhas.map((l) => l.map(celulaCsv).join(";")).join("\r\n") + "\r\n";
}

export type Cabecalho = { municipio: string; periodo: string; geradoEm: string };

function blocoIndicadores(titulo: string, itens: Indicador[]): Celula[][] {
  return [[titulo, "Indicador", "Valor", "Como ler"], ...itens.map((i) => [titulo, i.rotulo, i.valor, i.nota])];
}

function blocoAtividades(r: RelatorioCompleto): Celula[][] {
  return [
    ["Por atividade", "Atividade", "Tipo", "Emitidos", "Utilizados", "Cancelados", "Expirados", "Pessoas reservadas ou declaradas", "Participações confirmadas"],
    ...r.por_atividade.map((a) => [
      "Por atividade",
      a.atividade,
      a.modo === "reserva" ? "Reserva gratuita" : "Registro voluntário",
      a.emitidos,
      a.utilizados,
      a.cancelados,
      a.expirados,
      a.pessoas_reservadas,
      a.participacoes_confirmadas,
    ]),
  ];
}

function blocoOrigem(titulo: string, linhas: LinhaOrigem[]): Celula[][] {
  return [
    [titulo, "Origem declarada", "Vouchers e registros (não cancelados)", "Pessoas declaradas", "Participações confirmadas"],
    ...linhas.map((l) => [titulo, l.local, l.vouchers, l.pessoas, l.participacoes_confirmadas]),
  ];
}

function inicio(c: Cabecalho, versao: string): Celula[][] {
  return [
    ["Relatório de vouchers e registros", c.municipio],
    ["Período (dia da atividade)", c.periodo],
    ["Versão", versao],
    ["Gerado em", c.geradoEm],
    ["Aviso", "Reservas não são visitas realizadas; participações não são turistas únicos; registros voluntários são adesões ao sistema, não a contagem do fluxo turístico."],
    [],
  ];
}

/** CSV administrativo: números, origem completa, prestadores e lista de vouchers (sem nome nem contato). */
export function csvCompleto(c: Cabecalho, r: RelatorioCompleto, vouchers: VoucherLinha[]): string {
  return montarCsv([
    ...inicio(c, "Administrativa (uso interno da prefeitura)"),
    ...blocoIndicadores("Reservas gratuitas", indicadoresReserva(r)),
    [],
    ...blocoIndicadores("Registros voluntários", indicadoresRegistro(r)),
    [],
    ...blocoAtividades(r),
    [],
    ...blocoOrigem("Origem por cidade", origemPorCidade(r, false)),
    [],
    ...blocoOrigem("Origem por UF", origemPorUf(r, false)),
    [],
    ["Prestadores envolvidos", "Prestador", "Categoria", "Atividades", "Vouchers (não cancelados)", "Participações confirmadas"],
    ...r.prestadores.map((p) => [
      "Prestadores envolvidos",
      p.nome,
      ROTULO_CATEGORIA_PRESTADOR[p.categoria] ?? p.categoria,
      p.atividades,
      p.vouchers,
      p.participacoes_confirmadas,
    ]),
    [],
    ["Rede de prestadores", "Participantes hoje", r.rede.participantes],
    ...r.rede.adesoes.map((a) => ["Adesão no período", a.nome, ROTULO_CATEGORIA_PRESTADOR[a.categoria] ?? a.categoria, a.data_adesao]),
    [],
    ["Vouchers", "Código", "Situação", "Dia da atividade", "Atividade", "Cidade", "UF", "Pessoas", "Pessoas atendidas", "Emissão"],
    ...vouchers.map((v) => [
      "Vouchers",
      v.codigo,
      ROTULO_STATUS[v.status],
      v.data_visita,
      v.atividades?.titulo ?? "",
      v.cidade,
      v.uf,
      v.pessoas,
      v.pessoas_atendidas ?? "",
      v.origem === "assistida" ? "Assistida" : "Pelo visitante",
    ]),
  ]);
}

/** CSV para divulgação: só agregados, sem dado pessoal nem identificador individual. */
export function csvDivulgacao(c: Cabecalho, r: RelatorioCompleto): string {
  return montarCsv([
    ...inicio(c, "Para divulgação (sem dados pessoais)"),
    ...blocoIndicadores("Reservas gratuitas", indicadoresReserva(r)),
    [],
    ...blocoIndicadores("Registros voluntários", indicadoresRegistro(r)),
    [],
    ...blocoAtividades(r),
    [],
    ...blocoOrigem("Origem por cidade", origemPorCidade(r, true)),
    [],
    ...blocoOrigem("Origem por UF", origemPorUf(r, true)),
    [],
    ["Prestadores envolvidos", "Categoria", "Prestadores", "Vouchers (não cancelados)"],
    ...prestadoresPorCategoria(r).map((p) => ["Prestadores envolvidos", p.categoria, p.prestadores, p.vouchers]),
    [],
    ["Rede de prestadores", "Participantes hoje", r.rede.participantes],
    ["Rede de prestadores", "Adesões registradas no período", r.rede.adesoes.length],
  ]);
}
