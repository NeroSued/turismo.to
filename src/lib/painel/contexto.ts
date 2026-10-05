import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { acessoAoMunicipio, type Papel } from "@/lib/auth/acesso";
import { buscarMunicipioPorSlug, type Municipio } from "@/lib/municipio/dados";
import { municipioDaRequisicao } from "@/lib/municipio/atual";

export type ContextoPainel = {
  municipio: Municipio;
  userId: string;
  papel: Papel;
  nome: string | null;
  email: string | null;
};

/** Município da URL + acesso do usuário. Uma consulta por requisição (cache do React). */
export const contextoDoSlug = cache(async (slug: string) => {
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  return { municipio, acesso: await acessoAoMunicipio(municipio.id) };
});

/**
 * Para páginas do painel: exige sessão e vínculo com o município (o layout já mostra
 * "sem acesso"); com `papeis`, também exige um dos papéis (o admin passa sempre).
 */
export async function exigirPainel(slug: string, papeis?: Papel[]): Promise<ContextoPainel> {
  const { municipio, acesso } = await contextoDoSlug(slug);
  if (acesso.status === "anonimo") redirect("/admin/login");
  if (acesso.status !== "ok") notFound();
  if (papeis && acesso.papel !== "admin" && !papeis.includes(acesso.papel)) redirect("/admin");
  return { municipio, userId: acesso.userId, papel: acesso.papel, nome: acesso.nome, email: acesso.email };
}

export type ResultadoAcao<T = undefined> =
  | { ok: true; dados?: T; aviso?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

/**
 * Para server actions: município pelo host da requisição e papel do usuário nele.
 * Devolve null quando não há permissão (a action responde com erro, sem detalhes).
 */
export async function contextoDaAcao(papeis: Papel[]): Promise<ContextoPainel | null> {
  const municipio = await municipioDaRequisicao();
  if (!municipio) return null;
  const acesso = await acessoAoMunicipio(municipio.id);
  if (acesso.status !== "ok") return null;
  if (acesso.papel !== "admin" && !papeis.includes(acesso.papel)) return null;
  return { municipio, userId: acesso.userId, papel: acesso.papel, nome: acesso.nome, email: acesso.email };
}

export const SEM_PERMISSAO = "Sua conta não tem permissão para esta ação neste município. Entre de novo ou fale com a assessoria.";
