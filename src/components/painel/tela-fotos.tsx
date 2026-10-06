import { ArrowLeft, ChevronRight, Images } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagina } from "@/components/pagina";
import { GerenciarFotos } from "@/components/painel/fotos";
import { urlPublica } from "@/lib/arquivos/url";
import { listarFotos, type Foto } from "@/lib/cadastros/dados";
import { nomeDoCadastro } from "@/lib/fotos/dados";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { CADASTRO_FOTO, DONO_FOTO, LIMITE_FOTOS, type TipoFoto } from "@/lib/fotos/tipos";
import { exigirPainel } from "@/lib/painel/contexto";

/** Página /admin/<tipo>/<id>/fotos (tela "Gestor · fotos do cadastro"). Só gestor e admin. */
export async function TelaFotos({ slug, tipo, id }: { slug: string; tipo: TipoFoto; id: string }) {
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const nome = await nomeDoCadastro(municipio.id, tipo, id);
  if (!nome) notFound();
  const fotos = await listarFotos(municipio.id, DONO_FOTO[tipo], [id]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-superficie">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2.5">
          <Link
            href={`/admin/${tipo}/${id}`}
            aria-label="Voltar ao cadastro"
            className="flex size-11 items-center justify-center rounded-xl text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-[22px]" />
          </Link>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs text-muted-foreground">
              {CADASTRO_FOTO[tipo].rotulo} · {nome}
            </span>
            <h1 className="text-xl font-bold">Fotos</h1>
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {fotos.length} de {LIMITE_FOTOS}
          </span>
        </div>
      </header>
      <Pagina className="pt-4">
        <GerenciarFotos
          tipo={tipo}
          donoId={id}
          nome={nome}
          credito={fotos.find((f) => f.credito)?.credito ?? null}
          fotos={fotos.map((f, i) => ({ id: f.id, url: urlPublica(f.caminho), legenda: f.legenda, alt: textoAlternativo(f.legenda, i, nome) }))}
        />
      </Pagina>
    </>
  );
}

/** Resumo na tela de edição do cadastro: capa, quantidade e link para a tela de fotos. */
export function ResumoFotos({ tipo, id, nome, fotos }: { tipo: TipoFoto; id: string; nome: string; fotos: Foto[] }) {
  const capa = fotos[0];
  return (
    <section aria-labelledby="fotos" className="flex flex-col gap-3">
      <h2 id="fotos" className="text-xl font-bold">Fotos</h2>
      <Link
        href={`/admin/${tipo}/${id}/fotos`}
        className="flex min-h-16 items-center gap-3 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground"
      >
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura do painel
          <img src={urlPublica(capa.caminho)} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
            <Images className="size-6" />
          </span>
        )}
        <span className="flex flex-1 flex-col">
          <span className="font-bold">{fotos.length ? "Capa e galeria" : "Adicionar fotos"}</span>
          <span className="text-sm text-muted-foreground">
            {fotos.length
              ? `${fotos.length} de ${LIMITE_FOTOS} fotos · capa: ${textoAlternativo(capa?.legenda, 0, nome)}`
              : `Nenhuma foto. Tire ou escolha até ${LIMITE_FOTOS}; a primeira vira a capa.`}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
      </Link>
    </section>
  );
}
