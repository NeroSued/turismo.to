import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { EnviarImagemMunicipio, FormularioConfiguracoes } from "@/components/painel/configuracoes";
import { Voltar } from "@/components/painel/telas-cadastro";
import { urlPublica } from "@/lib/arquivos/url";
import { COR_MUNICIPAL_PADRAO } from "@/lib/cores";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Configurações" };

/** Configurações do município (item 2.4): identidade, contato, Ouvidoria, privacidade e ICMS Ecológico. */
export default async function Configuracoes({ params }: PageProps<"/m/[slug]/admin/configuracoes">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const c = municipio.configuracoes_municipio;

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/mais" rotulo="Mais" />
      <h1 className="text-[26px] font-bold">Configurações</h1>
      <p className="text-muted-foreground">Dados do portal de {municipio.nome}. Tudo aqui aparece para o público.</p>
      <FormularioConfiguracoes
        nomeOficial={municipio.nome}
        v={{
          nome_exibicao: c?.nome_exibicao ?? null,
          cor_primaria: c?.cor_primaria ?? COR_MUNICIPAL_PADRAO,
          contato_secretaria: c?.contato_secretaria ?? null,
          ouvidoria_url: c?.ouvidoria_url ?? null,
          aviso_privacidade: c?.aviso_privacidade ?? null,
          referencia_icms: c?.referencia_icms ?? "item 6.1.4",
        }}
      />
      <section aria-labelledby="imagens" className="flex flex-col gap-3">
        <h2 id="imagens" className="text-xl font-bold">Imagens oficiais</h2>
        <p className="text-muted-foreground">Use apenas logo e fotos oficiais ou cedidas pela prefeitura.</p>
        <EnviarImagemMunicipio
          qual="logo"
          rotulo="Logo"
          url={c?.logo_caminho ? urlPublica(c.logo_caminho) : null}
          ajuda="Aparece no topo do portal, em 40 por 40 pixels."
        />
        <EnviarImagemMunicipio
          qual="capa"
          rotulo="Foto de capa"
          url={c?.capa_caminho ? urlPublica(c.capa_caminho) : null}
          ajuda="Foto horizontal do topo do portal e da prévia em redes sociais."
        />
      </section>
    </Pagina>
  );
}
