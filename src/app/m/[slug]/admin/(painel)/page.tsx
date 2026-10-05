import { redirect } from "next/navigation";
import { Pagina } from "@/components/pagina";
import { exigirPainel } from "@/lib/painel/contexto";

export default async function VisaoGeral({ params }: PageProps<"/m/[slug]/admin">) {
  const { slug } = await params;
  const { papel } = await exigirPainel(slug);
  // O operador vê só atendimento e emissão (CLAUDE.md, "Interface").
  if (papel === "operador") redirect("/admin/atendimento");

  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Visão geral</h1>
    </Pagina>
  );
}
