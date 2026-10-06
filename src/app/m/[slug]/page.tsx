import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPortal, FotoPortal, nomeDoMunicipio, RodapePortal, Vazio } from "@/components/portal/estrutura";
import { buttonVariants } from "@/components/ui/button";
import { listarAtrativos, listarEventos, listarPrestadores, primeiraFotoDe } from "@/lib/cadastros/dados";
import { CATEGORIAS_ATRATIVO, CATEGORIAS_PRESTADOR, type CategoriaPrestador } from "@/lib/cadastros/esquemas";
import { formatarDataComSemana, formatarHora } from "@/lib/datas";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { atividadesPublicadas, proximosHorarios } from "@/lib/portal/dados";
import { BlocoData, horarioDoEvento } from "@/components/portal/eventos";

const ATRATIVOS_NA_CAPA = 6;
const EVENTOS_NA_CAPA = 3;

/** Portal municipal conforme a tela "Portal municipal" do canvas. Só conteúdo publicado. */
export default async function PortalMunicipal({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const nome = nomeDoMunicipio(municipio);
  const capa = municipio.configuracoes_municipio?.capa_caminho;

  const [atividades, horarios, eventos, atrativos, prestadores] = await Promise.all([
    atividadesPublicadas(municipio.id),
    proximosHorarios(municipio.id),
    listarEventos(municipio.id, { publicados: true, aPartirDe: new Date(), limite: EVENTOS_NA_CAPA }),
    listarAtrativos(municipio.id, { publicados: true }),
    listarPrestadores(municipio.id, { publicados: true }),
  ]);
  const idsAtrativos = [...new Set([...atrativos.map((a) => a.id), ...atividades.flatMap((a) => (a.atrativo_id ? [a.atrativo_id] : []))])];
  const [fotos, capasAtividades] = await Promise.all([
    primeiraFotoDe(municipio.id, "atrativo_id", idsAtrativos),
    primeiraFotoDe(municipio.id, "atividade_id", atividades.map((a) => a.id)),
  ]);

  const reservas = atividades.filter((a) => a.modo === "reserva");
  const registro = atividades.find((a) => a.modo === "registro_voluntario");
  const categoriasRede = (Object.keys(CATEGORIAS_PRESTADOR) as CategoriaPrestador[]).filter((c) => prestadores.some((p) => p.categoria === c));

  return (
    <>
      <CabecalhoPortal municipio={municipio} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-1 pb-10">
        <section className="flex flex-col gap-[18px]">
          {capa ? (
            <FotoPortal caminho={capa} legenda={`Foto de ${nome}`} className="h-60 rounded-[20px]" sizes="(max-width: 576px) 100vw, 544px" prioridade />
          ) : (
            <div className="marcador-foto flex h-60 items-end rounded-[20px] p-3">
              <span className="rounded-md bg-superficie px-2 py-1 text-xs text-muted-foreground">[Foto oficial cedida pela prefeitura]</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[42px] leading-none font-bold tracking-[-0.02em]">{nome}</h1>
            <p className="text-[17px] text-muted-foreground">Atrativos, eventos e atividades gratuitas, com reserva pelo celular.</p>
          </div>
          {reservas.length || registro ? (
            <div className="flex flex-col gap-2.5">
              {reservas.length ? (
                <Link
                  href={reservas.length === 1 ? `/atividades/${reservas[0].id}` : "#atividades"}
                  className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}
                >
                  Reservar atividade gratuita <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
              ) : null}
              {registro ? (
                <>
                  <Link href={`/atividades/${registro.id}`} className={buttonVariants({ variant: "contorno", size: "lg", className: "no-underline" })}>
                    Registrar minha visita
                  </Link>
                  <p className="text-center text-sm text-muted-foreground">O registro é voluntário e não condiciona a entrada nos atrativos.</p>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        <section id="atividades" aria-labelledby="titulo-atividades" className="flex scroll-mt-4 flex-col gap-3">
          <h2 id="titulo-atividades" className="text-[23px] font-bold">Atividades com voucher</h2>
          {atividades.length === 0 ? (
            <Vazio>
              Nenhuma atividade aberta no momento. Quando a Secretaria de Turismo abrir reservas gratuitas ou registros de
              visita, elas aparecem aqui. Enquanto isso, veja os atrativos e o calendário de eventos.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {atividades.map((a) => {
                const h = horarios.get(a.id);
                // Capa da atividade; sem ela, a do atrativo onde acontece.
                const foto = capasAtividades.get(a.id) ?? (a.atrativo_id ? fotos.get(a.atrativo_id) : undefined);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/atividades/${a.id}`}
                      className="flex gap-3 rounded-2xl border bg-superficie p-3 text-foreground no-underline hover:border-primary hover:text-foreground"
                    >
                      <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, a.titulo)} className="size-[88px] shrink-0 rounded-xl" sizes="88px" />
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        {a.modo === "reserva" ? (
                          <span className="w-fit rounded-full bg-verde-suave px-2 py-0.5 text-xs font-bold text-primary">Reserva gratuita</span>
                        ) : (
                          <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">Registro voluntário</span>
                        )}
                        <span className="text-[17px] font-bold">{a.titulo}</span>
                        {a.modo === "reserva" ? (
                          <span className="text-sm text-muted-foreground">
                            {h ? `Próximo horário: ${formatarDataComSemana(h.inicio)}, ${formatarHora(h.inicio)}` : "Novos horários em breve"}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Entrada livre · o registro ajuda a prefeitura a planejar</span>
                        )}
                        {a.modo === "reserva" && h ? (
                          <span className="text-sm text-muted-foreground">
                            {h.restantes === null ? "Sem limite de vagas" : `Restam ${h.restantes} vagas nesse horário`}
                          </span>
                        ) : a.local_encontro ? (
                          <span className="text-sm text-muted-foreground">{a.local_encontro}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-eventos" className="flex flex-col gap-3">
          <h2 id="titulo-eventos" className="text-[23px] font-bold">Próximos eventos</h2>
          {eventos.length === 0 ? (
            <Vazio>Nenhum evento divulgado por enquanto. Festas, feiras e festivais aparecem aqui assim que a Secretaria publicar.</Vazio>
          ) : (
            <ul className="flex flex-col">
              {eventos.map((e) => (
                <li key={e.id}>
                  <Link href={`/eventos/${e.id}`} className="flex items-center gap-3.5 border-b py-2.5 text-foreground no-underline hover:text-foreground">
                    <BlocoData inicio={e.inicio} fim={e.fim} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[17px] font-bold">{e.titulo}</span>
                      <span className="text-sm text-muted-foreground">
                        {[e.local, horarioDoEvento(e.inicio, e.fim)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/eventos" className="flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold">
            <CalendarDays aria-hidden="true" className="size-[18px]" /> Ver calendário completo
          </Link>
        </section>

        <section aria-labelledby="titulo-atrativos" className="flex flex-col gap-3">
          <h2 id="titulo-atrativos" className="text-[23px] font-bold">Atrativos</h2>
          {atrativos.length === 0 ? (
            <Vazio>Os atrativos turísticos do município estão sendo cadastrados pela Secretaria de Turismo e aparecem aqui em breve.</Vazio>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                {atrativos.slice(0, ATRATIVOS_NA_CAPA).map((a) => {
                  const foto = fotos.get(a.id);
                  return (
                    <li key={a.id}>
                      <Link href={`/atrativos/${a.id}`} className="flex flex-col gap-1.5 text-foreground no-underline hover:text-foreground">
                        <FotoPortal caminho={foto?.caminho} legenda={textoAlternativo(foto?.legenda, 0, a.nome)} className="h-[124px] rounded-[14px]" sizes="(max-width: 576px) 50vw, 270px" />
                        <span className="leading-tight font-bold">{a.nome}</span>
                        <span className="text-[13px] text-muted-foreground">{CATEGORIAS_ATRATIVO[a.categoria]}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {atrativos.length > ATRATIVOS_NA_CAPA ? (
                <Link href="/atrativos" className="flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold">
                  Ver todos os {atrativos.length} atrativos <ArrowRight aria-hidden="true" className="size-[18px]" />
                </Link>
              ) : null}
            </>
          )}
        </section>

        <section aria-labelledby="titulo-rede" className="flex flex-col gap-2.5">
          <h2 id="titulo-rede" className="text-[23px] font-bold">Rede de prestadores</h2>
          <p className="text-[15px] text-muted-foreground">Empresas e profissionais que aderiram à rede municipal de turismo.</p>
          {categoriasRede.length === 0 ? (
            <Vazio>A rede municipal de prestadores está em formação. Pousadas, restaurantes e guias que aderirem aparecem aqui.</Vazio>
          ) : (
            <ul className="flex flex-wrap gap-2 pt-1">
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
          )}
        </section>
      </main>

      <RodapePortal municipio={municipio} />
    </>
  );
}
