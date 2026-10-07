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
  // O conteúdo só é montado com a galeria aberta: fechada, nenhuma foto é baixada à toa.
  const [aberto, setAberto] = useState(false);
  const total = fotos.length;

  const abrir = useCallback((indice: number) => {
    setAtual(Math.min(Math.max(indice, 0), Math.max(total - 1, 0)));
    setAberto(true);
    dialogo.current?.showModal();
    document.documentElement.style.overflow = "hidden";
  }, [total]);

  const ir = useCallback((indice: number) => setAtual(Math.min(Math.max(indice, 0), total - 1)), [total]);

  // Um botão que fica desativado (seta na primeira ou na última foto) perde o foco, que iria para
  // fora da galeria; o foco passa para a outra seta ou para o botão de fechar.
  useEffect(() => {
    const d = dialogo.current;
    if (!aberto || !d) return;
    // Logo depois da troca, o botão focado já está desativado; em seguida o navegador mandaria o foco ao <body>.
    const ativo = document.activeElement;
    const perdido = !ativo || ativo === document.body || (ativo instanceof HTMLButtonElement && ativo.disabled);
    if (!perdido) return;
    const destino = d.querySelector<HTMLElement>("[data-seta]:not(:disabled)") ?? d.querySelector<HTMLElement>("[data-fechar]");
    destino?.focus();
  }, [atual, aberto]);

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
            setAberto(false);
            document.documentElement.style.overflow = "";
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              ir(atual - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              ir(atual + 1);
            } else if (e.key === "Tab") {
              // Foco preso na galeria: do último volta ao primeiro, e vice-versa.
              const focaveis = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
              const primeiro = focaveis[0];
              const ultimo = focaveis[focaveis.length - 1];
              if (!primeiro || !ultimo) return;
              if (e.shiftKey && (document.activeElement === primeiro || !e.currentTarget.contains(document.activeElement))) {
                e.preventDefault();
                ultimo.focus();
              } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primeiro.focus();
              }
            }
          }}
          className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-[#0E1410] p-0 text-white backdrop:bg-[#0E1410]"
        >
          {aberto ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col lg:max-w-none">
            <div className="flex items-center justify-between px-3 py-2.5 lg:px-5 lg:py-3.5">
              <button
                type="button"
                data-fechar
                onClick={() => dialogo.current?.close()}
                aria-label="Fechar galeria"
                className="flex size-11 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20 lg:order-last lg:size-12"
              >
                <X aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
              </button>
              <span aria-live="polite" aria-atomic="true" className="font-bold lg:order-first">
                <span className="sr-only">Foto </span>
                {atual + 1} de {total}
              </span>
              <span className="w-11 lg:hidden" />
            </div>

            <div
              className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center select-none lg:gap-4 lg:px-5"
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
                <div className="relative size-full lg:order-2 lg:max-w-[1040px] lg:flex-1">
                  <Image
                    key={foto.url}
                    src={foto.url}
                    alt={foto.alt}
                    fill
                    sizes="(min-width: 1024px) min(1040px, calc(100vw - 176px)), (max-width: 768px) 100vw, 768px"
                    className="object-contain"
                    draggable={false}
                  />
                </div>
              ) : null}
              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => ir(atual - 1)}
                    disabled={atual === 0}
                    aria-label="Foto anterior"
                    data-seta
                    className="absolute top-1/2 left-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(14,20,16,0.7)] text-white disabled:opacity-35 lg:static lg:order-1 lg:size-[52px] lg:shrink-0 lg:translate-y-0 lg:bg-white/12 lg:enabled:hover:bg-white/20"
                  >
                    <ChevronLeft aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => ir(atual + 1)}
                    disabled={atual === total - 1}
                    aria-label="Próxima foto"
                    data-seta
                    className="absolute top-1/2 right-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(14,20,16,0.7)] text-white disabled:opacity-35 lg:static lg:order-3 lg:size-[52px] lg:shrink-0 lg:translate-y-0 lg:bg-white/12 lg:enabled:hover:bg-white/20"
                  >
                    <ChevronRight aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex min-h-16 flex-col gap-0.5 px-4 pt-3 pb-1.5 lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[1040px] lg:flex-row lg:flex-wrap lg:justify-between lg:gap-x-5 lg:gap-y-1.5 lg:px-0">
              {foto?.legenda ? <p>{foto.legenda}</p> : null}
              {foto?.credito ? <p className="text-[13px] text-[#B9C2BB] lg:ml-auto lg:text-[15px]">Foto: {foto.credito}</p> : null}
            </div>

            {total > 1 ? (
              <div ref={miniaturas} className="flex gap-1.5 overflow-x-auto px-4 pt-2.5 pb-6 [scrollbar-width:none] lg:justify-center-safe lg:gap-2 lg:px-5 lg:pt-4">
                {fotos.map((f, j) => (
                  <button
                    key={f.url}
                    type="button"
                    data-indice={j}
                    onClick={() => ir(j)}
                    aria-label={`Ver foto ${j + 1} de ${total}`}
                    aria-current={j === atual ? "true" : undefined}
                    className={cn(
                      "relative size-[60px] shrink-0 overflow-hidden rounded-lg border-[3px] p-0 lg:h-[54px] lg:w-[72px] lg:rounded-md",
                      j === atual ? "border-[#C99A3B]" : "border-transparent opacity-60",
                    )}
                  >
                    <Image src={f.url} alt="" fill sizes="(min-width: 1024px) 72px, 60px" className="object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          ) : null}
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
