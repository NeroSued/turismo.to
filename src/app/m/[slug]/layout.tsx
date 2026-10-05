import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { corMunicipalAceita, COR_MUNICIPAL_PADRAO } from "@/lib/cores";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

export async function generateMetadata({ params }: LayoutProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  if (!m) return {};
  const nome = m.configuracoes_municipio?.nome_exibicao ?? m.nome;
  return {
    title: { default: `Turismo em ${nome}`, template: `%s · Turismo em ${nome}` },
    description: `Atrativos, eventos e atividades gratuitas de ${nome}, Tocantins.`,
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
    <div className="flex flex-1 flex-col" style={{ "--cor-municipal": corSegura } as React.CSSProperties}>
      {children}
    </div>
  );
}
