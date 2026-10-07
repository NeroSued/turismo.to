import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { FormularioNovoCadastro } from "@/components/painel/cadastros";
import { Voltar } from "@/components/painel/telas-cadastro";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Novo prestador" };

export default async function NovoPrestador({ params }: PageProps<"/m/[slug]/admin/prestadores/novo">) {
  const { slug } = await params;
  await exigirPainel(slug, ["gestor"]);
  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/prestadores" rotulo="Prestadores" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-bold">Novo prestador</h1>
        <p className="text-muted-foreground">Depois de salvar, você poderá adicionar fotos.</p>
      </div>
      <FormularioNovoCadastro tipo="prestadores" valores={{ situacao_rede: "em_adesao" }} />
    </Pagina>
  );
}
