import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import { ConvidarParaEquipe, ListaEquipe } from "@/components/painel/equipe";
import { Voltar } from "@/components/painel/telas-cadastro";
import { listarEquipe } from "@/lib/equipe/dados";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Equipe" };

/** Equipe do município (item 4.2): convite por e-mail com papel, troca de papel e desativação. */
export default async function Equipe({ params }: PageProps<"/m/[slug]/admin/equipe">) {
  const { slug } = await params;
  const { municipio, userId } = await exigirPainel(slug, ["gestor"]);
  const equipe = await listarEquipe(municipio.id);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/mais" rotulo="Mais" />
      <h1 className="text-[26px] font-bold">Equipe</h1>
      <p className="text-muted-foreground">Quem tem acesso ao painel de {municipio.nome}.</p>
      <ListaEquipe municipioId={municipio.id} membros={equipe.map((m) => ({ ...m, eu: m.user_id === userId }))} />
      <ConvidarParaEquipe municipioId={municipio.id} nomeMunicipio={municipio.nome} />
    </Pagina>
  );
}
