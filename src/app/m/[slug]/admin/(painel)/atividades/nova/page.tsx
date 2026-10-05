import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { FormularioNovaAtividade } from "@/components/painel/atividades";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Nova atividade" };

export default async function NovaAtividade({ params }: PageProps<"/m/[slug]/admin/atividades/nova">) {
  const { slug } = await params;
  await exigirPainel(slug, ["gestor"]);
  return (
    <Pagina className="pt-2">
      <Link href="/admin/atividades" className="flex min-h-11 w-fit items-center gap-1.5 font-bold">
        <ArrowLeft aria-hidden="true" className="size-5" /> Atividades
      </Link>
      <h1 className="text-[26px] font-bold">Nova atividade</h1>
      <FormularioNovaAtividade />
    </Pagina>
  );
}
