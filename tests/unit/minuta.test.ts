import { describe, expect, it } from "vitest";
import { AVISO_MINUTA, montarMinuta, SECOES_EDITAVEIS, textoDaMinuta, type DadosMinuta } from "../../src/lib/minuta/conteudo";

// Teste de conteúdo da minuta (Fase 3, "Pronto quando"): sem assinatura simulada, sem aprovação
// de conselho, sem publicação oficial e sem promessa de pontuação.

const PROIBIDO: [string, RegExp][] = [
  ["assinatura simulada", /assinado (digital|eletronic)|assinatura (digital|eletrônica)|documento assinado|assinado por|\bass\.:/i],
  ["aprovação de conselho", /conselho|aprovad|aprovação|homologad|deliberação|parecer favorável/i],
  ["publicação oficial", /diário oficial|publicad[oa] (no|em)|\bDOE\b|\bDOM\b|publicação oficial/i],
  ["promessa de pontuação", /pontua|pontos|garant|assegur|fará jus|direito a|receberá|repasse|índice/i],
  ["pesquisa concluída", /pesquisa (técnica )?conclu[íi]da|estudo conclu[íi]do/i],
];

function dados(parcial: Partial<DadosMinuta> = {}): DadosMinuta {
  return {
    municipio: "Palmeirópolis",
    ano: 2026,
    referenciaIcms: "item 6.1.4",
    geradoEm: "05/10/2026 10:00",
    atividades: [{ titulo: "Trilha da Serra", resumo: "reserva gratuita; 4 vouchers emitidos" }],
    indicadoresReserva: [{ rotulo: "Vouchers emitidos", valor: 4, nota: "reservas feitas, não visitas" }],
    indicadoresRegistro: [{ rotulo: "Registros voluntários", valor: 2, nota: "adesões ao sistema, não o fluxo total" }],
    origem: ["TO, 5 vouchers e registros, 12 pessoas declaradas"],
    prestadores: ["Pousada do Rio (Hospedagem)"],
    evidencias: [
      {
        id: "e1",
        titulo: "Oficina de condutores",
        tipo: "Capacitação ou oficina",
        dataRealizacao: "2026-03-12",
        responsavel: "Secretaria de Turismo",
        descricao: "Oficina com condutores locais.",
        arquivos: [{ id: "a1", tipo: "Lista de presença", legenda: "Lista da oficina", foto: false }],
      },
    ],
    textos: {},
    ...parcial,
  };
}

const formatar = (d: string) => d.split("-").reverse().join("/");

describe("minuta do relatório de implantação", () => {
  const minuta = montarMinuta(dados(), formatar);
  const texto = textoDaMinuta(minuta);

  it.each(PROIBIDO)("não contém %s", (_, padrao) => {
    expect(texto).not.toMatch(padrao);
  });

  it("identificação e assinatura do gestor ficam em branco (só rótulos, nenhum valor)", () => {
    for (const id of ["identificacao", "assinatura"]) {
      const secao = minuta.secoes.find((s) => s.id === id)!;
      const campos = secao.blocos.filter((b) => b.tipo === "campo");
      expect(campos.length).toBeGreaterThanOrEqual(4);
      for (const c of campos) expect(Object.keys(c).sort()).toEqual(["rotulo", "tipo"]);
    }
    const assinatura = minuta.secoes.find((s) => s.id === "assinatura")!;
    expect(assinatura.blocos.map((b) => (b.tipo === "campo" ? b.rotulo : null))).toContain("Assinatura");
  });

  it("não recebe nem mostra nome de usuário: a estrutura de dados não tem campo para o gestor", () => {
    expect(Object.keys(dados())).not.toContain("gestor");
    expect(texto).not.toMatch(/\[DEV\]|Gestor de Palmeirópolis/);
  });

  it("traz o aviso de que não substitui a análise estadual, no início", () => {
    expect(minuta.aviso).toBe(AVISO_MINUTA);
    expect(AVISO_MINUTA).toMatch(/Não substitui a análise do órgão estadual competente/);
    expect(texto.indexOf(AVISO_MINUTA)).toBeLessThan(texto.indexOf("1. Identificação"));
  });

  it("tem atividades, indicadores com notas de leitura, evidências e a referência configurável do ICMS", () => {
    expect(texto).toContain("Trilha da Serra");
    expect(texto).toContain("Vouchers emitidos: 4 (reservas feitas, não visitas)");
    expect(texto).toMatch(/Reservas não são visitas realizadas/);
    expect(texto).toContain("Oficina de condutores");
    expect(texto).toContain("12/03/2026");
    expect(texto).toContain("Lista de presença (Lista da oficina)");
    expect(texto).toContain("item 6.1.4");
    expect(montarMinuta(dados({ referenciaIcms: "item 7.2" }), formatar).secoes[1].blocos.map((b) => JSON.stringify(b)).join()).toContain(
      "item 7.2",
    );
  });

  it("seções do responsável ficam pendentes até ele escrever; o texto dele entra como parágrafos", () => {
    for (const s of SECOES_EDITAVEIS) {
      const secao = minuta.secoes.find((x) => x.id === s.chave)!;
      expect(secao.blocos).toEqual([{ tipo: "pendente", texto: `[A preencher pelo responsável: ${s.orientacao}]` }]);
    }
    const preenchida = montarMinuta(dados({ textos: { analise: "Primeiro parágrafo.\n\nSegundo parágrafo." } }), formatar);
    expect(preenchida.secoes.find((x) => x.id === "analise")!.blocos).toEqual([
      { tipo: "paragrafo", texto: "Primeiro parágrafo." },
      { tipo: "paragrafo", texto: "Segundo parágrafo." },
    ]);
  });

  it("sem dados, mostra estados vazios em vez de inventar conteúdo", () => {
    const vazia = textoDaMinuta(montarMinuta(dados({ atividades: [], evidencias: [], origem: [], prestadores: [] }), formatar));
    expect(vazia).toContain("[Nenhuma atividade com vouchers ou registros no ano-base.]");
    expect(vazia).toContain("[Nenhuma evidência registrada no ano-base. Registre as ações em Evidências.]");
  });
});
