import { ArrowLeft, ExternalLink, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { urlPublica } from "@/lib/arquivos/url";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import type { Municipio } from "@/lib/municipio/dados";
import { urlDoHub } from "@/lib/municipio/resolver";
import { cn } from "@/lib/utils";

export function nomeDoMunicipio(m: Municipio) {
  return m.configuracoes_municipio?.nome_exibicao ?? m.nome;
}

/** Foto do bucket público, otimizada pelo next/image. Sem foto: espaço reservado decorativo. */
export function FotoPortal({
  caminho,
  legenda,
  className,
  sizes,
  prioridade,
}: {
  caminho: string | null | undefined;
  legenda: string;
  className?: string;
  sizes: string;
  prioridade?: boolean;
}) {
  if (!caminho) return <div aria-hidden="true" className={cn("marcador-foto", className)} />;
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image src={urlPublica(caminho)} alt={legenda} fill sizes={sizes} className="object-cover" preload={prioridade} />
    </div>
  );
}

const MENU = [
  { href: "/#atividades", rotulo: "Atividades com voucher" },
  { href: "/eventos", rotulo: "Calendário de eventos" },
  { href: "/atrativos", rotulo: "Atrativos" },
  { href: "/prestadores", rotulo: "Rede de prestadores" },
  { href: "/#contato", rotulo: "Contato da Secretaria" },
  { href: "/privacidade", rotulo: "Aviso de privacidade" },
];

/** Cabeçalho do portal (tela "Portal municipal"): logo, nome e menu. */
export function CabecalhoPortal({ municipio }: { municipio: Municipio }) {
  const nome = nomeDoMunicipio(municipio);
  const logo = municipio.configuracoes_municipio?.logo_caminho;
  return (
    <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
      <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline hover:text-foreground">
        {logo ? (
          <Image src={urlPublica(logo)} alt={`Logo de ${nome}`} width={40} height={40} className="size-10 rounded-[10px] object-contain" />
        ) : (
          <span aria-hidden="true" className="marcador-foto flex size-10 items-center justify-center rounded-[10px] text-[10px] text-muted-foreground">
            Logo
          </span>
        )}
        <span className="flex flex-col leading-tight">
          <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Turismo</span>
          <span className="font-heading text-lg font-bold">{nome}</span>
        </span>
      </Link>
      <details className="group relative">
        <summary
          aria-label="Abrir menu"
          className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border bg-superficie text-foreground [&::-webkit-details-marker]:hidden"
        >
          <Menu aria-hidden="true" className="size-[22px]" />
        </summary>
        <nav aria-label="Menu do portal" className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border bg-superficie p-2 shadow-lg">
          <ul className="flex flex-col">
            {MENU.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex min-h-11 items-center rounded-xl px-3 font-bold text-foreground no-underline hover:bg-background">
                  {i.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </details>
    </header>
  );
}

/** Cabeçalho das páginas internas do portal: voltar e título. */
export function CabecalhoInterno({ titulo, voltar = "/", rotuloVoltar = "Voltar ao portal" }: { titulo: string; voltar?: string; rotuloVoltar?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2.5">
      <Link href={voltar} aria-label={rotuloVoltar} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground">
        <ArrowLeft aria-hidden="true" className="size-[22px]" />
      </Link>
      <span className="truncate text-xl font-bold font-heading">{titulo}</span>
    </header>
  );
}

/** Rodapé com a Secretaria de Turismo, Ouvidoria oficial e aviso de privacidade. */
export function RodapePortal({ municipio }: { municipio: Municipio }) {
  const c = municipio.configuracoes_municipio;
  return (
    <footer id="contato" className="bg-primary px-4 pt-8 pb-9 text-primary-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-3.5">
        <h2 className="text-xl font-bold">Secretaria Municipal de Turismo</h2>
        <p className="text-[15px] whitespace-pre-line">{c?.contato_secretaria ?? "[Contato da Secretaria de Turismo]"}</p>
        <div className="flex flex-col pt-1.5">
          {c?.ouvidoria_url ? (
            <a href={c.ouvidoria_url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center gap-2 font-bold text-white hover:text-white">
              Ouvidoria do município
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">(abre o site oficial em outra aba)</span>
            </a>
          ) : null}
          <Link href="/privacidade" className="flex min-h-11 w-fit items-center font-bold text-white hover:text-white">
            Aviso de privacidade
          </Link>
          <a
            href={urlDoHub(envPublico().NEXT_PUBLIC_ROOT_DOMAIN, overrideDeMunicipioPermitido())}
            className="flex min-h-11 w-fit items-center font-bold text-white hover:text-white"
          >
            Outros municípios do Tocantins
          </a>
        </div>
        <p className="border-t border-white/30 pt-3 text-sm">
          Todas as atividades deste portal são gratuitas. Nenhum pagamento é solicitado.
        </p>
      </div>
    </footer>
  );
}

/** Estado vazio de uma seção do portal: diz o que acontece e o que fazer. */
export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">{children}</p>;
}
