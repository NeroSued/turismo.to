/**
 * Conteúdo da minuta do relatório de implantação (item 3.6, SPEC 6). Módulo puro: a página
 * renderiza esta estrutura e o teste de conteúdo a inspeciona.
 *
 * Regras: a minuta não simula assinatura, publicação oficial, aprovação de conselho nem
 * reconhecimento de pontuação. Identificação e assinatura do gestor ficam em branco, para
 * preenchimento fora do sistema. Metodologia, limitações, análise e recomendações são do
 * responsável; sem texto dele, aparece só a orientação entre colchetes.
 */

export const SECOES_EDITAVEIS = [
  {
    chave: "metodologia",
    titulo: "Metodologia",
    orientacao: "Como os dados foram coletados (vouchers, registros, listas de presença), por quem e em que período.",
  },
  {
    chave: "limitacoes",
    titulo: "Limitações",
    orientacao: "O que os números não mostram: visitantes sem registro, atrativos sem controle de acesso, falhas de conexão.",
  },
  {
    chave: "analise",
    titulo: "Análise",
    orientacao: "Leitura do responsável sobre os indicadores e as evidências do ano-base.",
  },
  {
    chave: "recomendacoes",
    titulo: "Recomendações",
    orientacao: "Próximos passos sugeridos para o turismo no município.",
  },
] as const;

export type SecaoEditavel = (typeof SECOES_EDITAVEIS)[number]["chave"];

export const AVISO_MINUTA =
  "Minuta de trabalho gerada pelo sistema Turismo.TO a partir dos registros do painel. Precisa ser revisada e completada pelo " +
  "gestor responsável antes de qualquer uso. Não substitui a análise do órgão estadual competente nem antecipa o resultado dessa análise.";

export const AVISO_NUMEROS =
  "Reservas não são visitas realizadas; participações confirmadas não são turistas únicos; registros voluntários são adesões " +
  "ao sistema, não a contagem do fluxo turístico.";

export type ItemIndicador = { rotulo: string; valor: number; nota: string };

export type EvidenciaMinuta = {
  id: string;
  titulo: string;
  tipo: string;
  dataRealizacao: string;
  responsavel: string;
  descricao: string;
  arquivos: { id: string; tipo: string; legenda: string; foto: boolean }[];
};

export type DadosMinuta = {
  municipio: string;
  ano: number;
  referenciaIcms: string;
  geradoEm: string;
  atividades: { titulo: string; resumo: string }[];
  indicadoresReserva: ItemIndicador[];
  indicadoresRegistro: ItemIndicador[];
  origem: string[];
  prestadores: string[];
  evidencias: EvidenciaMinuta[];
  textos: Partial<Record<SecaoEditavel, string | null>>;
};

export type Bloco =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "campo"; rotulo: string }
  | { tipo: "pendente"; texto: string }
  | { tipo: "evidencia"; evidencia: EvidenciaMinuta; resumo: string };

export type SecaoMinuta = { id: string; titulo: string; blocos: Bloco[] };

export type Minuta = { titulo: string; subtitulo: string; aviso: string; secoes: SecaoMinuta[] };

function indicadores(itens: ItemIndicador[]): string[] {
  return itens.map((i) => `${i.rotulo}: ${i.valor.toLocaleString("pt-BR")} (${i.nota})`);
}

/** Linha de resumo de uma evidência, com data, tipo, responsável e anexos. */
export function resumoEvidencia(e: EvidenciaMinuta, data: string): string {
  const anexos = e.arquivos.length
    ? `Anexos: ${e.arquivos.map((a) => `${a.tipo} (${a.legenda})`).join("; ")}.`
    : "Sem anexos registrados.";
  return `${data} · ${e.tipo} · Responsável: ${e.responsavel}. ${e.descricao} ${anexos}`;
}

