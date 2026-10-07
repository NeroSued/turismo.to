import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPortal, CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { listarAtrativos, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO } from "@/lib/cadastros/esquemas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/atrativos">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  return m ? { title: "Atrativos", description: `Atrativos turísticos de ${nomeDoMunicipio(m)}, Tocantins.` } : {};
}

export default async function Atrativos({ params }: PageProps<"/m/[slug]/atrativos">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const atrativos = await listarAtrativos(municipio.id, { publicados: true });
  const fotos = await primeiraFotoDe(municipio.id, "atrativo_id", atrativos.map((a) => a.id));

  return (
    <>
      <CabecalhoInterno titulo="Atrativos" className="md:hidden" />
      <CabecalhoPortal municipio={municipio} soComputador />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col md:max-w-[1248px] md:px-6 gap-4 px-4 pb-10">
        <h1 className="sr-only md:not-sr-only md:pt-6 md:text-[clamp(36px,4vw,48px)] md:leading-[1.05] md:font-bold md:tracking-[-0.02em]">Atrativos de {nomeDoMunicipio(municipio)}</h1>
        {atrativos.length === 0 ? (
          <Vazio>Os atrativos turísticos do município estão sendo cadastrados pela Secretaria de Turismo e aparecem aqui em breve.</Vazio>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] md:gap-5">
            {atrativos.map((a) => {
              const foto = fotos.get(a.id);
              return (
                <li key={a.id}>
                  <Link href={`/atrativos/${a.id}`} className="flex flex-col gap-1.5 text-foreground no-underline hover:text-foreground">
                    <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, a.nome)} className="h-[124px] rounded-[14px] md:mb-1 md:aspect-[4/3] md:h-auto md:rounded-2xl" sizes="(min-width: 1248px) 285px, (min-width: 768px) 33vw, (min-width: 576px) 270px, 50vw" />
                    <span className="leading-tight font-bold md:text-[19px]">{a.nome}</span>
                    <span className="text-[13px] text-muted-foreground">{CATEGORIAS_ATRATIVO[a.categoria]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
