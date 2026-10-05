import { describe, expect, it } from "vitest";
import type { RelatorioCompleto, VoucherLinha } from "../../src/lib/relatorios/dados";
import { celulaCsv, csvCompleto, csvDivulgacao, MINIMO_POR_CIDADE } from "../../src/lib/relatorios/exportacao";

// CSV dos relatórios (itens 3.2 e 3.3). O teste de ponta a ponta com nome e contato reais
// está em tests/e2e/relatorios.spec.ts; aqui, as regras de montagem.

const r: RelatorioCompleto = {
  inicio: "2026-01-01",
  fim: "2026-12-31",
  emitidos: 7,
  utilizados: 3,
  cancelados: 1,
  expirados: 1,
  aguardando: 2,
  pessoas_reservadas: 15,
  participacoes_confirmadas: 6,
  registros_voluntarios: 2,
  pessoas_registros_voluntarios: 4,
  registros_confirmados: 0,
  pessoas_registros_confirmados: 0,
  emissoes_assistidas: 1,
  por_atividade: [
    { atividade: "Trilha", modo: "reserva", emitidos: 7, utilizados: 3, cancelados: 1, expirados: 1, pessoas_reservadas: 15, participacoes_confirmadas: 6 },
  ],
  origem: [
    { uf: "TO", cidade: "Gurupi", vouchers: 5, pessoas: 10, participacoes_confirmadas: 4 },
    { uf: "GO", cidade: "Uruaçu", vouchers: 1, pessoas: 3, participacoes_confirmadas: 2 },
    { uf: "TO", cidade: "Paranã", vouchers: 2, pessoas: 2, participacoes_confirmadas: 0 },
  ],
  prestadores: [
    { nome: "João Guia Autônomo", categoria: "guias", situacao_rede: "participante", atividades: 1, vouchers: 6, participacoes_confirmadas: 6 },
  ],
  rede: { participantes: 3, adesoes: [{ nome: "Maria Artesã", categoria: "artesanato", data_adesao: "2026-02-01" }] },
};

const vouchers: VoucherLinha[] = [
  {
    codigo: "ABCDEFGHJKMN",
    status: "utilizado",
    origem: "publico",
    data_visita: "2026-05-01",
    pessoas: 3,
    pessoas_atendidas: 2,
    cidade: "Uruaçu",
    uf: "GO",
    atividades: { titulo: "Trilha", modo: "reserva" },
  },
];

const cab = { municipio: "Palmeirópolis", periodo: "01/01/2026 a 31/12/2026", geradoEm: "05/10/2026 10:00" };

describe("CSV de divulgação", () => {
  const csv = csvDivulgacao(cab, r);

  it("não traz código de voucher, nome de prestador nem linha individual", () => {
    expect(csv).not.toContain("ABCDEFGHJKMN");
    expect(csv).not.toContain("João Guia Autônomo");
    expect(csv).not.toContain("Maria Artesã");
    expect(csv).not.toMatch(/^Vouchers;Código/m);
  });

  it(`soma cidades com menos de ${MINIMO_POR_CIDADE} registros numa linha só`, () => {
    expect(csv).toContain("Origem por cidade;Gurupi/TO;5;10;4");
    expect(csv).not.toContain("Uruaçu");
    expect(csv).not.toContain("Paranã");
    expect(csv).toContain(`Origem por cidade;Outras cidades (menos de ${MINIMO_POR_CIDADE} registros cada);3;5;2`);
    expect(csv).toContain("Origem por UF;TO;7;12;4");
    expect(csv).toContain(`Origem por UF;Outras UFs (menos de ${MINIMO_POR_CIDADE} registros cada);1;3;2`);
  });

  it("mostra prestadores só por categoria e os rótulos que separam reserva de visita", () => {
    expect(csv).toContain("Prestadores envolvidos;Guias e condutores;1;6");
    expect(csv).toContain("reservas feitas, não visitas");
    expect(csv).toContain("não são turistas únicos");
    expect(csv).toContain("Para divulgação (sem dados pessoais)");
  });
});

describe("CSV administrativo", () => {
  const csv = csvCompleto(cab, r, vouchers);

  it("traz a lista de vouchers sem colunas de nome ou contato", () => {
    const cabecalho = csv.split("\r\n").find((l) => l.startsWith("Vouchers;"))!;
    expect(cabecalho).toBe("Vouchers;Código;Situação;Dia da atividade;Atividade;Cidade;UF;Pessoas;Pessoas atendidas;Emissão");
    expect(cabecalho).not.toMatch(/nome|contato|telefone|e-mail/i);
    expect(csv).toContain("Vouchers;ABCDEFGHJKMN;Utilizado;2026-05-01;Trilha;Uruaçu;GO;3;2;Pelo visitante");
  });

  it("começa com BOM e usa ponto e vírgula", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Relatório de vouchers e registros;Palmeirópolis");
  });
});

describe("célula CSV", () => {
  it("neutraliza fórmulas e escapa aspas e separadores", () => {
    expect(celulaCsv("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celulaCsv("+55 63")).toBe("'+55 63");
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv(12)).toBe("12");
  });
});
