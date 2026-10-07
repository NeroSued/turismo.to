import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import { urlPublica } from "@/lib/arquivos/url";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { listarMunicipiosDaHome } from "@/lib/municipio/dados";
import { urlDoMunicipio } from "@/lib/municipio/resolver";

const IGNORAR = new Set(["do", "da", "de", "dos", "das"]);

/** Sigla decorativa: iniciais das palavras principais, ou as duas primeiras letras. */
function sigla(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => !IGNORAR.has(p.toLowerCase()));
  const s = palavras.length > 1 ? palavras.slice(0, 2).map((p) => p[0]).join("") : nome.slice(0, 2);
  return s.toUpperCase();
}

function contagem(n: number, um: string, varios: string, nenhum: string) {
  return n === 0 ? nenhum : n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

const PASSOS = [
  "Todas as atividades são gratuitas. Nenhum pagamento é pedido.",
  "Passeios com vagas limitadas pedem reserva. Você recebe um voucher com QR Code, sem criar conta.",
  "Em atrativos de acesso livre, o registro da visita é voluntário e não condiciona a entrada.",
];

/**
 * Home turismo.to. No celular (abaixo de 768 px), a lista compacta de sempre; a partir de 768 px,
 * os cards em duas colunas da tela "turismo.to · home" do canvas de computador (item 9.1).
 */
export default async function Hub() {
  const municipios = await listarMunicipiosDaHome();
  const { NEXT_PUBLIC_ROOT_DOMAIN: raiz } = envPublico();
  const override = overrideDeMunicipioPermitido();
  const dominio = raiz.replace(/:\d+$/, "");
  const impar = municipios.length % 2 === 1;

  return (
    <div className="flex flex-1 flex-col">
      <header className="md:border-b">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-5 md:max-w-[1248px] md:px-6 md:py-[18px]">
        <span className="font-heading text-[22px] font-bold md:text-[26px] md:tracking-[-0.01em]">
          turismo<span className="text-dourado-texto">.to</span>
        </span>
        <span className="text-sm text-muted-foreground md:hidden">Tocantins</span>
        <nav aria-label="Principal" className="hidden gap-1 md:flex">
          <a href="#municipios" className="flex min-h-11 items-center rounded-[10px] px-3.5 font-bold no-underline hover:bg-[#E1E6DC]">
            Municípios
          </a>
          <a href="#como-funciona" className="flex min-h-11 items-center rounded-[10px] px-3.5 font-bold no-underline hover:bg-[#E1E6DC]">
            Como funciona
          </a>
        </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-5 pb-5 md:max-w-[1248px] md:gap-0 md:px-6 md:pt-0 md:pb-0">

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-12 md:gap-y-6 md:pt-16 md:pb-10">
        <div className="flex min-w-0 flex-col md:flex-[999_1_480px] md:gap-3.5">
          <span className="hidden text-sm font-bold tracking-[0.08em] text-muted-foreground uppercase md:block">Tocantins</span>
          <h1 className="text-[30px] leading-[1.08] font-bold md:max-w-[14ch] md:text-[clamp(40px,5vw,64px)] md:leading-[1.02] md:tracking-[-0.025em]">
            Turismo nos municípios participantes
          </h1>
        </div>
        <p className="text-muted-foreground md:max-w-[420px] md:flex-[1_1_320px] md:text-[19px] md:text-[#3D4740]">
          <span className="md:hidden">Escolha um município para ver atrativos, eventos e reservar atividades gratuitas.</span>
          <span className="hidden md:inline">
            Atrativos, calendário de eventos e atividades gratuitas com reserva pelo celular. Escolha um município para começar.
          </span>
        </p>
      </div>

      <div id="municipios" className="scroll-mt-4 md:grid md:grid-cols-2 md:gap-6 md:pb-[72px]">
        <nav aria-label="Municípios" className="flex flex-col gap-2 md:contents">
          {municipios.length === 0 ? (
            <p className="rounded-2xl border bg-superficie p-4 md:col-span-2">
              Nenhum município está ativo no momento. A assessoria ativa cada portal quando a prefeitura estiver pronta para publicar.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 md:contents">
              {municipios.map((m) => (
                <li key={m.slug} className="md:flex">
                  <a
                    href={urlDoMunicipio(m.slug, raiz, override)}
                    data-card-municipio={m.slug}
                    className="group flex min-h-[60px] items-center gap-3 rounded-[14px] border bg-superficie px-3 py-2 text-foreground no-underline hover:text-foreground md:w-full md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:rounded-[20px] md:p-0 md:transition-[transform,box-shadow] md:duration-200 md:hover:-translate-y-[3px] md:hover:shadow-[0_14px_32px_rgba(22,33,27,0.12)] motion-reduce:md:transition-none motion-reduce:md:hover:translate-y-0"
                  >
                    {m.capa ? (
                      <span data-capa className="relative hidden aspect-video md:block">
                        <Image src={urlPublica(m.capa)} alt="" fill sizes="(min-width: 1248px) 588px, 50vw" className="object-cover" />
                      </span>
                    ) : (
                      <span data-iniciais aria-hidden="true" className="hidden aspect-video items-center justify-center bg-[#1F4D3A] md:flex">
                        <span className="font-heading text-8xl font-bold tracking-[-0.03em] text-verde-suave">{sigla(m.nome)}</span>
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-verde-suave text-sm font-bold text-primary md:hidden"
                    >
                      {sigla(m.nome)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight md:gap-2.5 md:px-6 md:pt-[22px] md:pb-6 md:leading-normal">
                      <span className="font-bold md:font-heading md:text-[30px] md:leading-[1.1] md:tracking-[-0.015em]">{m.nome}</span>
                      {m.apresentacao ? <span className="hidden text-base text-[#3D4740] md:block">{m.apresentacao}</span> : null}
                      <span className="hidden flex-wrap gap-2 pt-0.5 md:flex">
                        <span className="rounded-full bg-verde-suave px-2.5 py-1 text-[13px] font-bold text-[#1F4D3A]">
                          {contagem(m.atrativos, "atrativo", "atrativos", "Nenhum atrativo publicado")}
                        </span>
                        <span className="rounded-full bg-dourado-suave px-2.5 py-1 text-[13px] font-bold text-dourado-texto">
                          {contagem(m.atividades, "atividade gratuita", "atividades gratuitas", "Nenhuma atividade aberta")}
                        </span>
                      </span>
                      <span className="md:mt-auto md:flex md:items-center md:justify-between md:gap-3 md:border-t md:border-[#E4E7E0] md:pt-3.5">
                        <span className="text-[13px] text-muted-foreground md:text-sm">
                          {m.slug}.{dominio}
                        </span>
                        <span className="hidden items-center gap-1.5 font-bold text-[#1F4D3A] group-hover:underline md:flex">
                          Ver portal <ArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
                        </span>
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground md:hidden" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <section
          id="como-funciona"
          aria-labelledby="titulo-como-funciona"
          data-como-funciona={impar ? "vaga" : "linha"}
          className={`hidden scroll-mt-4 flex-col justify-center gap-5 rounded-[20px] bg-[#1F4D3A] p-8 text-white md:flex ${impar ? "" : "md:col-span-2"}`}
        >
          <h2 id="titulo-como-funciona" className="text-[28px] leading-[1.1] font-bold">
            Como funcionam as atividades
          </h2>
          <ol className="flex flex-col gap-4">
            {PASSOS.map((p, i) => (
              <li key={i} className="flex gap-3.5">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dourado font-bold text-foreground">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      </main>

      <footer className="md:border-t">
        <div className="mx-auto w-full max-w-xl px-4 pb-6 text-[13px] text-muted-foreground md:flex md:max-w-[1248px] md:flex-wrap md:justify-between md:gap-3 md:px-6 md:pt-7 md:pb-9 md:text-[15px]">
          <p>Cada prefeitura é responsável pelas informações publicadas no seu portal.</p>
          <p className="hidden md:block">turismo.to · Tocantins</p>
        </div>
      </footer>
    </div>
  );
}
