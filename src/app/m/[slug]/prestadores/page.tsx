import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoInterno, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { listarPrestadores, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_PRESTADOR, type CategoriaPrestador } from "@/lib/cadastros/esquemas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/prestadores">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  return m ? { title: "Rede de prestadores", description: `Hospedagem, alimentação, guias e outros serviços da rede municipal de turismo de ${nomeDoMunicipio(m)}.` } : {};
}

/**
 * Rede de prestadores: só dados públicos (nome, categoria, serviços, contatos autorizados e
 * localização). Adesão, responsável, contato interno e comprovante nunca entram aqui.
 */
export default async function Rede({ params, searchParams }: PageProps<"/m/[slug]/prestadores">) {
  const { slug } = await params;
  const { categoria } = await searchParams;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const todos = await listarPrestadores(municipio.id, { publicados: true });
  const categorias = (Object.keys(CATEGORIAS_PRESTADOR) as CategoriaPrestador[]).filter((c) => todos.some((p) => p.categoria === c));
  const filtro = categorias.find((c) => c === categoria) ?? null;
  const prestadores = filtro ? todos.filter((p) => p.categoria === filtro) : todos;
  const fotos = await primeiraFotoDe(municipio.id, "prestador_id", prestadores.map((p) => p.id));
  const chip = "flex min-h-11 items-center rounded-full border px-4 text-[15px] font-bold no-underline";

  return (
    <>
      <CabecalhoInterno titulo="Rede de prestadores" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10">
        <h1 className="sr-only">Rede de prestadores de {nomeDoMunicipio(municipio)}</h1>
        <p className="text-[15px] text-muted-foreground">Empresas e profissionais que aderiram à rede municipal de turismo.</p>
        {todos.length === 0 ? (
          <Vazio>A rede municipal de prestadores está em formação. Pousadas, restaurantes e guias que aderirem aparecem aqui.</Vazio>
        ) : (
          <>
            <nav aria-label="Filtrar por categoria">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link href="/prestadores" aria-current={filtro === null ? "page" : undefined}
                    className={cn(chip, filtro === null ? "border-foreground bg-foreground text-white hover:text-white" : "bg-superficie text-foreground hover:text-foreground")}>
                    Todos
                  </Link>
                </li>
                {categorias.map((c) => (
                  <li key={c}>
                    <Link href={`/prestadores?categoria=${c}`} aria-current={filtro === c ? "page" : undefined}
                      className={cn(chip, filtro === c ? "border-foreground bg-foreground text-white hover:text-white" : "bg-superficie text-foreground hover:text-foreground")}>
                      {CATEGORIAS_PRESTADOR[c]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <ul className="flex flex-col gap-3">
              {prestadores.map((p) => {
                const foto = fotos.get(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/prestadores/${p.id}`}
                      className="flex gap-3 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground"
                    >
                    <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, p.nome_publico)} className="size-[88px] shrink-0 rounded-xl" sizes="88px" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="text-[17px] leading-tight font-bold">{p.nome_publico}</h2>
                      <span className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">{CATEGORIAS_PRESTADOR[p.categoria]}</span>
                        {p.situacao_rede === "em_adesao" ? (
                          <span className="rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">Em adesão à rede</span>
                        ) : null}
                      </span>
                      {p.servicos ? <p className="text-sm whitespace-pre-line">{p.servicos}</p> : null}
                      {p.localizacao ? <p className="text-sm text-muted-foreground">{p.localizacao}</p> : null}
                      {p.contatos_publicos ? <p className="text-sm font-bold">{p.contatos_publicos}</p> : null}
                    </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
