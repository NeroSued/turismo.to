import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { LeitorQr } from "@/components/painel/leitor-qr";
import { buttonVariants } from "@/components/ui/button";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Atendimento" };

export default async function Atendimento({ params }: PageProps<"/m/[slug]/admin/atendimento">) {
  const { slug } = await params;
  await exigirPainel(slug, ["gestor", "operador"]);
  return (
    <Pagina className="gap-4 pt-2">
      <h1 className="text-[26px] font-bold">Atendimento</h1>
      <LeitorQr />
      <Link
        href="/admin/vouchers/emitir"
        className={buttonVariants({ variant: "outline", size: "lg", className: "border-[1.5px] border-foreground no-underline" })}
      >
        <Plus aria-hidden="true" className="size-5" /> Emitir voucher para visitante sem celular
      </Link>
    </Pagina>
  );
}
