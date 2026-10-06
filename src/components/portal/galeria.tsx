"use client";

import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type FotoGaleria = { url: string; alt: string; legenda: string | null; credito: string | null };

const AbrirContexto = createContext<(indice: number) => void>(() => {});

/**
 * Galeria em tela cheia (tela "Galeria · tela cheia"), num <dialog> nativo: o leitor de tela
 * anuncia o diálogo, o foco fica dentro dele, Esc fecha e o foco volta para quem abriu.
 * Setas do teclado e deslizar o dedo trocam de foto; o contador é anunciado a cada troca.
 */
export function GaleriaProvider({ fotos, nome, children }: { fotos: FotoGaleria[]; nome: string; children: React.ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const miniaturas = useRef<HTMLDivElement>(null);
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  const [atual, setAtual] = useState(0);
  const total = fotos.length;

  const abrir = useCallback((indice: number) => {
    setAtual(Math.min(Math.max(indice, 0), Math.max(total - 1, 0)));
    dialogo.current?.showModal();
    document.documentElement.style.overflow = "hidden";
  }, [total]);

  const ir = useCallback((indice: number) => setAtual(Math.min(Math.max(indice, 0), total - 1)), [total]);

  useEffect(() => {
    miniaturas.current?.querySelector<HTMLElement>(`[data-indice="${atual}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [atual]);

  const foto = fotos[atual];

  return (
    <AbrirContexto.Provider value={abrir}>
      {children}
      {total ? (
        <dialog
          ref={dialogo}
          aria-label={`Galeria de fotos de ${nome}`}
          onClose={() => {
            document.documentElement.style.overflow = "";
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              ir(atual - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              ir(atual + 1);
            }
          }}
          className="m-0 h-dvh max-h-none w-full max-w-none bg-[#0E1410] p-0 text-white backdrop:bg-[#0E1410]"
        >
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            <div className="flex items-center justify-between px-3 py-2.5">
              <button
                type="button"
                onClick={() => dialogo.current?.close()}
                aria-label="Fechar galeria"
                className="flex size-11 items-center justify-center rounded-full bg-white/12 text-white"
              >
                <X aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
              </button>
              <span aria-live="polite" aria-atomic="true" className="font-bold">
                <span className="sr-only">Foto </span>
                {atual + 1} de {total}
              </span>
              <span className="w-11" />
            </div>

            <div
              className="relative flex flex-1 touch-pan-y items-center justify-center select-none"
              onPointerDown={(e) => {
                inicioToque.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => {
                const ini = inicioToque.current;
                inicioToque.current = null;
                if (!ini) return;
                const dx = e.clientX - ini.x;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - ini.y)) ir(dx < 0 ? atual + 1 : atual - 1);
              }}
              onPointerCancel={() => {
                inicioToque.current = null;
              }}
            >
              {foto ? (
                <div className="relative size-full">
                  <Image key={foto.url} src={foto.url} alt={foto.alt} fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" draggable={false} />
                </div>
              ) : null}
              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => ir(atual - 1)}
                    disabled={atual === 0}
                    aria-label="Foto anterior"
                    className="absolute top-1/2 left-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(14,20,16,0.7)] text-white disabled:opacity-35"
                  >
                    <ChevronLeft aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => ir(atual + 1)}
                    disabled={atual === total - 1}
                    aria-label="Próxima foto"
                    className="absolute top-1/2 right-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(14,20,16,0.7)] text-white disabled:opacity-35"
                  >
                    <ChevronRight aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex min-h-16 flex-col gap-0.5 px-4 pt-3 pb-1.5">
              {foto?.legenda ? <p>{foto.legenda}</p> : null}
              {foto?.credito ? <p className="text-[13px] text-[#B9C2BB]">Foto: {foto.credito}</p> : null}
            </div>

            {total > 1 ? (
              <div ref={miniaturas} className="flex gap-1.5 overflow-x-auto px-4 pt-2.5 pb-6 [scrollbar-width:none]">
                {fotos.map((f, j) => (
                  <button
                    key={f.url}
                    type="button"
                    data-indice={j}
                    onClick={() => ir(j)}
                    aria-label={`Ver foto ${j + 1} de ${total}`}
                    aria-current={j === atual ? "true" : undefined}
                    className={cn(
                      "relative size-[60px] shrink-0 overflow-hidden rounded-lg border-[3px] p-0",
                      j === atual ? "border-[#C99A3B]" : "border-transparent opacity-60",
                    )}
                  >
                    <Image src={f.url} alt="" fill sizes="60px" className="object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </AbrirContexto.Provider>
  );
}

/** Botão que abre a galeria na foto `indice` (capa, miniatura ou "Ver todas"). */
export function AbrirGaleria({ indice, rotulo, className, children }: { indice: number; rotulo?: string; className?: string; children: React.ReactNode }) {
  const abrir = useContext(AbrirContexto);
  return (
    <button type="button" onClick={() => abrir(indice)} aria-label={rotulo} className={className}>
      {children}
    </button>
  );
}

/** Compartilhar a página: menu do celular quando existe; senão, copia o link. */
export function Compartilhar({ titulo, className }: { titulo: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Compartilhar"
        className={className}
        onClick={async () => {
          const url = window.location.href;
          try {
            if (navigator.share) await navigator.share({ title: titulo, url });
            else {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 3000);
            }
          } catch {
            // A pessoa cancelou o compartilhamento: nada a fazer.
          }
        }}
      >
        <Share2 aria-hidden="true" className="size-5" />
      </button>
      <span role="status" className="sr-only">
        {copiado ? "Link copiado." : ""}
      </span>
    </>
  );
}
