import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { FormularioNovaEvidencia } from "@/components/painel/evidencias";
import { Voltar } from "@/components/painel/telas-cadastro";
import { listarAtividades } from "@/lib/atividades/dados";
import { hojeLocal } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";
import { anosDisponiveis } from "@/lib/relatorios/periodo";

export const metadata: Metadata = { title: "Nova evidência" };

export default async function NovaEvidencia({ params }: PageProps<"/m/[slug]/admin/evidencias/nova">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const atividades = await listarAtividades(municipio.id);
  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/evidencias" rotulo="Evidências" />
      <h1 className="text-[26px] font-bold">Nova evidência</h1>
      <FormularioNovaEvidencia
        atividades={atividades.map((a) => ({ id: a.id, titulo: a.titulo }))}
        anos={anosDisponiveis()}
        hoje={hojeLocal()}
      />
    </Pagina>
  );
}
