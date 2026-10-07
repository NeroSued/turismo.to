import { EnviarImagemMunicipio, FormularioConfiguracoes } from "@/components/painel/configuracoes";
import { urlPublica } from "@/lib/arquivos/url";
import { COR_MUNICIPAL_PADRAO } from "@/lib/cores";
import type { Municipio } from "@/lib/municipio/dados";

/** Formulário e imagens oficiais do município (item 2.4), usado pelo gestor e pela assessoria (item 4.1). */
export function ConteudoConfiguracoes({ municipio }: { municipio: Municipio }) {
  const c = municipio.configuracoes_municipio;
  return (
    <>
      <FormularioConfiguracoes
        municipioId={municipio.id}
        nomeOficial={municipio.nome}
        v={{
          nome_exibicao: c?.nome_exibicao ?? null,
          cor_primaria: c?.cor_primaria ?? COR_MUNICIPAL_PADRAO,
          apresentacao: c?.apresentacao ?? null,
          contato_secretaria: c?.contato_secretaria ?? null,
          ouvidoria_url: c?.ouvidoria_url ?? null,
          aviso_privacidade: c?.aviso_privacidade ?? null,
          referencia_icms: c?.referencia_icms ?? "item 6.1.4",
          dias_anonimizacao: c?.dias_anonimizacao ?? 90,
        }}
      />
      <section aria-labelledby="imagens" className="flex flex-col gap-3">
        <h2 id="imagens" className="text-xl font-bold">Imagens oficiais</h2>
        <p className="text-muted-foreground">Use apenas logo e fotos oficiais ou cedidas pela prefeitura.</p>
        <EnviarImagemMunicipio
          municipioId={municipio.id}
          qual="logo"
          rotulo="Logo"
          url={c?.logo_caminho ? urlPublica(c.logo_caminho) : null}
          ajuda="Aparece no topo do portal, em 40 por 40 pixels."
        />
        <EnviarImagemMunicipio
          municipioId={municipio.id}
          qual="capa"
          rotulo="Foto de capa"
          url={c?.capa_caminho ? urlPublica(c.capa_caminho) : null}
          ajuda="Foto horizontal do topo do portal e da prévia em redes sociais."
        />
      </section>
    </>
  );
}
