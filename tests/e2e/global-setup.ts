import { createClient } from "@supabase/supabase-js";
import { USUARIOS_DEV } from "../ambiente";
import { AMBIENTE, sql } from "./alvo";

/** Define a senha aleatória desta execução nas contas [DEV] do banco do alvo (local ou projeto de teste). */
export default async function globalSetup() {
  const { url, secret } = AMBIENTE;
  const senha = process.env.E2E_SENHA;
  if (!senha) throw new Error("E2E_SENHA não definida pelo playwright.config.ts.");

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Falha ao listar usuários locais: ${error.message}`);

  for (const email of Object.values(USUARIOS_DEV)) {
    const u = data.users.find((x) => x.email === email);
    if (!u) throw new Error(`Usuário ${email} não existe. Rode \`npx supabase db reset\` para aplicar o seed.dev.sql.`);
    const r = await admin.auth.admin.updateUserById(u.id, { password: senha });
    if (r.error) throw new Error(`Falha ao definir a senha de ${email}: ${r.error.message}`);
  }

  // Execuções seguidas do E2E saem do mesmo IP (127.0.0.1) e esbarrariam no limite de
  // emissões públicas (D9). Zera a contagem só no banco local ou no de teste (conferidos em ambienteE2E).
  sql("delete from public.limites_requisicao");
}
