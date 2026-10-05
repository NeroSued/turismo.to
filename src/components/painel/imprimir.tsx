"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre a impressão do navegador, que também salva em PDF ("Salvar como PDF" no destino). */
export function BotaoImprimirPdf({ className }: { className?: string }) {
  return (
    <Button type="button" size="lg" variant="outline" className={className} onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-5" /> Imprimir ou salvar PDF
    </Button>
  );
}
