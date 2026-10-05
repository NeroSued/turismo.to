import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { ListaCadastros } from "@/components/painel/telas-cadastro";
import { listarPrestadores } from "@/lib/cadastros/dados";
import { CATEGORIAS_PRESTADOR, SITUACOES_REDE } from "@/lib/cadastros/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Prestadores" };

export default async function Prestadores({ params }: PageProps<"/m/[slug]/admin/prestadores">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const itens = await listarPrestadores(municipio.id);
  return (
    <Pagina className="pt-2">
      <ListaCadastros
        tipo="prestadores"
        itens={itens.map((p) => ({
          id: p.id,
          titulo: p.nome_publico,
          status: p.status,
          detalhe: `${CATEGORIAS_PRESTADOR[p.categoria]} · ${SITUACOES_REDE[p.situacao_rede]}`,
        }))}
      />
    </Pagina>
  );
}
