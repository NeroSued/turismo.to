import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ambienteLocal } from "../ambiente";

// Pela Data API real (PostgREST) com a chave publishable, como o navegador de um visitante.
describe("API pública com a chave publishable (visitante anônimo)", () => {
  const { url, publishable } = ambienteLocal();
  const anon = createClient(url, publishable, { auth: { persistSession: false } });

  it("lista os sete municípios ativos do seed", async () => {
    const { data, error } = await anon.from("municipios").select("slug").order("slug");
    expect(error).toBeNull();
    expect(data?.map((m) => m.slug)).toEqual([
      "ananas",
      "arraias",
      "jaudotocantins",
      "palmeiropolis",
      "parana",
      "peixe",
      "saosalvador",
    ]);
  });

  it("lê a configuração pública dos municípios", async () => {
    const { data, error } = await anon.from("configuracoes_municipio").select("cor_primaria, referencia_icms");
    expect(error).toBeNull();
    expect(data).toHaveLength(7);
    expect(data?.[0]?.referencia_icms).toBe("item 6.1.4");
  });

  it.each(["perfis", "vinculos", "auditoria"])("não lê %s", async (tabela) => {
    const { data, error } = await anon.from(tabela).select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("não cria município", async () => {
    const { error } = await anon.from("municipios").insert({ slug: "invasor", nome: "Invasor" });
    expect(error?.code).toBe("42501");
  });

  it("não existe cadastro público de contas", async () => {
    const { data, error } = await anon.auth.signUp({
      email: `intruso-${Date.now()}@exemplo.test`,
      password: randomBytes(16).toString("base64url"),
    });
    expect(data.user).toBeNull();
    expect(error?.code).toBe("signup_disabled");
  });

  it("não chama funções privadas pela API", async () => {
    const { error } = await anon.rpc("eh_admin");
    expect(error).not.toBeNull();
  });
});
