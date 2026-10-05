/**
 * Cria (ou promove) o administrador da assessoria.
 *
 *   npm run criar-admin -- pessoa@exemplo.gov.br
 *
 * Convida pelo Auth Admin API (a pessoa define a própria senha pelo link do e-mail)
 * e marca perfis.admin_assessoria = true. Operação privilegiada 3 do docs/PLANO.md (D8).
 * Lê NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e NEXT_PUBLIC_ROOT_DOMAIN de .env.local.
 */
import { z } from "zod";
import { criarClientePrivilegiado } from "@/lib/supabase/privilegiado";

async function encontrarUsuario(supabase: ReturnType<typeof criarClientePrivilegiado>, email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao procurar o usuário: ${error.message}`);
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function principal() {
  const email = z.email().safeParse(process.argv[2]?.trim().toLowerCase());
  if (!email.success) {
    console.error("Uso: npm run criar-admin -- <email>");
    process.exit(2);
  }

  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!raiz) throw new Error("NEXT_PUBLIC_ROOT_DOMAIN não definida.");
  const protocolo = raiz.includes("localhost") ? "http" : "https";
  const redirectTo = `${protocolo}://${raiz}/auth/confirm?next=/conta/nova-senha`;

  const supabase = criarClientePrivilegiado();
  let userId: string;
  const convite = await supabase.auth.admin.inviteUserByEmail(email.data, { redirectTo });

  if (convite.data.user) {
    userId = convite.data.user.id;
    console.log(`Convite enviado para ${email.data}. A pessoa define a senha pelo link do e-mail.`);
  } else if (convite.error?.code === "email_exists" || convite.error?.status === 422) {
    const existente = await encontrarUsuario(supabase, email.data);
    if (!existente) throw new Error(`O Auth recusou o convite: ${convite.error.message}`);
    userId = existente.id;
    console.log(`${email.data} já tinha conta; nenhum convite novo foi enviado.`);
  } else {
    throw new Error(`Falha ao convidar: ${convite.error?.message ?? "erro desconhecido"}`);
  }

  const { data, error } = await supabase
    .from("perfis")
    .update({ admin_assessoria: true })
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(`Falha ao marcar o perfil como admin: ${error.message}`);
  if (!data?.length) throw new Error("Perfil não encontrado. Confira se a migration de fundação foi aplicada.");

  console.log(`${email.data} agora é administrador da assessoria.`);
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
