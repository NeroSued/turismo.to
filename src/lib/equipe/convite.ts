import "server-only";
import { criarClientePrivilegiado } from "@/lib/supabase/privilegiado";

/**
 * Operação privilegiada 4 do docs/PLANO.md (D8): encontrar a conta pelo e-mail ou criá-la por
 * convite do Auth (a pessoa define a própria senha pelo link do e-mail; ninguém recebe senha).
 *
 * Só é chamada DEPOIS que a action conferiu, com a sessão do usuário, que ele é gestor do
 * município do convite (ou admin). Não grava vínculo: isso é feito com a sessão do usuário,
 * sob a RLS. O nome só é gravado em conta nova (ninguém renomeia a conta de outra pessoa).
 */
export async function contaParaConvite(
  email: string,
  nome: string | null,
  redirectTo: string,
): Promise<{ ok: true; userId: string; nova: boolean } | { ok: false }> {
  const servico = criarClientePrivilegiado();
  const existente = await servico.rpc("usuario_por_email", { p_email: email });
  if (existente.error) return { ok: false };
  if (existente.data) return { ok: true, userId: existente.data, nova: false };

  const convite = await servico.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (convite.error || !convite.data.user) return { ok: false };
  const userId = convite.data.user.id;
  if (nome) await servico.from("perfis").update({ nome }).eq("user_id", userId);
  return { ok: true, userId, nova: true };
}
