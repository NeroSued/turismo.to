import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AlternarMunicipio } from "@/components/painel/assessoria";
import { ConvidarParaEquipe, ListaEquipe } from "@/components/painel/equipe";
import { ConteudoConfiguracoes } from "@/components/painel/tela-configuracoes";
import { Voltar } from "@/components/painel/telas-cadastro";
import { listarEquipe } from "@/lib/equipe/dados";
import { buscarMunicipioPorId, listarMunicipiosDoPainel } from "@/lib/municipio/dados";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Município" };

/** Um município pela assessoria (item 4.1): situação, equipe e configurações, mesmo desativado. */
export default async function MunicipioAssessoria({ params }: PageProps<"/m/[slug]/admin/assessoria/[municipio]">) {
  const { slug, municipio: alvo } = await params;
  const { userId } = await exigirPainel(slug, ["admin"]);
  const item = (await listarMunicipiosDoPainel()).find((m) => m.slug === alvo);
  const municipio = item ? await buscarMunicipioPorId(item.id) : null;
  if (!municipio) notFound();
  const equipe = await listarEquipe(municipio.id);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/assessoria" rotulo="Assessoria" />
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-bold">{municipio.nome}</h1>
        <div className="flex items-center gap-2">
          <Selo tom={municipio.ativo ? "verde" : "cinza"}>{municipio.ativo ? "Portal ativo" : "Portal desativado"}</Selo>
          <span className="text-sm text-muted-foreground">{municipio.slug}</span>
        </div>
      </div>
      <AlternarMunicipio id={municipio.id} nome={municipio.nome} ativo={municipio.ativo} />

      <section aria-labelledby="equipe" className="flex flex-col gap-3">
        <h2 id="equipe" className="text-xl font-bold">Equipe</h2>
        <ListaEquipe municipioId={municipio.id} membros={equipe.map((m) => ({ ...m, eu: m.user_id === userId }))} />
        <ConvidarParaEquipe municipioId={municipio.id} nomeMunicipio={municipio.nome} />
      </section>

      <section aria-labelledby="configuracoes" className="flex flex-col gap-3">
        <h2 id="configuracoes" className="text-xl font-bold">Configurações do portal</h2>
        <ConteudoConfiguracoes municipio={municipio} />
      </section>
    </Pagina>
  );
}
