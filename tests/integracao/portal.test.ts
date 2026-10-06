import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USUARIOS_DEV } from "../ambiente";
import { clienteAnonimo, entrarComo, idDoMunicipio, sufixo, type Cliente } from "./apoio";

// Data API como o visitante a vê (chave publishable, sem sessão): só conteúdo publicado e
// nenhum dado interno de adesão, mesmo pedindo todas as colunas.

const s = sufixo();
const NOMES = { pub: `[TESTE] Publicado ${s}`, rasc: `[TESTE] Rascunho ${s}`, arq: `[TESTE] Arquivado ${s}` };
const INTERNO = `contato-interno-${s}`;
let palmeiropolis: string;
let gestor: Cliente;
const criados: Record<"atrativos" | "eventos" | "prestadores", string[]> = { atrativos: [], eventos: [], prestadores: [] };

beforeAll(async () => {
  palmeiropolis = await idDoMunicipio("palmeiropolis");
  gestor = await entrarComo(USUARIOS_DEV.gestorPalmeiropolis);
  const inicio = new Date(Date.now() + 86_400_000).toISOString();
  const fim = new Date(Date.now() + 2 * 86_400_000).toISOString();
  for (const [status, nome] of [["publicado", NOMES.pub], ["rascunho", NOMES.rasc], ["arquivado", NOMES.arq]] as const) {
    const a = await gestor.from("atrativos").insert({ municipio_id: palmeiropolis, nome, categoria: "natureza", status }).select("id").single();
    const e = await gestor.from("eventos").insert({ municipio_id: palmeiropolis, titulo: nome, inicio, fim, status }).select("id").single();
    const p = await gestor
      .from("prestadores")
      .insert({ municipio_id: palmeiropolis, nome_publico: nome, categoria: "hospedagem", situacao_rede: "participante", status })
      .select("id")
      .single();
    if (a.error || e.error || p.error) throw new Error(`Falha ao preparar: ${a.error?.message ?? e.error?.message ?? p.error?.message}`);
    criados.atrativos.push(a.data.id);
    criados.eventos.push(e.data.id);
    criados.prestadores.push(p.data.id);
  }
  const adesao = await gestor.from("adesoes_prestador").insert({
    municipio_id: palmeiropolis,
    prestador_id: criados.prestadores[0],
    data_adesao: "2026-10-01",
    responsavel: `Responsável ${s}`,
    contato_interno: INTERNO,
    comprovante_caminho: `${palmeiropolis}/adesoes/${s}.pdf`,
  });
  if (adesao.error) throw new Error(adesao.error.message);
});

afterAll(async () => {
  // Arquiva o que sobrou (não há exclusão pela API; o banco local é zerado no db reset).
  for (const t of ["atrativos", "eventos", "prestadores"] as const) {
    await gestor.from(t).update({ status: "arquivado" }).in("id", criados[t]);
  }
});

describe("portal: visibilidade pública pela Data API", () => {
  const SINGULAR = { atrativos: "atrativo", eventos: "evento", prestadores: "prestador" } as const;
  for (const tabela of ["atrativos", "eventos", "prestadores"] as const) {
    it(`anônimo recebe só o ${SINGULAR[tabela]} publicado; rascunho e arquivado não vêm nem por id`, async () => {
      const anon = clienteAnonimo();
      const { data, error } = await anon.from(tabela).select("id, status").in("id", criados[tabela]);
      expect(error).toBeNull();
      expect(data).toEqual([{ id: criados[tabela][0], status: "publicado" }]);
      const direto = await anon.from(tabela).select("id").eq("id", criados[tabela][1]).maybeSingle();
      expect(direto.data).toBeNull();
    });
  }

  it("anônimo não lê adesões (contato interno e comprovante): 42501", async () => {
    const { data, error } = await clienteAnonimo().from("adesoes_prestador").select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("prestador publicado pela API pública não traz nenhuma coluna interna", async () => {
    const { data, error } = await clienteAnonimo().from("prestadores").select("*").eq("id", criados.prestadores[0]).single();
    expect(error).toBeNull();
    expect(Object.keys(data!).sort()).toEqual(
      ["atualizado_em", "categoria", "contatos_publicos", "criado_em", "criado_por", "descricao", "id", "localizacao", "municipio_id", "nome_publico", "servicos", "situacao_rede", "status"].sort(),
    );
    expect(JSON.stringify(data)).not.toContain(INTERNO);
    // Embutir a adesão pela relação também é negado ao anônimo.
    const embutido = await clienteAnonimo().from("prestadores").select("id, adesoes_prestador (contato_interno)").eq("id", criados.prestadores[0]);
    expect(JSON.stringify(embutido.data ?? null)).not.toContain(INTERNO);
    expect(embutido.error).not.toBeNull();
  });

  it("gestor de Peixe e operador de Palmeirópolis não leem adesões de Palmeirópolis", async () => {
    for (const email of [USUARIOS_DEV.gestorPeixe, USUARIOS_DEV.operadorPalmeiropolis]) {
      const c = await entrarComo(email);
      const { data } = await c.from("adesoes_prestador").select("contato_interno").eq("municipio_id", palmeiropolis);
      expect(data ?? []).toHaveLength(0);
    }
    const { data } = await gestor.from("adesoes_prestador").select("contato_interno").eq("contato_interno", INTERNO);
    expect(data).toHaveLength(1);
  });
});