export function montarMinuta(d: DadosMinuta, formatarDia: (dia: string) => string): Minuta {
  const editaveis: SecaoMinuta[] = SECOES_EDITAVEIS.map((s, i) => {
    const texto = d.textos[s.chave]?.trim();
    return {
      id: s.chave,
      titulo: `${6 + i}. ${s.titulo}`,
      blocos: texto
        ? texto.split(/\n{2,}/).map((p) => ({ tipo: "paragrafo" as const, texto: p.trim() }))
        : [{ tipo: "pendente" as const, texto: `[A preencher pelo responsável: ${s.orientacao}]` }],
    };
  });

  return {
    titulo: "Minuta do relatório de implantação",
    subtitulo: `${d.municipio} · Ano-base ${d.ano}`,
    aviso: AVISO_MINUTA,
    secoes: [
      {
        id: "identificacao",
        titulo: "1. Identificação",
        blocos: [
          { tipo: "paragrafo", texto: `Município: ${d.municipio}. Ano-base: ${d.ano}.` },
          { tipo: "campo", rotulo: "Órgão responsável" },
          { tipo: "campo", rotulo: "Gestor responsável (nome)" },
          { tipo: "campo", rotulo: "Cargo" },
          { tipo: "campo", rotulo: "Contato institucional" },
        ],
      },
      {
        id: "apresentacao",
        titulo: "2. Apresentação",
        blocos: [
          {
            tipo: "paragrafo",
            texto:
              `Este documento reúne os registros do sistema Turismo.TO de ${d.municipio} no ano-base ${d.ano}: atividades com ` +
              "vouchers gratuitos e registros voluntários, indicadores do período e evidências das ações realizadas. Os dados " +
              "podem subsidiar estudos, mas sozinhos não formam uma pesquisa técnica: metodologia, limitações, análise e " +
              "recomendações cabem ao responsável (seções 6 a 9).",
          },
          { tipo: "paragrafo", texto: `Referência da cartilha do ICMS Ecológico indicada pelo município: ${d.referenciaIcms}.` },
        ],
      },
      {
        id: "atividades",
        titulo: "3. Atividades",
        blocos: d.atividades.length
          ? [{ tipo: "lista", itens: d.atividades.map((a) => `${a.titulo}: ${a.resumo}`) }]
          : [{ tipo: "pendente", texto: "[Nenhuma atividade com vouchers ou registros no ano-base.]" }],
      },
      {
        id: "indicadores",
        titulo: "4. Indicadores",
        blocos: [
          { tipo: "paragrafo", texto: AVISO_NUMEROS },
          { tipo: "lista", itens: indicadores(d.indicadoresReserva) },
          { tipo: "lista", itens: indicadores(d.indicadoresRegistro) },
          ...(d.origem.length ? [{ tipo: "paragrafo" as const, texto: `Origem declarada por UF: ${d.origem.join("; ")}.` }] : []),
          ...(d.prestadores.length
            ? [{ tipo: "paragrafo" as const, texto: `Prestadores envolvidos: ${d.prestadores.join("; ")}.` }]
            : []),
        ],
      },
      {
        id: "evidencias",
        titulo: "5. Evidências",
        blocos: d.evidencias.length
          ? d.evidencias.map((e) => ({ tipo: "evidencia" as const, evidencia: e, resumo: resumoEvidencia(e, formatarDia(e.dataRealizacao)) }))
          : [{ tipo: "pendente", texto: "[Nenhuma evidência registrada no ano-base. Registre as ações em Evidências.]" }],
      },
      ...editaveis,
      {
        id: "assinatura",
        titulo: "10. Responsável pelas informações",
        blocos: [
          { tipo: "paragrafo", texto: "Campos para preenchimento à mão pelo gestor responsável, após a revisão desta minuta." },
          { tipo: "campo", rotulo: "Nome" },
          { tipo: "campo", rotulo: "Cargo" },
          { tipo: "campo", rotulo: "Local e data" },
          { tipo: "campo", rotulo: "Assinatura" },
        ],
      },
    ],
  };
}

/** Texto corrido da minuta (para o teste de conteúdo e para conferência). */
export function textoDaMinuta(m: Minuta): string {
  const partes = [m.titulo, m.subtitulo, m.aviso];
  for (const s of m.secoes) {
    partes.push(s.titulo);
    for (const b of s.blocos) {
      if (b.tipo === "lista") partes.push(...b.itens);
      else if (b.tipo === "campo") partes.push(`${b.rotulo}: ____`);
      else if (b.tipo === "evidencia") partes.push(b.evidencia.titulo, b.resumo);
      else partes.push(b.texto);
    }
  }
  return partes.join("\n");
}
