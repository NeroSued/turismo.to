import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type Papel = "admin" | "gestor" | "operador";

export type Acesso =
  | { status: "anonimo" }
  | { status: "sem_acesso"; email: string | null }
  | { status: "ok"; userId: string; email: string | null; papel: Papel; nome: string | null };

/**
 * Acesso do usuário da sessão ao município. Lido das tabelas perfis e vinculos
 * (via RLS, que só mostra as linhas do próprio usuário), nunca de metadados.
 * O município do host não autoriza nada: quem chama passa o id do recurso.
 */
export async function acessoAoMunicipio(municipioId: string): Promise<Acesso> {
  const supabase = await criarClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { status: "anonimo" };
  const email = typeof claims.claims.email === "string" ? claims.claims.email : null;

  const [perfil, vinculo] = await Promise.all([
    supabase.from("perfis").select("nome, admin_assessoria").eq("user_id", userId).maybeSingle(),
    supabase
      .from("vinculos")
      .select("papel")
      .eq("user_id", userId)
      .eq("municipio_id", municipioId)
      .eq("ativo", true)
      .maybeSingle(),
  ]);
  if (perfil.error) throw new Error(`Falha ao ler o perfil: ${perfil.error.message}`);
  if (vinculo.error) throw new Error(`Falha ao ler o vínculo: ${vinculo.error.message}`);

  const p = z.object({ nome: z.string().nullable(), admin_assessoria: z.boolean() }).nullable().parse(perfil.data);
  const v = z.object({ papel: z.enum(["gestor", "operador"]) }).nullable().parse(vinculo.data);

  if (p?.admin_assessoria) return { status: "ok", userId, email, papel: "admin", nome: p.nome };
  if (v) return { status: "ok", userId, email, papel: v.papel, nome: p?.nome ?? null };
  return { status: "sem_acesso", email };
}

export async function usuarioLogado(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}
