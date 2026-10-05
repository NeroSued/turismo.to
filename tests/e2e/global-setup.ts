import { createClient } from "@supabase/supabase-js";
import { ambienteLocal, USUARIOS_DEV } from "../ambiente";

/** Define a senha aleatória desta execução nas contas [DEV] do banco local. */
export default async function globalSetup() {
  const { url, secret } = ambienteLocal();
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
}
