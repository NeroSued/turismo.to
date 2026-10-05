import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioNovaSenha } from "@/components/auth/formularios";
import { Pagina } from "@/components/pagina";
import { usuarioLogado } from "@/lib/auth/acesso";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function NovaSenha() {
  // Chega-se aqui pelo link do e-mail (convite ou recuperação), que já abre a sessão.
  if (!(await usuarioLogado())) redirect("/admin/recuperar");
  return (
    <Pagina>
      <h1 className="text-[30px] leading-tight font-bold">Criar nova senha</h1>
      <p className="text-muted-foreground">Escolha uma senha só sua. Ela não deve ser compartilhada com a equipe.</p>
      <FormularioNovaSenha />
    </Pagina>
  );
}
