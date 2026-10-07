import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AvisoDeChegada } from "@/components/painel/avisos";
import { ArquivarEvidencia, ExclusaoLgpd, FormularioEditarEvidencia, GerenciarArquivosEvidencia } from "@/components/painel/evidencias";
import { Voltar } from "@/components/painel/telas-cadastro";
import { listarAtividades } from "@/lib/atividades/dados";
import { formatarData, formatarDataHora, hojeLocal } from "@/lib/datas";
import { buscarEvidencia, historicoDaEvidencia, type RegistroHistorico } from "@/lib/evidencias/dados";
import { ROTULO_CAMPO, ROTULO_TIPO_ACAO, ROTULO_TIPO_ARQUIVO, type TipoArquivoEvidencia } from "@/lib/evidencias/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";
import { anosDisponiveis } from "@/lib/relatorios/periodo";

export const metadata: Metadata = { title: "Evidência" };

function arquivoTexto(dados: Record<string, unknown> | null) {
  const tipo = ROTULO_TIPO_ARQUIVO[String(dados?.tipo) as TipoArquivoEvidencia] ?? "Arquivo";
  return `${tipo}: ${String(dados?.legenda ?? "")}`;
}

/** Frase curta do que mudou, para o histórico (item 3.5). */
function descreverRegistro(h: RegistroHistorico): string {
  switch (h.acao) {
    case "criada":
      return "Registrou a evidência";
    case "editada":
      return `Alterou ${h.campos.map((c) => ROTULO_CAMPO[c] ?? c).join(", ")}`;
    case "arquivada":
      return "Arquivou a evidência";
    case "reativada":
      return "Reativou a evidência";
    case "arquivo_incluido":
      return `Incluiu ${arquivoTexto(h.depois)}`;
    case "arquivo_removido":
      return `Retirou da evidência ${arquivoTexto(h.antes)}`;
    case "arquivo_excluido_lgpd": {
      const tipo = ROTULO_TIPO_ARQUIVO[String(h.antes?.tipo) as TipoArquivoEvidencia] ?? "Arquivo";
      return `Excluiu definitivamente um arquivo (${tipo.toLowerCase()}) a pedido do titular. Motivo: ${String(h.depois?.motivo ?? "")}`;
    }
    case "legenda_alterada":
      return `Alterou a legenda de "${String(h.antes?.legenda ?? "")}" para "${String(h.depois?.legenda ?? "")}"`;
  }
}

export default async function EditarEvidencia({ params, searchParams }: PageProps<"/m/[slug]/admin/evidencias/[id]">) {
  const { slug, id } = await params;
  const { municipio, papel } = await exigirPainel(slug, ["gestor"]);
  const admin = papel === "admin";
  const evidencia = await buscarEvidencia(municipio.id, id, { retirados: admin });
  if (!evidencia) notFound();
  const ativos = evidencia.evidencias_arquivos.filter((a) => !a.retirado);
  const [historico, atividades] = await Promise.all([historicoDaEvidencia(municipio.id, id), listarAtividades(municipio.id)]);
  const criada = (await searchParams).criada === "1";
  const inclusao = historico.find((h) => h.acao === "criada");
  const anos = anosDisponiveis();
  if (!anos.includes(evidencia.ano_base)) anos.push(evidencia.ano_base);

  return (
    <Pagina className="pt-2">
      <Voltar href={`/admin/evidencias?ano=${evidencia.ano_base}`} rotulo="Evidências" />
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-bold">{evidencia.titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom={evidencia.arquivada ? "cinza" : "verde"}>{evidencia.arquivada ? "Arquivada" : `Ano-base ${evidencia.ano_base}`}</Selo>
          <span className="text-sm text-muted-foreground">{ROTULO_TIPO_ACAO[evidencia.tipo_acao]}</span>
        </div>
      </div>
      {criada ? <AvisoDeChegada parametro="criada" texto="Evidência registrada. Agora envie fotos e anexos." /> : null}
      <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-superficie p-4">
        <div>
          <dt className="text-[13px] text-muted-foreground">Realizada em</dt>
          <dd className="font-bold">{formatarData(evidencia.data_realizacao)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Incluída no sistema em</dt>
          <dd className="font-bold">{formatarDataHora(evidencia.criado_em)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[13px] text-muted-foreground">Incluída por</dt>
          <dd className="font-bold">{inclusao?.autor_nome ?? "[Autor não identificado]"}</dd>
        </div>
      </dl>

      <section aria-labelledby="arquivos" className="flex flex-col gap-3">
        <h2 id="arquivos" className="text-xl font-bold">Fotos e anexos</h2>
        <GerenciarArquivosEvidencia
          evidenciaId={evidencia.id}
          arquivos={ativos.map((a) => ({
            id: a.id,
            tipo: a.tipo,
            legenda: a.legenda,
            imagem: a.tipo === "foto",
            url: `/admin/evidencias/${evidencia.id}/arquivos/${a.id}`,
          }))}
        />
      </section>

      {admin ? (
        <section aria-labelledby="lgpd" className="flex flex-col gap-3">
          <h2 id="lgpd" className="text-xl font-bold">Exclusão a pedido do titular (LGPD)</h2>
          <p className="text-sm text-muted-foreground">
            Só a assessoria vê esta seção. Use quando a pessoa que aparece no arquivo pedir a exclusão. Inclui os arquivos que o
            gestor retirou da evidência.
          </p>
          <ExclusaoLgpd
            evidenciaId={evidencia.id}
            arquivos={evidencia.evidencias_arquivos.map((a) => ({
              id: a.id,
              tipo: a.tipo,
              legenda: a.legenda,
              retirado: a.retirado,
              url: `/admin/evidencias/${evidencia.id}/arquivos/${a.id}`,
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-xl font-bold">Dados da evidência</h2>
        <FormularioEditarEvidencia
          id={evidencia.id}
          anos={anos}
          hoje={hojeLocal()}
          atividades={atividades.map((a) => ({ id: a.id, titulo: a.titulo }))}
          valores={{
            tipo_acao: evidencia.tipo_acao,
            titulo: evidencia.titulo,
            descricao: evidencia.descricao,
            data_realizacao: evidencia.data_realizacao,
            responsavel: evidencia.responsavel,
            ano_base: String(evidencia.ano_base),
            atividade_id: evidencia.atividade_id ?? "",
          }}
        />
      </section>

      <section aria-labelledby="historico" className="flex flex-col gap-2">
        <h2 id="historico" className="text-xl font-bold">Histórico de alterações</h2>
        <p className="text-sm text-muted-foreground">Registrado automaticamente. Ninguém edita nem apaga este histórico.</p>
        <ol className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {historico.map((h) => (
            <li key={h.id} className="flex flex-col gap-0.5 border-b px-4 py-3 last:border-b-0">
              <span>{descreverRegistro(h)}</span>
              <span className="text-sm text-muted-foreground">
                {formatarDataHora(h.em)} · {h.autor_nome ?? "[Autor não identificado]"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ArquivarEvidencia id={evidencia.id} arquivada={evidencia.arquivada} />
    </Pagina>
  );
}
