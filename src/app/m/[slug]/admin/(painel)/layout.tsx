import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagina } from "@/components/pagina";
import { NavegacaoPainel } from "@/components/painel/navegacao";
import type { Papel } from "@/lib/auth/acesso";
import { sair } from "@/lib/auth/acoes";
import { contextoDoSlug } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Assessoria",
  gestor: "Gestor",
  operador: "Operador",
};

/** Todo o painel exige sessão e vínculo ativo com o município do recurso. */
export default async function LayoutPainel({ params, children }: LayoutProps<"/m/[slug]/admin">) {
  const { slug } = await params;
  const { municipio, acesso } = await contextoDoSlug(slug);
  if (acesso.status === "anonimo") redirect("/admin/login");

  if (acesso.status === "sem_acesso") {
    return (
      <Pagina>
        <h1 className="text-[30px] leading-tight font-bold">Sem acesso a este painel</h1>
        <p>
          A conta {acesso.email ? <strong>{acesso.email}</strong> : null} não tem vínculo com {municipio.nome}.
        </p>
        <p className="text-muted-foreground">
          Se você trabalha na prefeitura de {municipio.nome}, peça à assessoria para liberar o seu acesso.
          Se entrou no município errado, saia e acesse o portal do seu município.
        </p>
        <form action={sair}>
          <Button type="submit" size="lg" variant="outline" className="w-full">
            Sair desta conta
          </Button>
        </form>
      </Pagina>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-[88px] print:pb-0">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 print:hidden">
        <div className="flex flex-col leading-tight">
          <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">
            Painel · {ROTULO_PAPEL[acesso.papel]}
          </span>
          <span className="font-heading text-xl font-bold">{municipio.nome}</span>
        </div>
        <form action={sair}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
      <NavegacaoPainel papel={acesso.papel} />
    </div>
  );
}
