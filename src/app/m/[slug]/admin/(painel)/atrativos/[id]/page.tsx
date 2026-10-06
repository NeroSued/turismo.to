import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MensagemEstado } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AcoesStatusCadastro, FormularioEditarCadastro } from "@/components/painel/cadastros";
import { ResumoFotos } from "@/components/painel/tela-fotos";
import { CabecalhoCadastro, Voltar } from "@/components/painel/telas-cadastro";
import { buscarAtrativo, listarFotos } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO } from "@/lib/cadastros/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Atrativo" };

const decimal = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export default async function EditarAtrativo({ params, searchParams }: PageProps<"/m/[slug]/admin/atrativos/[id]">) {
  const { slug, id } = await params;
  const { criado } = await searchParams;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const a = await buscarAtrativo(municipio.id, id);
  if (!a) notFound();
  const fotos = await listarFotos(municipio.id, "atrativo_id", [a.id]);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/atrativos" rotulo="Atrativos" />
      {criado ? <MensagemEstado aviso="Atrativo criado em elaboração. Complete os dados, envie fotos e publique." /> : null}
      <CabecalhoCadastro titulo={a.nome} status={a.status} detalhe={CATEGORIAS_ATRATIVO[a.categoria]} />
      <AcoesStatusCadastro tipo="atrativos" id={a.id} status={a.status} />
      <ResumoFotos tipo="atrativos" id={a.id} nome={a.nome} fotos={fotos} />
      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-xl font-bold">Dados do atrativo</h2>
        <FormularioEditarCadastro
          tipo="atrativos"
          id={a.id}
          valores={{ ...a, latitude: decimal(a.latitude), longitude: decimal(a.longitude) }}
        />
      </section>
    </Pagina>
  );
}
