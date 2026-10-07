import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPortal, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { GradeAtrativos } from "@/components/portal/filtro-atrativos";
import { buttonVariants } from "@/components/ui/button";
import { listarAtrativos, listarEventos, listarPrestadores, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO, CATEGORIAS_PRESTADOR, type CategoriaPrestador } from "@/lib/cadastros/esquemas";
import { formatarDataComSemana, formatarHora, formatarPeriodo } from "@/lib/datas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { atividadesPublicadas, proximosHorarios } from "@/lib/portal/dados";
import { cn } from "@/lib/utils";
import { BlocoData, horarioDoEvento } from "@/components/portal/eventos";

const ATRATIVOS_NA_CAPA = 6;
const ATRATIVOS_NA_CAPA_COMPUTADOR = 8;
const EVENTOS_NA_CAPA = 3;
const EVENTOS_NA_CAPA_COMPUTADOR = 4;
const PRESTADORES_NA_CAPA = 6;

const tituloSecao = "text-[23px] font-bold md:text-[36px] md:tracking-[-0.015em]";
const cartao = "md:transition-[transform,box-shadow] md:duration-200 md:hover:-translate-y-[3px] md:hover:shadow-[0_14px_32px_rgba(22,33,27,0.12)] motion-reduce:md:transition-none motion-reduce:md:hover:translate-y-0";

/**
 * Portal municipal conforme a tela "Portal municipal": no celular (abaixo de 768 px) o canvas
 * "Turismo.TO Mobile"; a partir de 768 px, grades fluidas, e de 1024 px o canvas de computador.
 * Só conteúdo publicado.
 */
