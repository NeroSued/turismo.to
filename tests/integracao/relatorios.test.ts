import { beforeAll, describe, expect, it } from "vitest";
import { USUARIOS_DEV } from "../ambiente";
import { entrarComo, idDoMunicipio, sufixo, type Cliente } from "./apoio";

// Fase 3 pela Data API e pelo Storage reais do Supabase local, com as sessões dos usuários [DEV]:
// isolamento de relatórios e evidências entre municípios e histórico de alterações com autoria.

let gestor: Cliente;
let operador: Cliente;
let gestorPeixe: Cliente;
let palmeiropolis: string;
let peixe: string;
let evidenciaId: string;
let caminho: string;

const PDF = new TextEncoder().encode("%PDF-1.4\n% lista de presença [DEV]\n%%EOF\n");

function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(new Date());
}

beforeAll(async () => {
  [gestor, operador, gestorPeixe] = await Promise.all([
    entrarComo(USUARIOS_DEV.gestorPalmeiropolis),
    entrarComo(USUARIOS_DEV.operadorPalmeiropolis),
    entrarComo(USUARIOS_DEV.gestorPeixe),
  ]);
  [palmeiropolis, peixe] = await Promise.all([idDoMunicipio("palmeiropolis"), idDoMunicipio("peixe")]);

  const { data, error } = await gestor
    .from("evidencias")
    .insert({
      municipio_id: palmeiropolis,
      ano_base: Number(hoje().slice(0, 4)),
      tipo_acao: "capacitacao",
      titulo: `[DEV] Oficina de integração ${sufixo()}`,
      descricao: "Oficina registrada pelo teste de integração.",
      data_realizacao: hoje(),
      responsavel: "Secretaria de Turismo",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Criar evidência: ${error.message}`);
  evidenciaId = data.id;

  caminho = `${palmeiropolis}/evidencias/${crypto.randomUUID()}.pdf`;
  const envio = await gestor.storage.from("interno").upload(caminho, PDF, { contentType: "application/pdf" });
  if (envio.error) throw new Error(`Enviar anexo: ${envio.error.message}`);
  const arq = await gestor.from("evidencias_arquivos").insert({
    municipio_id: palmeiropolis,
    evidencia_id: evidenciaId,
    tipo: "lista_presenca",
    caminho,
    legenda: "Lista de presença [DEV]",
    mime: "application/pdf",
    tamanho: PDF.byteLength,
  });
  if (arq.error) throw new Error(`Registrar anexo: ${arq.error.message}`);
});

describe("isolamento entre municípios (gestor de Peixe x Palmeirópolis)", () => {
  it("não obtém o relatório de Palmeirópolis", async () => {
    const { data, error } = await gestorPeixe.rpc("relatorio_completo", {
      p_municipio_id: palmeiropolis,
      p_inicio: `${hoje().slice(0, 4)}-01-01`,
      p_fim: `${hoje().slice(0, 4)}-12-31`,
    });
    expect(data).toBeNull();
    expect(error?.message).toBe("sem_permissao");
    // e obtém o do próprio município
    const proprio = await gestorPeixe.rpc("relatorio_completo", { p_municipio_id: peixe, p_inicio: "2026-01-01", p_fim: "2026-12-31" });
    expect(proprio.error).toBeNull();
  });

  it("não lê evidência, anexos, histórico nem minuta de Palmeirópolis", async () => {
    const [ev, arq, hist, min] = await Promise.all([
      gestorPeixe.from("evidencias").select("id").eq("id", evidenciaId),
      gestorPeixe.from("evidencias_arquivos").select("id").eq("evidencia_id", evidenciaId),
      gestorPeixe.from("evidencias_historico").select("id").eq("evidencia_id", evidenciaId),
      gestorPeixe.from("minutas_relatorio").select("ano_base").eq("municipio_id", palmeiropolis),
    ]);
    expect([ev.data, arq.data, hist.data, min.data]).toEqual([[], [], [], []]);
  });

  it("não altera a evidência nem baixa o anexo de Palmeirópolis", async () => {
    const upd = await gestorPeixe.from("evidencias").update({ titulo: "Alterado por Peixe" }).eq("id", evidenciaId).select("id");
    expect(upd.data).toEqual([]);
    const baixar = await gestorPeixe.storage.from("interno").download(caminho);
    expect(baixar.data).toBeNull();
    const assinar = await gestorPeixe.storage.from("interno").createSignedUrl(caminho, 60);
    expect(assinar.data).toBeNull();
    const lista = await gestorPeixe.storage.from("interno").list(`${palmeiropolis}/evidencias`);
    expect(lista.data ?? []).toEqual([]);
  });

  it("operador de Palmeirópolis também não vê relatórios nem evidências", async () => {
    const ev = await operador.from("evidencias").select("id").eq("id", evidenciaId);
    expect(ev.data).toEqual([]);
    const rel = await operador.rpc("relatorio_completo", { p_municipio_id: palmeiropolis, p_inicio: "2026-01-01", p_fim: "2026-12-31" });
    expect(rel.error?.message).toBe("sem_permissao");
  });
});

describe("histórico de evidências", () => {
  it("editar gera registro com autor e horário; o gestor de Palmeirópolis baixa o próprio anexo", async () => {
    const antes = Date.now();
    const upd = await gestor
      .from("evidencias")
      .update({ descricao: "Oficina com 18 condutores, registrada pelo teste de integração." })
      .eq("id", evidenciaId)
      .select("id");
    expect(upd.error).toBeNull();
    const { data } = await gestor
      .from("evidencias_historico")
      .select("acao, campos, autor_nome, autor_id, em")
      .eq("evidencia_id", evidenciaId)
      .order("id");
    expect(data!.map((h) => h.acao)).toEqual(["criada", "arquivo_incluido", "editada"]);
    const edicao = data![2];
    expect(edicao.campos).toEqual(["descricao"]);
    expect(edicao.autor_nome).toBe("[DEV] Gestor de Palmeirópolis");
    expect(edicao.autor_id).toBe((await gestor.auth.getSession()).data.session!.user.id);
    expect(new Date(edicao.em).getTime()).toBeGreaterThanOrEqual(antes - 5_000);
    expect(new Date(edicao.em).getTime()).toBeLessThanOrEqual(Date.now() + 5_000);

    const baixar = await gestor.storage.from("interno").download(caminho);
    expect(baixar.error).toBeNull();
  });

  it("ninguém grava nem apaga o histórico pela API", async () => {
    const ins = await gestor.from("evidencias_historico").insert({ municipio_id: palmeiropolis, evidencia_id: evidenciaId, acao: "editada" });
    expect(ins.error?.code).toBe("42501");
    const del = await gestor.from("evidencias_historico").delete().eq("evidencia_id", evidenciaId);
    expect(del.error?.code).toBe("42501");
  });
});
