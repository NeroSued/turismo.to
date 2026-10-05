import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperar } from "@/components/auth/formularios";
import { Pagina } from "@/components/pagina";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function Recuperar() {
  return (
    <Pagina>
      <h1 className="text-[30px] leading-tight font-bold">Recuperar senha</h1>
      <p className="text-muted-foreground">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
      </p>
      <FormularioRecuperar />
      <Link href="/admin/login" className="flex min-h-11 items-center font-bold">
        Voltar para o login
      </Link>
    </Pagina>
  );
}
