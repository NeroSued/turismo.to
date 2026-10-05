import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { ListaCadastros } from "@/components/painel/telas-cadastro";
import { listarAtrativos } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO } from "@/lib/cadastros/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Atrativos" };

export default async function Atrativos({ params }: PageProps<"/m/[slug]/admin/atrativos">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const itens = await listarAtrativos(municipio.id);
  return (
    <Pagina className="pt-2">
      <ListaCadastros
        tipo="atrativos"
        itens={itens.map((a) => ({ id: a.id, titulo: a.nome, status: a.status, detalhe: CATEGORIAS_ATRATIVO[a.categoria] }))}
      />
    </Pagina>
  );
}
