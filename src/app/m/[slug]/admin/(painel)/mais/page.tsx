import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { sair } from "@/lib/auth/acoes";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Mais" };

const PAPEL = { admin: "Administrador da assessoria", gestor: "Gestor municipal", operador: "Operador" } as const;

export default async function Mais({ params }: PageProps<"/m/[slug]/admin/mais">) {
  const { slug } = await params;
  const { municipio, papel, nome, email } = await exigirPainel(slug);
  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Sua conta</h1>
      <dl className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
        <div>
          <dt className="text-[13px] text-muted-foreground">Nome</dt>
          <dd className="font-bold">{nome ?? "[Nome não informado]"}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">E-mail</dt>
          <dd className="font-bold break-all">{email}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Papel</dt>
          <dd className="font-bold">
            {PAPEL[papel]} · {municipio.nome}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Para mudar de papel ou de município, fale com a assessoria. Ninguém altera o próprio acesso.
      </p>
      <form action={sair}>
        <Button type="submit" size="lg" variant="outline" className="w-full">
          Sair desta conta
        </Button>
      </form>
    </Pagina>
  );
}
