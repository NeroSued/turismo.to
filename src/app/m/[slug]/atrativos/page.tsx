import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
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
      <CabecalhoInterno titulo="Atrativos" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10">
        <h1 className="sr-only">Atrativos de {nomeDoMunicipio(municipio)}</h1>
        {atrativos.length === 0 ? (
          <Vazio>Os atrativos turísticos do município estão sendo cadastrados pela Secretaria de Turismo e aparecem aqui em breve.</Vazio>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {atrativos.map((a) => {
              const foto = fotos.get(a.id);
              return (
                <li key={a.id}>
                  <Link href={`/atrativos/${a.id}`} className="flex flex-col gap-1.5 text-foreground no-underline hover:text-foreground">
                    <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, a.nome)} className="h-[124px] rounded-[14px]" sizes="(max-width: 576px) 50vw, 270px" />
                    <span className="leading-tight font-bold">{a.nome}</span>
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
