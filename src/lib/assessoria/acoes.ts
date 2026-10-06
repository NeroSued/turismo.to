"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contextoDaAcao, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";

// Área da assessoria (item 4.1). Só o admin; a RLS de municipios e o trigger de perfis conferem de novo
// (promover a admin continua sendo só de outro admin, e ninguém altera o próprio perfil administrativo).

type Estado = ResultadoAcao | undefined;
const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";

async function exigirAdmin() {
  const ctx = await contextoDaAcao(["admin"]);
  return ctx?.papel === "admin" ? ctx : null;
}

export async function definirMunicipioAtivo(municipioId: string, ativo: boolean): Promise<ResultadoAcao> {
  const ctx = await exigirAdmin();
  if (!ctx || !z.uuid().safeParse(municipioId).success || typeof ativo !== "boolean") return { ok: false, erro: SEM_PERMISSAO };
  if (municipioId === ctx.municipio.id && !ativo) {
    return { ok: false, erro: "Você está no painel deste município. Desative-o pelo painel de outro município." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("municipios").update({ ativo }).eq("id", municipioId).select("nome");
  if (error) return { ok: false, erro: ERRO_GENERICO };
  if (!data.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidatePath("/", "layout");
  return {
    ok: true,
    aviso: ativo
      ? `${data[0].nome} ativado. O portal já aparece no hub.`
      : `${data[0].nome} desativado. Portal e painel fechados até reativar.`,
  };
}

const esquemaAdmin = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Informe um e-mail válido." }).max(254)),
});

/** Concede acesso de administrador a uma conta que já existe (contas novas entram por convite). */
export async function concederAdmin(_: Estado, dados: FormData): Promise<Estado> {
  const ctx = await exigirAdmin();
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  const entrada = Object.fromEntries([...dados.entries()].filter(([k]) => !k.startsWith("$ACTION")).map(([k, v]) => [k, String(v)]));
  const r = esquemaAdmin.safeParse(entrada);
  if (!r.success) return { ok: false, erro: "Informe o e-mail de uma conta que já existe.", campos: { email: "E-mail inválido." }, valores: { email: entrada.email ?? "" } };

  const supabase = await criarClienteServidor();
  const { data: userId, error: erroBusca } = await supabase.rpc("usuario_por_email", { p_email: r.data.email });
  if (erroBusca) return { ok: false, erro: SEM_PERMISSAO };
  if (!userId) {
    return {
      ok: false,
      erro: "Não há conta com esse e-mail. Convide a pessoa para a equipe de um município primeiro, ou use o script criar-admin.",
      valores: { email: r.data.email },
    };
  }
  if (userId === ctx.userId) return { ok: false, erro: "Ninguém altera o próprio perfil administrativo." };
  const { data, error } = await supabase.from("perfis").update({ admin_assessoria: true }).eq("user_id", userId).select("user_id");
  if (error || !data.length) return { ok: false, erro: error?.code === "42501" ? SEM_PERMISSAO : ERRO_GENERICO };
  revalidatePath("/admin/assessoria");
  return { ok: true, aviso: `${r.data.email} agora é administrador da assessoria.` };
}

export async function removerAdmin(userId: string): Promise<ResultadoAcao> {
  const ctx = await exigirAdmin();
  if (!ctx || !z.uuid().safeParse(userId).success) return { ok: false, erro: SEM_PERMISSAO };
  if (userId === ctx.userId) return { ok: false, erro: "Ninguém altera o próprio perfil administrativo." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("perfis").update({ admin_assessoria: false }).eq("user_id", userId).select("user_id");
  if (error || !data.length) return { ok: false, erro: ERRO_GENERICO };
  revalidatePath("/admin/assessoria");
  return { ok: true, aviso: "Acesso de administrador removido." };
}