export default async function PortalMunicipal({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const nome = nomeDoMunicipio(municipio);
  const capa = municipio.configuracoes_municipio?.capa_caminho;
  const apresentacao = municipio.configuracoes_municipio?.apresentacao;

  const [atividades, horarios, eventos, atrativos, prestadores] = await Promise.all([
    atividadesPublicadas(municipio.id),
    proximosHorarios(municipio.id),
    listarEventos(municipio.id, { publicados: true, aPartirDe: new Date(), limite: EVENTOS_NA_CAPA_COMPUTADOR }),
    listarAtrativos(municipio.id, { publicados: true }),
    listarPrestadores(municipio.id, { publicados: true }),
  ]);
  const idsAtrativos = [...new Set([...atrativos.map((a) => a.id), ...atividades.flatMap((a) => (a.atrativo_id ? [a.atrativo_id] : []))])];
  const prestadoresNaCapa = prestadores.slice(0, PRESTADORES_NA_CAPA);
  const [fotos, capasAtividades, capasEventos, capasPrestadores] = await Promise.all([
    primeiraFotoDe(municipio.id, "atrativo_id", idsAtrativos),
    primeiraFotoDe(municipio.id, "atividade_id", atividades.map((a) => a.id)),
    primeiraFotoDe(municipio.id, "evento_id", eventos.map((e) => e.id)),
    primeiraFotoDe(municipio.id, "prestador_id", prestadoresNaCapa.map((p) => p.id)),
  ]);

  const reservas = atividades.filter((a) => a.modo === "reserva");
  const registro = atividades.find((a) => a.modo === "registro_voluntario");
  const categoriasRede = (Object.keys(CATEGORIAS_PRESTADOR) as CategoriaPrestador[]).filter((c) => prestadores.some((p) => p.categoria === c));

  return (
    <>
      <CabecalhoPortal municipio={municipio} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-1 pb-10 md:max-w-[1248px] md:gap-[72px] md:px-6 md:pt-6 md:pb-0">
        <section className="flex flex-col gap-[18px] md:gap-0">
          {capa ? (
            <FotoPortal
              caminho={capa}
              legenda={`Foto de ${nome}`}
              className="h-60 rounded-[20px] md:h-[420px] md:rounded-3xl lg:h-[500px]"
              sizes="(min-width: 1248px) 1200px, (min-width: 768px) calc(100vw - 48px), (min-width: 576px) 544px, calc(100vw - 32px)"
              prioridade
            />
          ) : (
            <div className="marcador-foto flex h-60 items-end rounded-[20px] p-3 md:h-[420px] md:items-start md:justify-end md:rounded-3xl md:p-4 lg:h-[500px]">
              <span className="rounded-md bg-superficie px-2 py-1 text-xs text-muted-foreground md:text-[13px]">[Foto oficial cedida pela prefeitura]</span>
            </div>
          )}
          <div
            data-painel-capa
            className="flex flex-col gap-[18px] md:relative md:-mt-[140px] md:ml-10 md:w-[calc(100%-80px)] md:max-w-[560px] md:gap-4 md:rounded-[20px] md:bg-superficie md:p-8 md:shadow-[0_18px_40px_rgba(22,33,27,0.14)]"
          >
            <div className="flex flex-col gap-1.5 md:gap-4">
              <h1 className="text-[42px] leading-none font-bold tracking-[-0.02em] md:text-[clamp(38px,4.5vw,56px)] md:tracking-[-0.025em]">{nome}</h1>
              <p className="text-[17px] text-muted-foreground md:text-lg md:text-[#3D4740]">
                {apresentacao ?? "Atrativos, eventos e atividades gratuitas, com reserva pelo celular."}
              </p>
            </div>
            {reservas.length || registro || atrativos.length ? (
              <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap">
                {reservas.length ? (
                  <Link
                    href={reservas.length === 1 ? `/atividades/${reservas[0].id}` : "#atividades"}
                    className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground md:px-[22px]" })}
                  >
                    Reservar atividade gratuita <ArrowRight aria-hidden="true" className="size-5" />
                  </Link>
                ) : null}
                {registro ? (
                  <>
                    <Link href={`/atividades/${registro.id}`} className={buttonVariants({ variant: "contorno", size: "lg", className: "no-underline md:px-[22px]" })}>
                      Registrar minha visita
                    </Link>
                    <p className="text-center text-sm text-muted-foreground md:hidden">O registro é voluntário e não condiciona a entrada nos atrativos.</p>
                  </>
                ) : null}
                {atrativos.length && !registro ? (
                  <Link href="#atrativos" className={buttonVariants({ variant: "contorno", size: "lg", className: "hidden no-underline md:inline-flex md:px-[22px]" })}>
                    Ver atrativos
                  </Link>
                ) : null}
              </div>
            ) : null}
            <p className="hidden text-sm text-muted-foreground md:block">
              Todas as atividades são gratuitas. O registro em atrativos de acesso livre é voluntário e não condiciona a entrada.
            </p>
          </div>
        </section>

        <section id="atividades" aria-labelledby="titulo-atividades" className="flex scroll-mt-4 flex-col gap-3 md:gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 id="titulo-atividades" className={tituloSecao}>Atividades com voucher</h2>
            <p className="hidden text-muted-foreground md:block">Todas gratuitas. Reserve pelo celular e receba um voucher com QR Code, sem cadastro.</p>
          </div>
          {atividades.length === 0 ? (
            <Vazio>
              Nenhuma atividade aberta no momento. Quando a Secretaria de Turismo abrir reservas gratuitas ou registros de
              visita, elas aparecem aqui. Enquanto isso, veja os atrativos e o calendário de eventos.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] md:gap-5">
              {atividades.map((a) => {
                const h = horarios.get(a.id);
                // Capa da atividade; sem ela, a do atrativo onde acontece.
                const foto = capasAtividades.get(a.id) ?? (a.atrativo_id ? fotos.get(a.atrativo_id) : undefined);
                return (
                  <li key={a.id} className="md:flex">
                    <Link
                      href={`/atividades/${a.id}`}
                      className={cn(
                        "flex gap-3 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground md:w-full md:flex-col md:gap-0 md:overflow-hidden md:rounded-[18px] md:p-0 md:hover:border-border",
                        cartao,
                      )}
                    >
                      <FotoPortal
                        caminho={foto?.caminho}
                        legenda={textoAlternativo(foto?.legenda, 0, a.titulo)}
                        className="size-[88px] shrink-0 rounded-xl md:aspect-[3/2] md:h-auto md:w-full md:rounded-none"
                        sizes="(min-width: 1248px) 387px, (min-width: 768px) 50vw, 88px"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px] md:gap-1.5 md:px-5 md:pt-[18px] md:pb-5">
                        {a.modo === "reserva" ? (
                          <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary md:px-2.5">Reserva gratuita</span>
                        ) : (
                          <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto md:px-2.5">Registro voluntário</span>
                        )}
                        <span className="text-[17px] font-bold md:text-xl md:leading-tight">{a.titulo}</span>
                        {a.modo === "reserva" ? (
                          <span className="text-sm text-muted-foreground md:text-[15px]">
                            {h ? `Próximo horário: ${formatarDataComSemana(h.inicio)}, ${formatarHora(h.inicio)}` : "Novos horários em breve"}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground md:text-[15px]">Entrada livre · o registro ajuda a prefeitura a planejar</span>
                        )}
                        {a.modo === "reserva" && h ? (
                          <span className="text-sm text-muted-foreground md:text-[15px]">
                            {h.restantes === null ? "Sem limite de vagas" : `Restam ${h.restantes} vagas nesse horário`}
                          </span>
                        ) : a.local_encontro ? (
                          <span className="text-sm text-muted-foreground md:text-[15px]">{a.local_encontro}</span>
                        ) : null}
                        <span aria-hidden="true" className="hidden pt-3 font-bold text-primary md:mt-auto md:block">
                          {a.modo === "reserva" ? "Escolher horário →" : "Registrar minha visita →"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section id="eventos" aria-labelledby="titulo-eventos" className="flex scroll-mt-4 flex-col gap-3 md:gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="titulo-eventos" className={tituloSecao}>Próximos eventos</h2>
            <Link href="/eventos" className="hidden min-h-11 items-center gap-2 font-bold md:flex">
              <CalendarDays aria-hidden="true" className="size-[18px]" /> Calendário completo
            </Link>
          </div>
          {eventos.length === 0 ? (
            <Vazio>Nenhum evento divulgado por enquanto. Festas, feiras e festivais aparecem aqui assim que a Secretaria publicar.</Vazio>
          ) : (
            <ul className="flex flex-col md:grid md:grid-cols-[repeat(auto-fill,minmax(min(100%,520px),1fr))] md:gap-5">
              {eventos.map((e, i) => {
                const cartaz = capasEventos.get(e.id);
                return (
                  <li key={e.id} className={cn("md:flex", i >= EVENTOS_NA_CAPA && "max-md:hidden")}>
                    <Link
                      href={`/eventos/${e.id}`}
                      className={cn(
                        "flex items-center gap-3.5 border-b py-2.5 text-foreground no-underline hover:text-foreground md:w-full md:items-stretch md:gap-[18px] md:rounded-[18px] md:border md:bg-superficie md:p-3.5",
                        cartao,
                      )}
                    >
                      <BlocoData inicio={e.inicio} fim={e.fim} className={cn(cartaz ? "md:hidden" : "md:aspect-[4/5] md:h-auto md:w-[132px] md:rounded-xl md:[&>span:first-child]:text-[32px]")} />
                      {cartaz ? (
                        <FotoPortal
                          caminho={cartaz.caminho}
                          legenda={textoAlternativo(cartaz.legenda, 0, e.titulo)}
                          className="hidden aspect-[4/5] w-[132px] shrink-0 rounded-xl md:block"
                          sizes="132px"
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-col gap-0.5 md:gap-1.5 md:pt-1 md:pr-1">
                        <span className="hidden text-sm font-bold tracking-[0.04em] text-dourado-texto uppercase md:block">{formatarPeriodo(e.inicio, e.fim)}</span>
                        <span className="text-[17px] font-bold md:text-[22px] md:leading-tight">{e.titulo}</span>
                        <span className="text-sm text-muted-foreground md:text-[15px]">
                          {[e.local, horarioDoEvento(e.inicio, e.fim)].filter(Boolean).join(" · ")}
                        </span>
                        {e.organizador ? <span className="hidden text-[15px] text-muted-foreground md:block">Organização: {e.organizador}</span> : null}
                        {e.descricao ? <span className="mt-1 hidden text-[15px] text-[#3D4740] md:line-clamp-2">{e.descricao}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/eventos" className="flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold md:hidden">
            <CalendarDays aria-hidden="true" className="size-[18px]" /> Ver calendário completo
          </Link>
        </section>

        <section id="atrativos" aria-labelledby="titulo-atrativos" className="flex scroll-mt-4 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
          <h2 id="titulo-atrativos" className={tituloSecao}>Atrativos</h2>
          {atrativos.length === 0 ? (
            <Vazio>Os atrativos turísticos do município estão sendo cadastrados pela Secretaria de Turismo e aparecem aqui em breve.</Vazio>
          ) : (
            <>
              <GradeAtrativos
                limite={ATRATIVOS_NA_CAPA_COMPUTADOR}
                limiteCelular={ATRATIVOS_NA_CAPA}
                itens={atrativos.map((a) => {
                  const foto = fotos.get(a.id);
                  return {
                    id: a.id,
                    categoria: a.categoria,
                    rotulo: CATEGORIAS_ATRATIVO[a.categoria],
                    cartao: (
                      <Link
                        href={`/atrativos/${a.id}`}
                        className={cn("flex flex-col gap-1.5 text-foreground no-underline hover:text-foreground md:gap-0.5 md:rounded-2xl", cartao)}
                      >
                        <FotoPortal
                          caminho={foto?.caminho}
                          legenda={textoAlternativo(foto?.legenda, 0, a.nome)}
                          className="h-[124px] rounded-[14px] md:mb-2 md:aspect-[4/3] md:h-auto md:rounded-2xl"
                          sizes="(min-width: 1248px) 285px, (min-width: 768px) 33vw, (min-width: 576px) 270px, 50vw"
                        />
                        <span className="leading-tight font-bold md:order-2 md:px-1 md:pb-1.5 md:text-[19px]">{a.nome}</span>
                        <span className="text-[13px] text-muted-foreground md:order-1 md:px-1 md:font-bold md:tracking-[0.05em] md:uppercase">
                          {CATEGORIAS_ATRATIVO[a.categoria]}
                        </span>
                      </Link>
                    ),
                  };
                })}
              />
              {atrativos.length > ATRATIVOS_NA_CAPA ? (
                <Link
                  href="/atrativos"
                  className={cn(
                    "flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold md:basis-full",
                    atrativos.length <= ATRATIVOS_NA_CAPA_COMPUTADOR && "md:hidden",
                  )}
                >
                  Ver todos os {atrativos.length} atrativos <ArrowRight aria-hidden="true" className="size-[18px]" />
                </Link>
              ) : null}
            </>
          )}
        </section>

        <section id="prestadores" aria-labelledby="titulo-rede" className="flex scroll-mt-4 flex-col gap-2.5 md:gap-5">
          <div className="flex flex-col gap-2.5 md:gap-1.5">
            <h2 id="titulo-rede" className={tituloSecao}>Rede de prestadores</h2>
            <p className="text-[15px] text-muted-foreground md:text-base">Empresas e profissionais que aderiram à rede municipal de turismo.</p>
          </div>
          {categoriasRede.length === 0 ? (
            <Vazio>A rede municipal de prestadores está em formação. Pousadas, restaurantes e guias que aderirem aparecem aqui.</Vazio>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2 pt-1 md:hidden">
                {categoriasRede.map((c) => (
                  <li key={c}>
                    <Link
                      href={`/prestadores?categoria=${c}`}
                      className="flex min-h-11 items-center rounded-full border bg-superficie px-4 text-[15px] font-bold text-foreground no-underline hover:border-foreground hover:text-foreground"
                    >
                      {CATEGORIAS_PRESTADOR[c]}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="hidden gap-4 md:grid md:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
                {prestadoresNaCapa.map((p) => {
                  const foto = capasPrestadores.get(p.id);
                  return (
                    <li key={p.id} className="flex">
                      <Link
                        href={`/prestadores/${p.id}`}
                        className={cn("flex w-full items-center gap-3.5 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:text-foreground", cartao)}
                      >
                        <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, p.nome_publico)} className="size-[88px] shrink-0 rounded-xl" sizes="88px" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[13px] font-bold tracking-[0.05em] text-muted-foreground uppercase">{CATEGORIAS_PRESTADOR[p.categoria]}</span>
                          <span className="text-lg font-bold">{p.nome_publico}</span>
                          <span className="text-sm font-bold text-primary">{p.situacao_rede === "em_adesao" ? "Em adesão à rede" : "Participante da rede"}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href="/prestadores" className="hidden min-h-11 w-fit items-center gap-1.5 font-bold md:flex">
                Ver toda a rede{prestadores.length > PRESTADORES_NA_CAPA ? ` (${prestadores.length})` : ""} <ArrowRight aria-hidden="true" className="size-[18px]" />
              </Link>
            </>
          )}
        </section>
      </main>

      <RodapePortal municipio={municipio} />
    </>
  );
}
