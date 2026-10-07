import { ArrowLeft, Images, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AbrirGaleria, Compartilhar, type FotoGaleria } from "@/components/portal/galeria";
import { FotoPortal } from "@/components/portal/estrutura";
import { urlPublica } from "@/lib/arquivos/url";
import type { Foto } from "@/lib/cadastros/dados";
import { textoAlternativo } from "@/lib/fotos/tratamento";
import { cn } from "@/lib/utils";

/** Fotos do cadastro para a galeria pública, com o texto alternativo "Foto N de <nome>" quando falta legenda. */
export function fotosDaGaleria(fotos: Foto[], nome: string): FotoGaleria[] {
  return fotos.map((f, i) => ({ url: urlPublica(f.caminho), alt: textoAlternativo(f.legenda, i, nome), legenda: f.legenda, credito: f.credito }));
}

const botaoRedondo =
  "absolute top-3 flex size-11 items-center justify-center rounded-full bg-white/95 text-foreground md:hidden";

/** Grade do mosaico a partir de 768 px (tela "Atrativo · detalhe"): 1 foto ocupa tudo; até 5 se reorganiza. */
const GRADE: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:grid-rows-2",
  4: "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-2",
  5: "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-2",
};

/** Largura de cada foto do mosaico, para o navegador baixar só o tamanho certo (item 9.6). */
const LARGURA_CAPA: Record<number, string> = {
  1: "(min-width: 1248px) 1200px, (min-width: 768px) calc(100vw - 48px)",
  2: "(min-width: 1248px) 596px, (min-width: 768px) 50vw",
  3: "(min-width: 1248px) 796px, (min-width: 768px) 66vw",
  4: "(min-width: 1248px) 596px, (min-width: 768px) 50vw",
  5: "(min-width: 1248px) 596px, (min-width: 768px) 50vw",
};
const LARGURA_MENOR: Record<number, string> = {
  2: "(min-width: 1248px) 596px, 50vw",
  3: "(min-width: 1248px) 396px, 33vw",
  4: "(min-width: 1248px) 296px, 25vw",
  5: "(min-width: 1248px) 296px, 25vw",
};

/**
 * Topo das páginas de detalhe. No celular (tela "Atrativo · capa e galeria"): capa em 300 px que
 * abre a galeria, voltar, compartilhar e o total de fotos. A partir de 768 px (tela "Atrativo ·
 * detalhe"): mosaico com até 5 fotos e "Ver as N fotos" quando há mais. `soComputador`: páginas
 * que no celular mostram a foto de outro jeito (atividade). Sem fotos, um espaço reservado discreto.
 */
