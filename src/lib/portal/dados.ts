import "server-only";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/servidor";

// Consultas do portal público: sempre só o publicado (a RLS já garante para o anônimo;
// o filtro explícito mantém o portal igual para um membro logado).

const esquemaAtividadePortal = z.object({
  id: z.uuid(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  local_encontro: z.string().nullable(),
  modo: z.enum(["reserva", "registro_voluntario"]),
  atrativo_id: z.uuid().nullable(),
});

export type AtividadePortal = z.infer<typeof esquemaAtividadePortal>;

export async function atividadesPublicadas(municipioId: string) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("atividades")
    .select("id, titulo, descricao, local_encontro, modo, atrativo_id")
    .eq("municipio_id", municipioId)
    .eq("status", "publicado")
    .order("titulo");
  if (error) throw new Error(`Falha ao listar atividades: ${error.message}`);
  return z.array(esquemaAtividadePortal).parse(data);
}

/** Próximo horário aberto de cada atividade de reserva (e quantas vagas restam nele). */
export async function proximosHorarios(municipioId: string) {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("sessoes")
    .select("atividade_id, inicio, capacidade_pessoas, pessoas_reservadas")
    .eq("municipio_id", municipioId)
    .eq("ativa", true)
    .gt("inicio", new Date().toISOString())
    .order("inicio")
    .limit(500);
  if (error) throw new Error(`Falha ao listar horários: ${error.message}`);
  const linhas = z
    .array(z.object({ atividade_id: z.uuid(), inicio: z.string(), capacidade_pessoas: z.number().nullable(), pessoas_reservadas: z.number() }))
    .parse(data);
  const mapa = new Map<string, { inicio: string; restantes: number | null }>();
  for (const s of linhas) {
    const restantes = s.capacidade_pessoas === null ? null : s.capacidade_pessoas - s.pessoas_reservadas;
    if (!mapa.has(s.atividade_id) && (restantes === null || restantes > 0)) mapa.set(s.atividade_id, { inicio: s.inicio, restantes });
  }
  return mapa;
}
