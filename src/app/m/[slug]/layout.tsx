import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { urlPublica } from "@/lib/arquivos/url";
import { corMunicipalAceita, COR_MUNICIPAL_PADRAO } from "@/lib/cores";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

/** Título, descrição e Open Graph de cada município (item 2.6). URLs absolutas pelo host da requisição. */
export async function generateMetadata({ params }: LayoutProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  if (!m) return {};
  const nome = m.configuracoes_municipio?.nome_exibicao ?? m.nome;
  const titulo = `Turismo em ${nome}`;
  const descricao = `Atrativos, eventos e atividades gratuitas de ${nome}, Tocantins, com reserva gratuita pelo celular.`;
  const capa = m.configuracoes_municipio?.capa_caminho;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  return {
    metadataBase: host ? new URL(`${protocolo}://${host}`) : undefined,
    title: { absolute: titulo, template: `%s · ${titulo}` },
    description: descricao,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: titulo,
      title: titulo,
      description: descricao,
      images: capa ? [{ url: urlPublica(capa), alt: `Foto de ${nome}` }] : undefined,
    },
    twitter: { card: capa ? "summary_large_image" : "summary" },
  };
}

/** Tudo sob /m/<slug> vem da reescrita do proxy. Slug inexistente ou inativo: 404. */
export default async function LayoutMunicipio({ params, children }: LayoutProps<"/m/[slug]">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();

  const cor = municipio.configuracoes_municipio?.cor_primaria ?? COR_MUNICIPAL_PADRAO;
  const corSegura = corMunicipalAceita(cor) ? cor : COR_MUNICIPAL_PADRAO;

  return (
    // --primary e --secondary-foreground são calculadas no :root a partir de --cor-municipal e herdadas
    // já resolvidas; por isso são redefinidas aqui junto com ela.
    <div
      className="flex flex-1 flex-col"
      style={{ "--cor-municipal": corSegura, "--primary": corSegura, "--secondary-foreground": corSegura } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
