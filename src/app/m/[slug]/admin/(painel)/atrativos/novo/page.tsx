import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { FormularioNovoCadastro } from "@/components/painel/cadastros";
import { Voltar } from "@/components/painel/telas-cadastro";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Novo atrativo" };

export default async function NovoAtrativo({ params }: PageProps<"/m/[slug]/admin/atrativos/novo">) {
  const { slug } = await params;
  await exigirPainel(slug, ["gestor"]);
  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/atrativos" rotulo="Atrativos" />
      <h1 className="text-[26px] font-bold">Novo atrativo</h1>
      <FormularioNovoCadastro tipo="atrativos" />
    </Pagina>
  );
}