export function CapaDetalhe({
  fotos,
  nome,
  voltar,
  rotuloVoltar,
  soComputador = false,
}: {
  fotos: Foto[];
  nome: string;
  voltar: string;
  rotuloVoltar: string;
  soComputador?: boolean;
}) {
  const capa = fotos[0];
  const n = Math.min(fotos.length, 5);
  const menores = fotos.slice(1, n);
  if (soComputador && !capa) return null;
  return (
    <div
      data-mosaico={n}
      className={cn(
        "relative mx-auto h-[300px] w-full max-w-xl shrink-0 sm:mt-3 sm:overflow-hidden sm:rounded-[20px]",
        "md:mt-0 md:h-[420px] md:w-[calc(100%-48px)] md:max-w-[1200px] md:gap-2 md:overflow-hidden md:rounded-[22px] lg:h-[508px]",
        capa ? "md:grid" : "",
        GRADE[n] ?? "",
        soComputador && "hidden",
      )}
    >
      {capa ? (
        <AbrirGaleria indice={0} className={cn("absolute inset-0 block size-full p-0 md:relative md:inset-auto md:hover:brightness-95", n >= 3 && "md:row-span-2")}>
          <FotoPortal
            caminho={capa.caminho}
            legenda={textoAlternativo(capa.legenda, 0, nome)}
            className="size-full"
            sizes={`${LARGURA_CAPA[n]}, (min-width: 576px) 576px, 100vw`}
            prioridade={!soComputador}
          />
          <span className="sr-only">. Abrir galeria com {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span>
        </AbrirGaleria>
      ) : (
        <div className="marcador-foto flex size-full items-center justify-center">
          <span className="rounded-md bg-white/85 px-2.5 py-1 text-[13px] text-muted-foreground">[Foto de capa enviada pela prefeitura]</span>
        </div>
      )}
      {menores.map((f, i) => {
        const j = i + 1;
        const ultima = j === n - 1 && fotos.length > n;
        return (
          <AbrirGaleria
            key={f.id}
            indice={j}
            rotulo={ultima ? `Ver todas as ${fotos.length} fotos` : `${textoAlternativo(f.legenda, j, nome)}. Foto ${j + 1} de ${fotos.length}, ampliar`}
            className={cn("relative hidden p-0 md:block md:hover:brightness-95", n === 4 && j === 3 && "md:col-span-2")}
          >
            <FotoPortal caminho={f.caminho} legenda="" className="size-full" sizes={`${LARGURA_MENOR[n]}, 1px`} />
            {ultima ? (
              <span
                aria-hidden="true"
                className="absolute right-3.5 bottom-3.5 flex min-h-10 items-center gap-2 rounded-full bg-[rgba(22,33,27,0.86)] px-3.5 text-[15px] font-bold text-white"
              >
                <Images className="size-[18px]" /> Ver as {fotos.length} fotos
              </span>
            ) : null}
          </AbrirGaleria>
        );
      })}
      <Link href={voltar} aria-label={rotuloVoltar} className={`${botaoRedondo} left-3`}>
        <ArrowLeft aria-hidden="true" className="size-[22px]" />
      </Link>
      <Compartilhar titulo={nome} className={`${botaoRedondo} right-3`} />
      {capa ? (
        <AbrirGaleria
          indice={0}
          className="absolute right-3 bottom-3 flex min-h-11 items-center gap-1.5 rounded-full bg-[rgba(22,33,27,0.82)] px-3 text-sm font-bold text-white md:hidden"
        >
          <Images aria-hidden="true" className="size-4" />
          {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
          <span className="sr-only">: abrir galeria</span>
        </AbrirGaleria>
      ) : null}
    </div>
  );
}

/** Caminho (migalhas) das páginas de detalhe, a partir de 768 px. */
export function Caminho({ municipio, secao, nome }: { municipio: string; secao?: { href: string; rotulo: string }; nome: string }) {
  return (
    <nav aria-label="Caminho" className="mx-auto hidden w-full max-w-[1248px] px-6 pt-3 pb-2 text-[15px] text-muted-foreground md:block">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        <li>
          <Link href="/" className="inline-flex min-h-11 items-center">{municipio}</Link>
        </li>
        {secao ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <Link href={secao.href} className="inline-flex min-h-11 items-center">{secao.rotulo}</Link>
          </li>
        ) : null}
        <li className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="truncate">{nome}</span>
        </li>
      </ol>
    </nav>
  );
}

/**
 * Corpo das páginas de detalhe: uma coluna no celular e até 1023 px; de 1024 px em diante, texto
 * à esquerda e informações à direita (tela "Atrativo · detalhe"). Abaixo de 1024 px as duas
 * colunas são `display: contents`, e cada bloco leva `order-*` para manter a ordem do celular.
 */
export function CorpoDetalhe({ texto, lateral, depois, className }: { texto: React.ReactNode; lateral: React.ReactNode; depois?: React.ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 pt-[18px] pb-10 md:max-w-[1248px] md:px-6 md:pt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start lg:gap-x-10 lg:gap-y-16 lg:pb-0", className)}>
      <div data-coluna="texto" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-7">
        {texto}
      </div>
      <div data-coluna="informacoes" className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        {lateral}
      </div>
      {depois}
    </main>
  );
}

/** "Outros atrativos" e equivalentes: cartões com foto ao pé da página de detalhe, a partir de 768 px. */
export function OutrosCartoes({ titulo, itens }: { titulo: string; itens: { href: string; nome: string; rotulo: string; foto: Foto | undefined }[] }) {
  if (!itens.length) return null;
  return (
    <section aria-labelledby="outros" className="order-last hidden flex-col gap-5 md:flex lg:col-span-2">
      <h2 id="outros" className="text-[30px] font-bold">{titulo}</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5">
        {itens.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="flex flex-col gap-2.5 rounded-2xl text-foreground no-underline transition-transform duration-200 hover:-translate-y-[3px] hover:text-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <FotoPortal caminho={i.foto?.caminho} legenda={textoAlternativo(i.foto?.legenda, 0, i.nome)} className="aspect-[4/3] rounded-2xl" sizes="(min-width: 1248px) 285px, 33vw" />
              <span className="px-1 text-[13px] font-bold tracking-[0.05em] text-muted-foreground uppercase">{i.rotulo}</span>
              <span className="px-1 text-[19px] leading-tight font-bold">{i.nome}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Seção "Fotos" com miniaturas que deslizam (só no celular; no computador, o mosaico). */
export function FaixaFotos({ fotos, nome, className }: { fotos: Foto[]; nome: string; className?: string }) {
  if (fotos.length < 2) return null;
  return (
    <section aria-labelledby="fotos-titulo" className={cn("-mx-4 flex flex-col gap-2.5 md:hidden", className)}>
      <div className="flex items-center justify-between px-4">
        <h2 id="fotos-titulo" className="text-[21px] font-bold">Fotos</h2>
        <AbrirGaleria indice={0} className="flex min-h-11 items-center text-[15px] font-bold text-primary underline-offset-4 hover:underline">
          Ver todas ({fotos.length})
        </AbrirGaleria>
      </div>
      <ul className="flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {fotos.map((f, i) => (
          <li key={f.id} className="shrink-0 snap-start">
            <AbrirGaleria indice={i} rotulo={`${textoAlternativo(f.legenda, i, nome)}. Foto ${i + 1} de ${fotos.length}, ampliar`} className="block p-0">
              <FotoPortal caminho={f.caminho} legenda="" className="size-[120px] rounded-xl" sizes="120px" />
            </AbrirGaleria>
          </li>
        ))}
      </ul>
      <p className="px-4 text-[13px] text-muted-foreground">Deslize para ver mais. Toque para ampliar.</p>
    </section>
  );
}

/** Texto com parágrafos separados por linha em branco (descrições escritas no painel). */
export function Paragrafos({ texto, className }: { texto: string | null | undefined; className?: string }) {
  const partes = (texto ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  return (
    <>
      {partes.map((p, i) => (
        <p key={i} className={className ?? "text-base whitespace-pre-line text-[#2A352E] md:max-w-[68ch] md:text-[17px] md:leading-[1.55]"}>
          {p}
        </p>
      ))}
    </>
  );
}

/**
 * Linha do quadro de informações (horário, acesso, contato...). `dt` e `dd` ficam direto no
 * `div` filho do `dl`, como a lista de definição exige; o ícone vai dentro do `dt`.
 */
export function Linha({ icone: Icone, titulo, children }: { icone: LucideIcon; titulo: string; children: React.ReactNode }) {
  return (
    <div className="relative border-b border-[#E4E7E0] py-3 pr-3.5 pl-[46px] last:border-b-0 md:py-4 md:pr-[18px] md:pl-[54px]">
      <dt className="text-[13px] text-muted-foreground md:text-sm">
        <Icone aria-hidden="true" className="absolute top-3.5 left-3.5 size-5 text-primary md:top-[19px] md:left-[18px] md:size-[22px]" />
        {titulo}
      </dt>
      <dd className="font-bold whitespace-pre-line">{children}</dd>
    </div>
  );
}
