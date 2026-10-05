"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { overrideDeMunicipioPermitido } from "@/lib/env";
import { COOKIE_MUNICIPIO, slugDoHost } from "@/lib/municipio/resolver";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoFormulario = { erro?: string; aviso?: string } | undefined;

const esquemaEntrar = z.object({
  email: z.email().max(254),
  senha: z.string().min(1).max(200),
});

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const r = esquemaEntrar.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  if (!r.success) return { erro: "Informe um e-mail válido e a senha." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.senha });
  if (error) {
    if (error.status === 429) {
      return { erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." };
    }
    return { erro: "E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”." };
  }
  redirect("/admin");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const esquemaRecuperar = z.object({ email: z.email().max(254) });

export async function recuperarSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const r = esquemaRecuperar.safeParse({ email: dados.get("email") });
  if (!r.success) return { erro: "Informe um e-mail válido." };

  const supabase = await criarClienteServidor();
  const destino = `${await origemDaRequisicao()}/auth/confirm?next=/conta/nova-senha`;
  const { error } = await supabase.auth.resetPasswordForEmail(r.data.email, { redirectTo: destino });
  if (error?.status === 429) {
    return { erro: "Muitas solicitações seguidas. Aguarde alguns minutos e tente de novo." };
  }
  // Mesma resposta exista ou não a conta, para não revelar quem tem cadastro.
  return {
    aviso:
      "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.",
  };
}

const esquemaNovaSenha = z
  .object({ senha: z.string().min(10).max(200), confirmacao: z.string() })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem." });

export async function definirNovaSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const r = esquemaNovaSenha.safeParse({ senha: dados.get("senha"), confirmacao: dados.get("confirmacao") });
  if (!r.success) {
    const conferem = r.error.issues.some((i) => i.message === "As senhas não conferem.");
    return {
      erro: conferem
        ? "As duas senhas não conferem. Digite a mesma senha nos dois campos."
        : "A senha precisa ter pelo menos 10 caracteres.",
    };
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { erro: "O link expirou. Peça um novo em “Esqueci minha senha”." };
  }
  const { error } = await supabase.auth.updateUser({ password: r.data.senha });
  if (error) {
    return { erro: "Não foi possível salvar a senha. Use uma senha diferente da anterior e tente de novo." };
  }
  // No subdomínio de um município, segue para o painel; no domínio raiz, para o hub.
  const h = await headers();
  const noMunicipio =
    slugDoHost(h.get("host"), process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "") !== null ||
    (overrideDeMunicipioPermitido() && Boolean((await cookies()).get(COOKIE_MUNICIPIO)?.value));
  redirect(noMunicipio ? "/admin" : "/");
}
