import type { Metadata } from "next";
import { Selecao } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { BotaoImprimirPdf } from "@/components/painel/imprimir";
import { FormularioTextosMinuta } from "@/components/painel/minuta";
import { Voltar } from "@/components/painel/telas-cadastro";
import { Button } from "@/components/ui/button";
import { listarAtividades } from "@/lib/atividades/dados";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { listarEvidencias } from "@/lib/evidencias/dados";
import { ROTULO_TIPO_ACAO, ROTULO_TIPO_ARQUIVO } from "@/lib/evidencias/esquemas";
import { buscarTextosMinuta } from "@/lib/minuta/dados";
import { montarMinuta, type Bloco } from "@/lib/minuta/conteudo";
import { exigirPainel } from "@/lib/painel/contexto";
import { relatorioCompleto } from "@/lib/relatorios/dados";
import { indicadoresRegistro, indicadoresReserva, origemPorUf, ROTULO_CATEGORIA_PRESTADOR } from "@/lib/relatorios/exportacao";
import { anosDisponiveis, lerPeriodo } from "@/lib/relatorios/periodo";

export const metadata: Metadata = { title: "Minuta do relatório de implantação" };

function BlocoMinuta({ b }: { b: Bloco }) {
  switch (b.tipo) {
    case "paragrafo":
      return <p>{b.texto}</p>;
    case "lista":
      return (
        <ul className="list-disc pl-5">
          {b.itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "pendente":
      return <p className="rounded-xl bg-dourado-suave p-3 text-dourado-texto italic print:bg-transparent print:p-0">{b.texto}</p>;
    case "campo":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold">{b.rotulo}</span>
          {/* Linha em branco para preenchimento à mão: nada é preenchido pelo sistema. */}
          <span data-campo-em-branco className="block h-9 border-b border-foreground" />
        </div>
      );
    case "evidencia": {
      const e = b.evidencia;
      const fotos = e.arquivos.filter((a) => a.foto).slice(0, 4);
      return (
        <article className="flex flex-col gap-2 rounded-2xl border bg-superficie p-3.5 print:break-inside-avoid print:rounded-none print:border-x-0 print:border-t-0 print:px-0">
          <h4 className="font-bold">{e.titulo}</h4>
          <p className="text-sm">{b.resumo}</p>
          {fotos.length ? (
            <div className="grid grid-cols-2 gap-2">
              {fotos.map((f) => (
                <figure key={f.id} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado por URL assinada, sem otimização */}
                  <img src={`/admin/evidencias/${e.id}/arquivos/${f.id}`} alt={f.legenda} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <figcaption className="text-xs text-muted-foreground">{f.legenda}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </article>
      );
    }
  }
}

/** Minuta do relatório de implantação do ano-base (item 3.6), para revisar, completar e imprimir. */
export default async function Minuta({ params, searchParams }: PageProps<"/m/[slug]/admin/relatorios/minuta">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const p = lerPeriodo({ ano: (await searchParams).ano });
  const ano = p.ano!;

  const [r, atividades, evidencias, textos] = await Promise.all([
    relatorioCompleto(municipio.id, p.inicio, p.fim),
    listarAtividades(municipio.id, true),
    listarEvidencias(municipio.id, ano),
    buscarTextosMinuta(municipio.id, ano),
  ]);

  const comNumeros = new Set(r.por_atividade.map((a) => a.atividade));
  const minuta = montarMinuta(
    {
      municipio: municipio.configuracoes_municipio?.nome_exibicao || municipio.nome,
      ano,
      referenciaIcms: municipio.configuracoes_municipio?.referencia_icms ?? "item 6.1.4",
      geradoEm: formatarDataHora(new Date()),
      atividades: [
        ...r.por_atividade.map((a) => ({
          titulo: a.atividade,
          resumo:
            a.modo === "reserva"
              ? `reserva gratuita; ${a.emitidos} vouchers emitidos, ${a.utilizados} utilizados, ${a.participacoes_confirmadas} participações confirmadas`
              : `registro voluntário; ${a.emitidos} registros, ${a.pessoas_reservadas} pessoas declaradas`,
        })),
        ...atividades
          .filter((a) => !comNumeros.has(a.titulo))
          .map((a) => ({ titulo: a.titulo, resumo: "publicada no portal, sem vouchers ou registros no ano-base" })),
      ],
      indicadoresReserva: indicadoresReserva(r),
      indicadoresRegistro: indicadoresRegistro(r),
      origem: origemPorUf(r, false).map((o) => `${o.local}, ${o.vouchers} vouchers e registros, ${o.pessoas} pessoas declaradas`),
      prestadores: r.prestadores.map((x) => `${x.nome} (${ROTULO_CATEGORIA_PRESTADOR[x.categoria] ?? x.categoria})`),
      evidencias: evidencias.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        tipo: ROTULO_TIPO_ACAO[e.tipo_acao],
        dataRealizacao: e.data_realizacao,
        responsavel: e.responsavel,
        descricao: e.descricao,
        arquivos: e.evidencias_arquivos.map((a) => ({ id: a.id, tipo: ROTULO_TIPO_ARQUIVO[a.tipo], legenda: a.legenda, foto: a.tipo === "foto" })),
      })),
      textos,
    },
    formatarData,
  );

  return (
    <Pagina className="pt-2 print:max-w-none print:px-0">
      <div className="flex flex-col gap-3 print:hidden">
        <Voltar href={`/admin/relatorios?ano=${ano}`} rotulo="Relatórios" />
        <form method="get" className="flex items-end gap-2 rounded-2xl border bg-superficie p-4">
          <Selecao id="ano" rotulo="Ano-base" defaultValue={ano} className="flex-1">
            {anosDisponiveis().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selecao>
          <Button type="submit" variant="outline" className="h-12">
            Ver ano
          </Button>
        </form>
        <div className="grid grid-cols-2 gap-2">
          <BotaoImprimirPdf className="whitespace-normal leading-tight" />
          <a href="#completar" className="flex min-h-[54px] items-center justify-center rounded-[14px] border px-3 text-center font-bold">
            Completar seções
          </a>
        </div>
      </div>

      <article aria-labelledby="titulo-minuta" className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 id="titulo-minuta" className="text-[26px] leading-tight font-bold">
            {minuta.titulo}
          </h1>
          <p className="font-bold">{minuta.subtitulo}</p>
          <p className="text-sm text-muted-foreground">Gerada em {formatarDataHora(new Date())}. Minuta, sujeita a revisão.</p>
        </header>
        <p role="note" className="rounded-xl border border-dourado bg-dourado-suave p-3 text-sm text-dourado-texto">
          {minuta.aviso}
        </p>
        {minuta.secoes.map((s) => (
          <section key={s.id} aria-labelledby={`secao-${s.id}`} className="flex flex-col gap-2.5">
            <h2 id={`secao-${s.id}`} className="text-xl font-bold">
              {s.titulo}
            </h2>
            {s.blocos.map((b, i) => (
              <BlocoMinuta key={i} b={b} />
            ))}
          </section>
        ))}
        <p className="text-sm text-muted-foreground">{minuta.aviso}</p>
      </article>

      <div className="print:hidden">
        <FormularioTextosMinuta ano={ano} valores={textos} />
      </div>
    </Pagina>
  );
}
