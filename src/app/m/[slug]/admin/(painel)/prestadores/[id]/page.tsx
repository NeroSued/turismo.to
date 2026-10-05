import { FileText, Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MensagemEstado } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AcoesStatusCadastro, FormularioAdesao, FormularioEditarCadastro, GerenciarFotos } from "@/components/painel/cadastros";
import { CabecalhoCadastro, Voltar } from "@/components/painel/telas-cadastro";
import { urlPublica } from "@/lib/arquivos/url";
import { buscarPrestador, listarAdesoes, listarFotos } from "@/lib/cadastros/dados";
import { CATEGORIAS_PRESTADOR, SITUACOES_REDE } from "@/lib/cadastros/esquemas";
import { formatarData, hojeLocal } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Prestador" };

export default async function EditarPrestador({ params, searchParams }: PageProps<"/m/[slug]/admin/prestadores/[id]">) {
  const { slug, id } = await params;
  const { criado } = await searchParams;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const p = await buscarPrestador(municipio.id, id);
  if (!p) notFound();
  const [fotos, adesoes] = await Promise.all([listarFotos(municipio.id, "prestador_id", [p.id]), listarAdesoes(municipio.id, p.id)]);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/prestadores" rotulo="Prestadores" />
      {criado ? <MensagemEstado aviso="Prestador criado em elaboração. Registre a adesão, envie fotos e publique." /> : null}
      <CabecalhoCadastro
        titulo={p.nome_publico}
        status={p.status}
        detalhe={`${CATEGORIAS_PRESTADOR[p.categoria]} · ${SITUACOES_REDE[p.situacao_rede]}`}
      />
      <AcoesStatusCadastro tipo="prestadores" id={p.id} status={p.status} />

      <section aria-labelledby="adesao" className="flex flex-col gap-3">
        <h2 id="adesao" className="text-xl font-bold">Adesão à rede</h2>
        <p className="flex items-start gap-2 rounded-xl bg-dourado-suave p-3 text-dourado-texto">
          <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          Data, responsável, contato interno e comprovante ficam só no painel. Nunca aparecem no portal.
        </p>
        {adesoes.length === 0 ? (
          <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
            Nenhuma adesão registrada. Registre abaixo quando o prestador assinar o termo ou a ficha de adesão.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {adesoes.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-2xl border bg-superficie p-4">
                <span className="font-bold">Adesão em {formatarData(a.data_adesao)}</span>
                <span>Responsável: {a.responsavel}</span>
                {a.contato_interno ? <span>Contato interno: {a.contato_interno}</span> : null}
                {a.observacoes ? <span className="text-sm text-muted-foreground">{a.observacoes}</span> : null}
                {a.comprovante_caminho ? (
                  <a
                    href={`/admin/prestadores/${p.id}/adesoes/${a.id}/comprovante`}
                    target="_blank"
                    rel="noopener"
                    className="flex min-h-11 w-fit items-center gap-1.5 font-bold"
                  >
                    <FileText aria-hidden="true" className="size-5" /> Abrir comprovante
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Sem comprovante anexado.</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <FormularioAdesao prestadorId={p.id} hoje={hojeLocal()} />
      </section>

      <section aria-labelledby="fotos" className="flex flex-col gap-3">
        <h2 id="fotos" className="text-xl font-bold">Fotos</h2>
        <GerenciarFotos
          tipo="prestadores"
          donoId={p.id}
          fotos={fotos.map((f) => ({ id: f.id, legenda: f.legenda, url: urlPublica(f.caminho) }))}
        />
      </section>
      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-xl font-bold">Dados públicos do prestador</h2>
        <FormularioEditarCadastro tipo="prestadores" id={p.id} valores={p} />
      </section>
    </Pagina>
  );
}
