import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormularioEntrar } from "@/components/auth/formularios";
import { Pagina } from "@/components/pagina";
import { usuarioLogado } from "@/lib/auth/acesso";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function Login({ params }: PageProps<"/m/[slug]/admin/login">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  if (await usuarioLogado()) redirect("/admin");

  return (
    <Pagina>
      <div className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Painel municipal</span>
        <h1 className="text-[30px] leading-tight font-bold">{municipio.nome}</h1>
      </div>
      <p className="text-muted-foreground">
        Acesso para a equipe da prefeitura. Visitantes não precisam de conta para reservar atividades.
      </p>
      <FormularioEntrar />
      <Link href="/admin/recuperar" className="flex min-h-11 items-center font-bold">
        Esqueci minha senha
      </Link>
      <p className="text-sm text-muted-foreground">
        Não tem conta? O acesso é criado por convite da assessoria. Fale com a Secretaria de Turismo.
      </p>
    </Pagina>
  );
}
