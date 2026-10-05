import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { PAPEIS_EQUIPE } from "./esquemas";

const esquemaMembro = z.object({
  vinculo_id: z.uuid(),
  user_id: z.uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  papel: z.enum(PAPEIS_EQUIPE),
  ativo: z.boolean(),
  convite_pendente: z.boolean(),
  criado_em: z.string(),
});

export type MembroEquipe = z.infer<typeof esquemaMembro>;

/** Equipe do município com a sessão do usuário: a função recusa quem não é gestor dele (nem admin). */
export async function listarEquipe(municipioId: string): Promise<MembroEquipe[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("equipe_do_municipio", { p_municipio_id: municipioId });
  if (error) throw new Error(`Falha ao carregar a equipe: ${error.message}`);
  return z.array(esquemaMembro).parse(data);
}

const esquemaAdmin = z.object({ user_id: z.uuid(), nome: z.string().nullable(), email: z.string() });

/** Administradores da assessoria (só o admin lê). */
export async function listarAdmins() {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("admins_assessoria");
  if (error) throw new Error(`Falha ao carregar os administradores: ${error.message}`);
  return z.array(esquemaAdmin).parse(data);
}
