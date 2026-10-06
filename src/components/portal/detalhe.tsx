import { ArrowLeft, Images, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AbrirGaleria, Compartilhar, type FotoGaleria } from "@/components/portal/galeria";
import { FotoPortal } from "@/components/portal/estrutura";
import { urlPublica } from "@/lib/arquivos/url";
import type { Foto } from "@/lib/cadastros/dados";
import { textoAlternativo } from "@/lib/fotos/tratamento";

/** Fotos do cadastro para a galeria pública, com o texto alternativo "Foto N de <nome>" quando falta legenda. */
export function fotosDaGaleria(fotos: Foto[], nome: string): FotoGaleria[] {
  return fotos.map((f, i) => ({ url: urlPublica(f.caminho), alt: textoAlternativo(f.legenda, i, nome), legenda: f.legenda, credito: f.credito }));
}

const botaoRedondo =
  "absolute top-3 flex size-11 items-center justify-center rounded-full bg-white/95 text-foreground";

/**
 * Topo das páginas de detalhe (tela "Atrativo · capa e galeria"): capa em 300 px que abre a
 * galeria, voltar, compartilhar e o total de fotos. Sem fotos, um espaço reservado discreto.
 */
export function CapaDetalhe({
  fotos,
  nome,
  voltar,
  rotuloVoltar,
}: {
  fotos: Foto[];
  nome: string;
  voltar: string;
  rotuloVoltar: string;
}) {
  const capa = fotos[0];
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-xl shrink-0 sm:mt-3 sm:overflow-hidden sm:rounded-[20px]">
      {capa ? (
        <AbrirGaleria indice={0} className="absolute inset-0 block size-full p-0">
          <FotoPortal caminho={capa.caminho} legenda={textoAlternativo(capa.legenda, 0, nome)} className="size-full" sizes="(max-width: 576px) 100vw, 576px" prioridade />
          <span className="sr-only">. Abrir galeria com {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}</span>
        </AbrirGaleria>
      ) : (
        <div className="marcador-foto flex size-full items-center justify-center">
          <span className="rounded-md bg-white/85 px-2.5 py-1 text-[13px] text-muted-foreground">[Foto de capa enviada pela prefeitura]</span>
        </div>
      )}
      <Link href={voltar} aria-label={rotuloVoltar} className={`${botaoRedondo} left-3`}>
        <ArrowLeft aria-hidden="true" className="size-[22px]" />
      </Link>
      <Compartilhar titulo={nome} className={`${botaoRedondo} right-3`} />
      {capa ? (
        <AbrirGaleria
          indice={0}
          className="absolute right-3 bottom-3 flex min-h-11 items-center gap-1.5 rounded-full bg-[rgba(22,33,27,0.82)] px-3 text-sm font-bold text-white"
        >
          <Images aria-hidden="true" className="size-4" />
          {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
          <span className="sr-only">: abrir galeria</span>
        </AbrirGaleria>
      ) : null}
    </div>
  );
}

/** Seção "Fotos" com miniaturas que deslizam; cada uma abre a galeria naquela foto. */
export function FaixaFotos({ fotos, nome }: { fotos: Foto[]; nome: string }) {
  if (fotos.length < 2) return null;
  return (
    <section aria-labelledby="fotos-titulo" className="-mx-4 flex flex-col gap-2.5">
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
        <p key={i} className={className ?? "text-base whitespace-pre-line text-[#2A352E]"}>
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
    <div className="relative border-b border-[#E4E7E0] py-3 pr-3.5 pl-[46px] last:border-b-0">
      <dt className="text-[13px] text-muted-foreground">
        <Icone aria-hidden="true" className="absolute top-3.5 left-3.5 size-5 text-primary" />
        {titulo}
      </dt>
      <dd className="font-bold whitespace-pre-line">{children}</dd>
    </div>
  );
}
