import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { ConteudoConfiguracoes } from "@/components/painel/tela-configuracoes";
import { Voltar } from "@/components/painel/telas-cadastro";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Configurações" };

/** Configurações do município (item 2.4): identidade, contato, Ouvidoria, privacidade e ICMS Ecológico. */
export default async function Configuracoes({ params }: PageProps<"/m/[slug]/admin/configuracoes">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/mais" rotulo="Mais" />
      <h1 className="text-[26px] font-bold">Configurações</h1>
      <p className="text-muted-foreground">Dados do portal de {municipio.nome}. Tudo aqui aparece para o público.</p>
      <ConteudoConfiguracoes municipio={municipio} />
    </Pagina>
  );
}
