import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MensagemEstado, Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AcoesStatus, ControlesSessao, FormularioEditarAtividade, FormularioSessao } from "@/components/painel/atividades";
import { buscarAtividade, listarSessoes } from "@/lib/atividades/dados";
import { ResumoFotos } from "@/components/painel/tela-fotos";
import { listarFotos, listarPrestadores } from "@/lib/cadastros/dados";
import { ROTULO_MODO, ROTULO_STATUS } from "@/lib/atividades/esquemas";
import { formatarDataComSemana, formatarHora, hojeLocal, jaPassou } from "@/lib/datas";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Atividade" };

export default async function EditarAtividade({ params, searchParams }: PageProps<"/m/[slug]/admin/atividades/[id]">) {
  const { slug, id } = await params;
  const { criada } = await searchParams;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const atividade = await buscarAtividade(municipio.id, id);
  if (!atividade) notFound();
  const [sessoes, prestadores, fotos] = await Promise.all([
    atividade.modo === "reserva" ? listarSessoes(municipio.id, atividade.id) : Promise.resolve([]),
    listarPrestadores(municipio.id),
    listarFotos(municipio.id, "atividade_id", [atividade.id]),
  ]);
  const futuras = sessoes.filter((s) => !jaPassou(s.fim));
  const passadas = sessoes.filter((s) => jaPassou(s.fim));

  return (
    <Pagina className="pt-2">
      <Link href="/admin/atividades" className="flex min-h-11 w-fit items-center gap-1.5 font-bold">
        <ArrowLeft aria-hidden="true" className="size-5" /> Atividades
      </Link>
      {criada ? <MensagemEstado aviso="Atividade criada em elaboração. Revise, adicione horários e publique." /> : null}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-bold">{atividade.titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom={atividade.status === "publicado" ? "verde" : atividade.status === "rascunho" ? "dourado" : "cinza"}>
            {ROTULO_STATUS[atividade.status]}
          </Selo>
          <span className="text-sm text-muted-foreground">{ROTULO_MODO[atividade.modo]}</span>
        </div>
      </div>

      <AcoesStatus id={atividade.id} status={atividade.status} modo={atividade.modo} temSessoes={futuras.length > 0} />

      <ResumoFotos tipo="atividades" id={atividade.id} nome={atividade.titulo} fotos={fotos} />

      {atividade.modo === "reserva" ? (
        <section aria-labelledby="horarios" className="flex flex-col gap-3">
          <h2 id="horarios" className="text-xl font-bold">Horários e vagas</h2>
          {futuras.length === 0 ? (
            <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
              Nenhum horário futuro. Adicione abaixo a data, o horário e as vagas de cada saída.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {futuras.map((s) => {
                const rotulo = `${formatarDataComSemana(s.inicio)}, ${formatarHora(s.inicio)}`;
                return (
                  <li key={s.id} className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">
                        {rotulo} às {formatarHora(s.fim)}
                      </span>
                      {!s.ativa ? <Selo tom="cinza">Fechado para reservas</Selo> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.capacidade_pessoas === null
                        ? `${s.pessoas_reservadas} pessoas com reserva · sem limite de vagas`
                        : `${s.pessoas_reservadas} de ${s.capacidade_pessoas} vagas reservadas`}
                    </p>
                    <ControlesSessao
                      sessaoId={s.id}
                      atividadeId={atividade.id}
                      capacidade={s.capacidade_pessoas}
                      reservadas={s.pessoas_reservadas}
                      ativa={s.ativa}
                      rotulo={rotulo}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <FormularioSessao atividadeId={atividade.id} hoje={hojeLocal()} />
          {passadas.length ? (
            <details className="rounded-2xl border bg-superficie p-4">
              <summary className="min-h-11 cursor-pointer content-center font-bold">Horários encerrados ({passadas.length})</summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                {passadas.map((s) => (
                  <li key={s.id}>
                    {formatarDataComSemana(s.inicio)}, {formatarHora(s.inicio)} · {s.pessoas_reservadas} pessoas com reserva
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
          Registro voluntário não tem horários nem limite de vagas. O visitante escolhe o dia e o portal avisa que o
          registro não condiciona a entrada.
        </p>
      )}

      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-xl font-bold">Dados da atividade</h2>
        <FormularioEditarAtividade
          id={atividade.id}
          valores={{
            titulo: atividade.titulo,
            descricao: atividade.descricao,
            local_encontro: atividade.local_encontro,
            condicoes: atividade.condicoes,
            max_pessoas_por_voucher: atividade.max_pessoas_por_voucher,
            exige_responsavel: atividade.exige_responsavel,
            exige_contato: atividade.exige_contato,
            prestador_id: atividade.prestador_id,
          }}
          prestadores={prestadores.filter((x) => x.status !== "arquivado" || x.id === atividade.prestador_id).map((x) => ({ id: x.id, nome: x.nome_publico }))}
        />
      </section>
    </Pagina>
  );
}
