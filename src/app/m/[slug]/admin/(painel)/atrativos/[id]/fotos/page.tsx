import type { Metadata } from "next";
import { TelaFotos } from "@/components/painel/tela-fotos";

export const metadata: Metadata = { title: "Fotos" };

export default async function Fotos({ params }: PageProps<"/m/[slug]/admin/atrativos/[id]/fotos">) {
  const { slug, id } = await params;
  return <TelaFotos slug={slug} tipo="atrativos" id={id} />;
}
