"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type CartaoAtrativo = { id: string; categoria: string; rotulo: string; cartao: React.ReactNode };

/**
 * Grade de atrativos do portal com filtro por categoria (tela "Portal municipal" do canvas de
 * computador). Só aparecem as categorias que existem entre os publicados. No celular, sem filtro,
 * os mesmos 6 primeiros de sempre; a partir de 768 px, até `limite` por filtro.
 */
export function GradeAtrativos({ itens, limite, limiteCelular }: { itens: CartaoAtrativo[]; limite: number; limiteCelular: number }) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const categorias = [...new Map(itens.map((i) => [i.categoria, i.rotulo])).entries()];
  const visiveis = (filtro ? itens.filter((i) => i.categoria === filtro) : itens).slice(0, limite);
  const opcoes: [string | null, string][] = [[null, "Todos"], ...categorias];

  return (
    <>
      {categorias.length > 1 ? (
        <div role="group" aria-label="Filtrar por categoria" className="hidden flex-wrap gap-2 md:flex">
          {opcoes.map(([c, rotulo]) => (
            <button
              key={c ?? "todos"}
              type="button"
              aria-pressed={filtro === c}
              onClick={() => setFiltro(c)}
              className={cn(
                "min-h-11 rounded-full border-[1.5px] px-4 text-[15px] font-bold",
                filtro === c ? "border-foreground bg-foreground text-white" : "border-border bg-superficie text-foreground hover:border-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {filtro ? `${visiveis.length} ${visiveis.length === 1 ? "atrativo" : "atrativos"} em ${categorias.find(([c]) => c === filtro)?.[1]}` : ""}
      </p>
      <ul
        className="grid grid-cols-2 gap-3 md:basis-full md:grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] md:gap-5"
      >
        {visiveis.map((i, n) => (
          <li key={i.id} className={cn(!filtro && n >= limiteCelular && "max-md:hidden")}>
            {i.cartao}
          </li>
        ))}
      </ul>
    </>
  );
}
