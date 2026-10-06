import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MensagemEstado } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AcoesStatusCadastro, FormularioEditarCadastro } from "@/components/painel/cadastros";
import { ResumoFotos } from "@/components/painel/tela-fotos";
import { CabecalhoCadastro, Voltar } from "@/components/painel/telas-cadastro";
import { buscarEvento, listarAtrativos, listarFotos } from "@/lib/cadastros/dados";
import { diaLocal, formatarDataHora, horaLocal } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Evento" };

export default async function EditarEvento({ params, searchParams }: PageProps<"/m/[slug]/admin/eventos/[id]">) {
  const { slug, id } = await params;
  const { criado } = await searchParams;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const e = await buscarEvento(municipio.id, id);
  if (!e) notFound();
  const [fotos, atrativos] = await Promise.all([listarFotos(municipio.id, "evento_id", [e.id]), listarAtrativos(municipio.id)]);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/eventos" rotulo="Eventos" />
      {criado ? <MensagemEstado aviso="Evento criado em elaboração. Revise, envie fotos e publique." /> : null}
      <CabecalhoCadastro titulo={e.titulo} status={e.status} detalhe={`${formatarDataHora(e.inicio)} a ${formatarDataHora(e.fim)}`} />
      <AcoesStatusCadastro tipo="eventos" id={e.id} status={e.status} />
      <ResumoFotos tipo="eventos" id={e.id} nome={e.titulo} fotos={fotos} />
      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-xl font-bold">Dados do evento</h2>
        <FormularioEditarCadastro
          tipo="eventos"
          id={e.id}
          atrativos={atrativos
            .filter((a) => a.status !== "arquivado" || a.id === e.atrativo_id)
            .map((a) => ({ id: a.id, nome: a.nome }))}
          valores={{
            titulo: e.titulo,
            descricao: e.descricao,
            local: e.local,
            organizador: e.organizador,
            atrativo_id: e.atrativo_id,
            dia_inicio: diaLocal(e.inicio),
            hora_inicio: horaLocal(e.inicio),
            dia_fim: diaLocal(e.fim),
            hora_fim: horaLocal(e.fim),
          }}
        />
      </section>
    </Pagina>
  );
}
