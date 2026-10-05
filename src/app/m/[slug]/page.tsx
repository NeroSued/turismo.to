import Link from "next/link";
import { notFound } from "next/navigation";
import { listarAtividades } from "@/lib/atividades/dados";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";
import { urlDoHub } from "@/lib/municipio/resolver";

export default async function PortalMunicipal({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const nome = municipio.configuracoes_municipio?.nome_exibicao ?? municipio.nome;
  const contato = municipio.configuracoes_municipio?.contato_secretaria;
  const ouvidoria = municipio.configuracoes_municipio?.ouvidoria_url;
  // Só as publicadas, mesmo para um membro logado que enxergue rascunhos pela RLS.
  const atividades = await listarAtividades(municipio.id, true);

  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline hover:text-foreground">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-[10px] border border-dashed bg-verde-suave text-[10px] text-muted-foreground"
          >
            Logo
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Turismo</span>
            <span className="font-heading text-lg font-bold">{nome}</span>
          </span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-1 pb-10">
        <section className="flex flex-col gap-4">
          <div className="flex h-[200px] items-end rounded-[20px] border border-dashed bg-verde-suave p-3">
            <span className="rounded-md bg-superficie px-2 py-1 text-xs text-muted-foreground">
              [Foto oficial cedida pela prefeitura]
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[42px] leading-none font-bold tracking-[-0.02em]">{nome}</h1>
            <p className="text-[17px] text-muted-foreground">
              Atrativos, eventos e atividades gratuitas, com reserva pelo celular.
            </p>
          </div>
        </section>

        <section aria-labelledby="atividades" className="flex flex-col gap-3">
          <h2 id="atividades" className="text-[23px] font-bold">Atividades com voucher</h2>
          {atividades.length === 0 ? (
            <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
              Nenhuma atividade publicada ainda. Quando a Secretaria de Turismo abrir reservas gratuitas
              ou registros de visita, elas aparecem aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {atividades.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/atividades/${a.id}`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border bg-superficie p-3.5 text-foreground no-underline hover:border-primary hover:text-foreground"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[17px] font-bold">{a.titulo}</span>
                      <span className="text-sm text-muted-foreground">
                        {a.modo === "reserva" ? "Reserva gratuita com data e horário" : "Registro voluntário · acesso livre"}
                        {a.local_encontro ? ` · ${a.local_encontro}` : ""}
                      </span>
                      <span className="w-fit rounded-full bg-dourado-suave px-2 py-0.5 text-xs font-bold text-dourado-texto">
                        Gratuito
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-primary">{a.modo === "reserva" ? "Reservar" : "Registrar"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="eventos" className="flex flex-col gap-3">
          <h2 id="eventos" className="text-[23px] font-bold">Próximos eventos</h2>
          <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
            Nenhum evento divulgado por enquanto.
          </p>
        </section>
      </main>

      <footer className="bg-primary px-4 pt-8 pb-9 text-primary-foreground">
        <div className="mx-auto flex max-w-xl flex-col gap-3.5">
          <h2 className="text-xl font-bold">Secretaria Municipal de Turismo</h2>
          <p>{contato ?? "[Contato da Secretaria de Turismo]"}</p>
          <div className="flex flex-col">
            {ouvidoria ? (
              <a href={ouvidoria} className="flex min-h-11 items-center font-bold text-white hover:text-white">
                Ouvidoria do município
              </a>
            ) : null}
            <a
              href={urlDoHub(envPublico().NEXT_PUBLIC_ROOT_DOMAIN, overrideDeMunicipioPermitido())}
              className="flex min-h-11 items-center font-bold text-white hover:text-white"
            >
              Outros municípios do Tocantins
            </a>
          </div>
          <p className="border-t border-white/30 pt-3 text-sm">
            Todas as atividades deste portal são gratuitas. Nenhum pagamento é solicitado.
          </p>
        </div>
      </footer>
    </>
  );
}
