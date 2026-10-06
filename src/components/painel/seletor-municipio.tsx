"use client";

import { Check, ChevronDown, LayoutGrid, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

export type OpcaoMunicipio = { slug: string; nome: string; href: string; endereco: string };

/**
 * Cabeçalho do painel com troca de município (tela "Assessoria · trocar município").
 * Folha inferior em <dialog> nativo: Esc fecha, o foco fica dentro e volta ao botão.
 */
export function SeletorMunicipio({
  rotuloPapel,
  atual,
  opcoes,
  compartilhada,
  admin,
}: {
  rotuloPapel: string;
  atual: { slug: string; nome: string };
  opcoes: OpcaoMunicipio[];
  compartilhada: boolean;
  admin: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-haspopup="dialog"
        className="-ml-1 flex min-h-12 items-center gap-2 rounded-xl pr-2.5 pl-1 text-left text-foreground"
      >
        <span className="flex flex-col leading-tight">
          <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">Painel · {rotuloPapel}</span>
          <span className="font-heading text-xl font-bold">{atual.nome}</span>
        </span>
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-verde-suave text-primary">
          <ChevronDown className="size-[18px]" strokeWidth={2.2} />
        </span>
        <span className="sr-only">Trocar de município</span>
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby="troca-titulo"
        onClick={(e) => {
          // Toque fora da folha (no fundo escurecido) fecha.
          if (e.target === dialogo.current) dialogo.current.close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-superficie p-0 text-foreground shadow-[0_-8px_24px_rgba(14,20,16,0.18)] backdrop:bg-[rgba(14,20,16,0.5)] sm:mx-auto sm:max-w-xl"
      >
        <div className="flex flex-col gap-3 px-4 pt-2 pb-5">
          <div aria-hidden="true" className="my-1 h-[5px] w-11 self-center rounded-full bg-border" />
          <div className="flex items-center justify-between">
            <h2 id="troca-titulo" className="text-[21px] font-bold">Trocar de município</h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Fechar"
              className="flex size-11 items-center justify-center rounded-full bg-background text-foreground"
            >
              <X aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {compartilhada
              ? "Você continua conectado. O painel abre no endereço do município escolhido."
              : "O painel abre no endereço do município escolhido. Neste ambiente, cada endereço pede para entrar de novo."}
          </p>
          <nav aria-label="Municípios">
            <ul className="flex flex-col">
              {opcoes.map((m) => {
                const ativo = m.slug === atual.slug;
                return (
                  <li key={m.slug} className="border-b border-[#E4E7E0] last:border-b-0">
                    <a
                      href={m.href}
                      aria-current={ativo ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-[10px] px-2 text-foreground no-underline hover:text-foreground ${ativo ? "bg-[#EEF3EF]" : ""}`}
                    >
                      <span className="flex flex-1 flex-col leading-tight">
                        <span className="font-bold">{m.nome}</span>
                        <span className="text-[13px] text-muted-foreground">{m.endereco}</span>
                      </span>
                      {ativo ? <Check aria-hidden="true" className="size-[22px] text-primary" strokeWidth={2.4} /> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          {admin ? (
            <Link
              href="/admin/assessoria"
              onClick={() => dialogo.current?.close()}
              className="flex min-h-12 items-center gap-2 font-bold"
            >
              <LayoutGrid aria-hidden="true" className="size-[18px]" /> Painel da assessoria (todos os municípios)
            </Link>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
