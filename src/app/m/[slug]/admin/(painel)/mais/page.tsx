import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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
      {papel !== "operador" ? (
        <nav aria-label="Mais opções do painel">
          <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
            {[
              { href: "/admin/configuracoes", titulo: "Configurações", texto: "Nome, logo, cor, contato, Ouvidoria e privacidade." },
              { href: "/admin/conteudo", titulo: "Conteúdo do portal", texto: "Atrativos, eventos, atividades e prestadores." },
            ].map((l) => (
              <li key={l.href} className="border-b last:border-b-0">
                <Link href={l.href} className="flex min-h-16 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background">
                  <span className="flex flex-1 flex-col">
                    <span className="font-bold">{l.titulo}</span>
                    <span className="text-sm text-muted-foreground">{l.texto}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <h2 className="text-[22px] font-bold">Sua conta</h2>
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
