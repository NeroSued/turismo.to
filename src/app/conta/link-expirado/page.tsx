import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";

export const metadata: Metadata = { title: "Link expirado", robots: { index: false } };

export default function LinkExpirado() {
  return (
    <Pagina>
      <h1 className="text-[30px] leading-tight font-bold">Este link não vale mais</h1>
      <p>
        Links de convite e de nova senha funcionam uma única vez e expiram depois de algum tempo.
      </p>
      <p className="text-muted-foreground">
        Abra o portal do seu município, entre em “Painel”, toque em “Esqueci minha senha” e peça um
        novo link. Se você ainda não tem conta, peça um novo convite à assessoria.
      </p>
    </Pagina>
  );
}
