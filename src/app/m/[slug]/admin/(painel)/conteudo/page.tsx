import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { contarConteudo } from "@/lib/cadastros/dados";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Conteúdo" };

/** Conteúdo do portal: atrativos, eventos e atividades, prestadores (SPEC 7). */
export default async function Conteudo({ params }: PageProps<"/m/[slug]/admin/conteudo">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const n = await contarConteudo(municipio.id);
  const secoes = [
    { href: "/admin/atrativos", titulo: "Atrativos", texto: "Lugares para visitar, com fotos, horários e orientações.", c: n.atrativos },
    { href: "/admin/eventos", titulo: "Eventos", texto: "Festas, feiras e festivais do calendário.", c: n.eventos },
    { href: "/admin/atividades", titulo: "Atividades com voucher", texto: "Reservas gratuitas e registros voluntários.", c: n.atividades },
    { href: "/admin/prestadores", titulo: "Prestadores", texto: "Rede municipal: hospedagem, alimentação, guias e outros.", c: n.prestadores },
  ];
  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Conteúdo do portal</h1>
      <p className="text-muted-foreground">
        Tudo começa em elaboração e só aparece no portal depois de publicado. Arquivar tira do portal sem apagar.
      </p>
      <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
        {secoes.map((s) => (
          <li key={s.href} className="border-b last:border-b-0">
            <Link href={s.href} className="flex min-h-[72px] items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[17px] font-bold">{s.titulo}</span>
                <span className="text-sm text-muted-foreground">{s.texto}</span>
                <span className="text-sm font-bold text-primary">
                  {s.c.total === 0
                    ? "Nenhum cadastro ainda"
                    : `${s.c.publicados} publicados · ${s.c.rascunhos} em elaboração`}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Pagina>
  );
}
