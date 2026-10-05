import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { USUARIOS_DEV } from "../ambiente";
import { clienteServico, entrarComo, idDoMunicipio, sufixo, type Cliente } from "./apoio";

// Fase 4 pela Data API e pela API do Storage do Supabase local, com a sessão de cada pessoa.

const PDF = new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"], { type: "application/pdf" });

let palmeiropolis: string;
let peixe: string;
let gestor: Cliente;
let operador: Cliente;
let admin: Cliente;

async function idDoUsuario(email: string) {
  const { data } = await clienteServico().auth.admin.listUsers({ perPage: 200 });
  return data.users.find((u) => u.email === email)!.id;
}

beforeAll(async () => {
  [palmeiropolis, peixe] = await Promise.all([idDoMunicipio("palmeiropolis"), idDoMunicipio("peixe")]);
  gestor = await entrarComo(USUARIOS_DEV.gestorPalmeiropolis);
  operador = await entrarComo(USUARIOS_DEV.operadorPalmeiropolis);
  admin = await entrarComo(USUARIOS_DEV.admin);
});

describe("escalada de privilégio pela API", () => {
  it("gestor não cria vínculo em outro município nem se promove ou promove outro a admin", async () => {
    const operadorId = await idDoUsuario(USUARIOS_DEV.operadorPalmeiropolis);
    const gestorId = await idDoUsuario(USUARIOS_DEV.gestorPalmeiropolis);

    const vinculo = await gestor.from("vinculos").insert({ user_id: operadorId, municipio_id: peixe, papel: "gestor" });
    expect(vinculo.error?.code).toBe("42501");

    const proprio = await gestor.from("perfis").update({ admin_assessoria: true }).eq("user_id", gestorId).select();
    expect(proprio.error?.code).toBe("42501");

    const outro = await gestor.from("perfis").update({ admin_assessoria: true }).eq("user_id", operadorId).select();
    expect(outro.data ?? []).toEqual([]);

    const mover = await gestor.from("vinculos").update({ municipio_id: peixe } as never).eq("user_id", operadorId).select();
    expect(mover.error?.code).toBe("42501");

    const conta = await gestor.rpc("usuario_por_email", { p_email: USUARIOS_DEV.admin });
    expect(conta.error?.message).toContain("sem_permissao");

    const { data } = await clienteServico().from("perfis").select("user_id, admin_assessoria").in("user_id", [gestorId, operadorId]);
    expect(data?.every((p) => p.admin_assessoria === false)).toBe(true);
    const { count } = await clienteServico().from("vinculos").select("*", { count: "exact", head: true }).eq("municipio_id", peixe);
    expect(count).toBe(1);
  });

  it("gestor lista a equipe só do próprio município", async () => {
    const proprio = await gestor.rpc("equipe_do_municipio", { p_municipio_id: palmeiropolis });
    expect(proprio.error).toBeNull();
    expect(proprio.data?.map((m) => m.email)).toEqual(expect.arrayContaining([USUARIOS_DEV.operadorPalmeiropolis]));
    const outro = await gestor.rpc("equipe_do_municipio", { p_municipio_id: peixe });
    expect(outro.error?.message).toContain("sem_permissao");
    const op = await operador.rpc("equipe_do_municipio", { p_municipio_id: palmeiropolis });
    expect(op.error?.message).toContain("sem_permissao");
  });
});

