import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import { ambienteLocal } from "../ambiente";

export type Cliente = SupabaseClient<Database>;

const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente com a chave secreta do Supabase LOCAL, como o servidor nas operações privilegiadas. */
export function clienteServico(): Cliente {
  const { url, secret } = ambienteLocal();
  return createClient<Database>(url, secret, semSessao);
}

/** Cliente anônimo com a chave publishable, como o navegador de um visitante. */
export function clienteAnonimo(): Cliente {
  const { url, publishable } = ambienteLocal();
  return createClient<Database>(url, publishable, semSessao);
}

/**
 * Entra como um usuário [DEV] do seed local. Define uma senha aleatória pela Admin API
 * (nenhuma senha fica no repositório) e devolve um cliente com a sessão dele: tudo passa pela RLS.
 */
export async function entrarComo(email: string): Promise<Cliente> {
  const { url, publishable } = ambienteLocal();
  const admin = clienteServico();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Falha ao listar usuários locais: ${error.message}`);
  const usuario = data.users.find((u) => u.email === email);
  if (!usuario) throw new Error(`Usuário ${email} não existe. Rode \`npx supabase db reset\`.`);
  const senha = randomBytes(18).toString("base64url");
  const r = await admin.auth.admin.updateUserById(usuario.id, { password: senha });
  if (r.error) throw new Error(`Falha ao definir senha de ${email}: ${r.error.message}`);

  const cliente = createClient<Database>(url, publishable, semSessao);
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw new Error(`Falha no login de ${email}: ${login.error.message}`);
  return cliente;
}

export async function idDoMunicipio(slug: string): Promise<string> {
  const { data, error } = await clienteAnonimo().from("municipios").select("id").eq("slug", slug).single();
  if (error) throw new Error(`Município ${slug}: ${error.message}`);
  return data.id;
}

export function sufixo(): string {
  return randomBytes(4).toString("hex");
}
