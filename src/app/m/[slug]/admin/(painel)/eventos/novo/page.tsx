import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { FormularioNovoCadastro } from "@/components/painel/cadastros";
import { Voltar } from "@/components/painel/telas-cadastro";
import { hojeLocal } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Novo evento" };

export default async function NovoEvento({ params }: PageProps<"/m/[slug]/admin/eventos/novo">) {
  const { slug } = await params;
  await exigirPainel(slug, ["gestor"]);
  const hoje = hojeLocal();
  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/eventos" rotulo="Eventos" />
      <h1 className="text-[26px] font-bold">Novo evento</h1>
      <p className="text-muted-foreground">Horários no fuso do Tocantins (America/Araguaina).</p>
      <FormularioNovoCadastro tipo="eventos" valores={{ dia_inicio: hoje, dia_fim: hoje }} />
    </Pagina>
  );
}