describe("exclusão LGPD de arquivo de evidência", () => {
  let evidenciaId: string;

  beforeAll(async () => {
    const { data, error } = await gestor
      .from("evidencias")
      .insert({
        municipio_id: palmeiropolis,
        ano_base: Number(new Date().getFullYear()),
        tipo_acao: "reuniao",
        titulo: `[TESTE] LGPD ${sufixo()}`,
        descricao: "Reunião para testar a exclusão LGPD.",
        data_realizacao: "2026-01-10",
        responsavel: "Secretaria",
      })
      .select("id")
      .single();
    if (error) throw error;
    evidenciaId = data.id;
  });

  async function anexar() {
    const caminho = `${palmeiropolis}/evidencias/${randomUUID()}.pdf`;
    const envio = await gestor.storage.from("interno").upload(caminho, PDF, { contentType: "application/pdf" });
    expect(envio.error).toBeNull();
    const { data, error } = await gestor
      .from("evidencias_arquivos")
      .insert({ municipio_id: palmeiropolis, evidencia_id: evidenciaId, tipo: "ata", caminho, legenda: "Ata com nome da titular", mime: "application/pdf", tamanho: PDF.size })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, caminho };
  }

  const existe = async (caminho: string) => !(await clienteServico().storage.from("interno").download(caminho)).error;

  it("gestor e operador não apagam o arquivo nem pelo Storage nem pela função", async () => {
    const { id, caminho } = await anexar();
    await gestor.storage.from("interno").remove([caminho]);
    expect(await existe(caminho), "a política do Storage não deixa o gestor apagar arquivo de evidência").toBe(true);
    const sobrescrita = await gestor.storage.from("interno").upload(caminho, PDF, { contentType: "application/pdf", upsert: true });
    expect(sobrescrita.error).not.toBeNull();

    const linha = await gestor.from("evidencias_arquivos").delete().eq("id", id).select();
    expect(linha.error?.code).toBe("42501");

    for (const quem of [gestor, operador]) {
      const r = await quem.rpc("excluir_arquivo_evidencia_lgpd", { p_arquivo_id: id, p_motivo: "Pedido da titular por e-mail" });
      expect(r.error?.message).toContain("sem_permissao");
    }
    expect(await existe(caminho)).toBe(true);
  });

  it("gestor ainda limpa um envio que não chegou a virar arquivo da evidência", async () => {
    const orfao = `${palmeiropolis}/evidencias/${randomUUID()}.pdf`;
    await gestor.storage.from("interno").upload(orfao, PDF, { contentType: "application/pdf" });
    const r = await gestor.storage.from("interno").remove([orfao]);
    expect(r.data?.length).toBe(1);
    expect(await existe(orfao)).toBe(false);
  });

  it("admin apaga do Storage e a função registra quem, quando e o motivo, sem cópia", async () => {
    const { id, caminho } = await anexar();
    const cedo = await admin.rpc("excluir_arquivo_evidencia_lgpd", { p_arquivo_id: id, p_motivo: "Pedido da titular por e-mail" });
    expect(cedo.error?.message, "não registra exclusão com o arquivo ainda guardado").toContain("arquivo_ainda_no_storage");

    const antes = new Date();
    const remocao = await admin.storage.from("interno").remove([caminho]);
    expect(remocao.data?.length).toBe(1);
    expect(await existe(caminho)).toBe(false);
    const r = await admin.rpc("excluir_arquivo_evidencia_lgpd", { p_arquivo_id: id, p_motivo: "Pedido da titular por e-mail" });
    expect(r.error).toBeNull();

    const { data: linha } = await clienteServico().from("evidencias_arquivos").select("id").eq("id", id);
    expect(linha).toEqual([]);
    const { data: hist } = await gestor
      .from("evidencias_historico")
      .select("acao, autor_id, autor_nome, em, antes, depois")
      .eq("evidencia_id", evidenciaId)
      .eq("acao", "arquivo_excluido_lgpd");
    expect(hist).toHaveLength(1);
    expect(hist![0].autor_id).toBe(await idDoUsuario(USUARIOS_DEV.admin));
    expect(hist![0].autor_nome).toBe("[DEV] Admin da assessoria");
    expect(new Date(hist![0].em).getTime()).toBeGreaterThanOrEqual(antes.getTime() - 2000);
    expect(hist![0].depois).toEqual({ motivo: "Pedido da titular por e-mail" });
    expect(JSON.stringify(hist![0].antes)).not.toContain("titular");
  });
});
