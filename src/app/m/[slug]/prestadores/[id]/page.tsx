import { MapPin, MessageCircle, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapaDetalhe, FaixaFotos, fotosDaGaleria, Paragrafos } from "@/components/portal/detalhe";
import { nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { GaleriaProvider } from "@/components/portal/galeria";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarPrestador, listarFotos } from "@/lib/cadastros/dados";
import { CATEGORIAS_PRESTADOR } from "@/lib/cadastros/esquemas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { resumo } from "@/lib/portal/metadados";

async function carregar(slug: string, id: string) {
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) return null;
  // Rascunho, arquivado ou desligado da rede: 404, como na lista pública.
  const prestador = await buscarPrestador(municipio.id, id, { publicado: true });
  return prestador ? { municipio, prestador } : null;
}

export async function generateMetadata({ params }: PageProps<"/m/[slug]/prestadores/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) return {};
  const [foto] = await listarFotos(d.municipio.id, "prestador_id", [d.prestador.id]);
  const p = d.prestador;
  const descricao = resumo(p.descricao) ?? `${CATEGORIAS_PRESTADOR[p.categoria]} da rede municipal de turismo de ${nomeDoMunicipio(d.municipio)}, Tocantins.`;
  return {
    title: p.nome_publico,
    description: descricao,
    openGraph: {
      title: p.nome_publico,
      description: descricao,
      images: foto ? [{ url: urlPublica(foto.caminho), alt: textoAlternativo(foto.legenda, 0, p.nome_publico) }] : undefined,
    },
  };
}

function Linha({ icone: Icone, titulo, children }: { icone: typeof MapPin; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[#E4E7E0] px-3.5 py-3 last:border-b-0">
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col">
        <dt className="text-[13px] text-muted-foreground">{titulo}</dt>
        <dd className="font-bold whitespace-pre-line">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Detalhe público do prestador: só o que é público (nome, categoria, descrição, serviços,
 * contatos autorizados e localização). Adesão, responsável e contato interno nunca entram aqui.
 */
export default async function PrestadorPublico({ params }: PageProps<"/m/[slug]/prestadores/[id]">) {
  const { slug, id } = await params;
  const d = await carregar(slug, id);
  if (!d) notFound();
  const { municipio, prestador: p } = d;
  const fotos = await listarFotos(municipio.id, "prestador_id", [p.id]);
  const temInfo = Boolean(p.servicos || p.contatos_publicos || p.localizacao);

  return (
    <GaleriaProvider fotos={fotosDaGaleria(fotos, p.nome_publico)} nome={p.nome_publico}>
      <CapaDetalhe fotos={fotos} nome={p.nome_publico} voltar="/prestadores" rotuloVoltar="Voltar à rede de prestadores" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 pt-[18px] pb-10">
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">{CATEGORIAS_PRESTADOR[p.categoria]}</span>
            {p.situacao_rede === "em_adesao" ? (
              <span className="rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">Em adesão à rede</span>
            ) : null}
          </span>
          <h1 className="text-[32px] leading-[1.05] font-bold tracking-[-0.015em]">{p.nome_publico}</h1>
          <p className="text-[15px] text-muted-foreground">Rede municipal de turismo de {nomeDoMunicipio(municipio)}</p>
        </div>
        {temInfo ? (
          <dl className="-mt-3 overflow-hidden rounded-2xl border bg-superficie">
            {p.servicos ? <Linha icone={Wrench} titulo="Serviços">{p.servicos}</Linha> : null}
            {p.contatos_publicos ? <Linha icone={MessageCircle} titulo="Contato">{p.contatos_publicos}</Linha> : null}
            {p.localizacao ? <Linha icone={MapPin} titulo="Localização">{p.localizacao}</Linha> : null}
          </dl>
        ) : null}
        {p.descricao ? (
          <section aria-labelledby="sobre" className="flex flex-col gap-2">
            <h2 id="sobre" className="text-[21px] font-bold">Sobre</h2>
            <Paragrafos texto={p.descricao} />
          </section>
        ) : null}
        <FaixaFotos fotos={fotos} nome={p.nome_publico} />
      </main>
      <RodapePortal municipio={municipio} />
    </GaleriaProvider>
  );
}
