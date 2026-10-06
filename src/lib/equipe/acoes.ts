"use server";

import { revalidatePath } from "next/cache";
import { errosPorCampo } from "@/lib/atividades/esquemas";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { urlDoMunicipio } from "@/lib/municipio/resolver";
import { contextoDoMunicipio, SEM_PERMISSAO, type ResultadoAcao } from "@/lib/painel/contexto";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { contaParaConvite } from "./convite";
import { esquemaAlteracaoVinculo, esquemaConvite, ROTULO_PAPEL_EQUIPE } from "./esquemas";

// Equipe do município (item 4.2). Autorização pelo município do RECURSO (campo municipio_id),
// nunca pelo host: o gestor só gerencia onde é gestor; o admin, em qualquer município.
// A RLS de vinculos confere tudo de novo, inclusive "ninguém altera o próprio vínculo".

type Estado = ResultadoAcao | undefined;
const ERRO_GENERICO = "Não foi possível salvar agora. Confira a conexão e tente de novo.";
const PROPRIO_ACESSO = "Ninguém altera o próprio acesso. Peça a outro gestor ou à assessoria.";

/** Campos enviados pelo formulário, sem os campos internos do React/Next. */
function camposDoFormulario(dados: FormData): Record<string, string> {
  return Object.fromEntries(
    [...dados.entries()].filter(([k]) => !k.startsWith("$ACTION")).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
}

function revalidarEquipe() {
  revalidatePath("/admin/equipe");
  revalidatePath("/admin/assessoria", "layout");
}

export async function convidarParaEquipe(_: Estado, dados: FormData): Promise<Estado> {
  const entrada = camposDoFormulario(dados);
  const valores = { email: entrada.email ?? "", nome: entrada.nome ?? "", papel: entrada.papel ?? "" };
  const r = esquemaConvite.safeParse(entrada);
  if (!r.success) {
    const extras = r.error.issues.some((i) => i.code === "unrecognized_keys") || !entrada.municipio_id;
    if (extras) return { ok: false, erro: SEM_PERMISSAO };
    return { ok: false, erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error), valores };
  }

  // 1. Quem pede: gestor do município do convite (ou admin), conferido com a sessão dele.
  const ctx = await contextoDoMunicipio(r.data.municipio_id, ["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };
  if (ctx.email && ctx.email.toLowerCase() === r.data.email) return { ok: false, erro: PROPRIO_ACESSO, valores };

  // 2. Conta da pessoa (operação privilegiada D8.4): existente ou criada por convite do Auth.
  const { NEXT_PUBLIC_ROOT_DOMAIN: raiz } = envPublico();
  const base = urlDoMunicipio(ctx.municipio.slug, raiz, overrideDeMunicipioPermitido());
  const destino = new URL("/auth/confirm?next=/conta/nova-senha", base.startsWith("http") ? base : `https://${raiz}`).toString();
  const conta = await contaParaConvite(r.data.email, r.data.nome, destino);
  if (!conta.ok) return { ok: false, erro: "Não foi possível enviar o convite agora. Tente de novo em alguns minutos.", valores };

  // 3. Vínculo gravado com a sessão de quem convidou (RLS).
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("vinculos")
    .insert({ user_id: conta.userId, municipio_id: ctx.municipio.id, papel: r.data.papel });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, erro: "Essa pessoa já faz parte da equipe deste município. Altere o papel ou reative na lista.", valores };
    }
    if (error.code === "42501") return { ok: false, erro: SEM_PERMISSAO };
    return { ok: false, erro: ERRO_GENERICO, valores };
  }
  revalidarEquipe();
  return {
    ok: true,
    aviso: conta.nova
      ? `Convite enviado para ${r.data.email} como ${ROTULO_PAPEL_EQUIPE[r.data.papel].toLowerCase()}.`
      : `${r.data.email} já tinha conta e agora é ${ROTULO_PAPEL_EQUIPE[r.data.papel].toLowerCase()}.`,
  };
}

export async function alterarVinculo(entrada: {
  municipio_id: string;
  vinculo_id: string;
  papel?: string;
  ativo?: boolean;
}): Promise<ResultadoAcao> {
  const r = esquemaAlteracaoVinculo.safeParse(entrada);
  if (!r.success || (r.data.papel === undefined && r.data.ativo === undefined)) return { ok: false, erro: SEM_PERMISSAO };
  const ctx = await contextoDoMunicipio(r.data.municipio_id, ["gestor"]);
  if (!ctx) return { ok: false, erro: SEM_PERMISSAO };

  const supabase = await criarClienteServidor();
  const { data: atual } = await supabase
    .from("vinculos")
    .select("user_id")
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", r.data.vinculo_id)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Pessoa não encontrada na equipe deste município." };
  if (atual.user_id === ctx.userId) return { ok: false, erro: PROPRIO_ACESSO };

  const mudanca = { ...(r.data.papel ? { papel: r.data.papel } : {}), ...(r.data.ativo !== undefined ? { ativo: r.data.ativo } : {}) };
  const { data, error } = await supabase
    .from("vinculos")
    .update(mudanca)
    .eq("municipio_id", ctx.municipio.id)
    .eq("id", r.data.vinculo_id)
    .select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : ERRO_GENERICO };
  if (!data.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidarEquipe();
  if (r.data.ativo === false) return { ok: true, aviso: "Acesso desativado neste município." };
  if (r.data.ativo === true) return { ok: true, aviso: "Acesso reativado." };
  return { ok: true, aviso: `Papel alterado para ${ROTULO_PAPEL_EQUIPE[r.data.papel!].toLowerCase()}.` };
}
