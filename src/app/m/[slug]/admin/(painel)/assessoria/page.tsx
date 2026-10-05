import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { AlternarMunicipio, ConcederAdmin, RemoverAdmin } from "@/components/painel/assessoria";
import { Voltar } from "@/components/painel/telas-cadastro";
import { listarAdmins } from "@/lib/equipe/dados";
import { listarMunicipiosDoPainel } from "@/lib/municipio/dados";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Assessoria" };

/** Área do admin da assessoria (item 4.1): municípios, ativação, configurações e equipe de cada um. */
export default async function Assessoria({ params }: PageProps<"/m/[slug]/admin/assessoria">) {
  const { slug } = await params;
  const { userId } = await exigirPainel(slug, ["admin"]);
  const [municipios, admins] = await Promise.all([listarMunicipiosDoPainel(), listarAdmins()]);

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/mais" rotulo="Mais" />
      <h1 className="text-[26px] font-bold">Assessoria</h1>
      <p className="text-muted-foreground">
        Municípios atendidos. Portal desativado não abre para o público nem para a equipe da prefeitura.
      </p>

      <section aria-labelledby="municipios" className="flex flex-col gap-3">
        <h2 id="municipios" className="text-xl font-bold">Municípios</h2>
        <ul className="flex flex-col gap-3">
          {municipios.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
              <Link href={`/admin/assessoria/${m.slug}`} className="flex min-h-11 items-center gap-3 text-foreground no-underline">
                <span className="flex flex-1 flex-col">
                  <span className="text-lg font-bold">{m.nome}</span>
                  <span className="text-sm text-muted-foreground">Configurações e equipe</span>
                </span>
                <Selo tom={m.ativo ? "verde" : "cinza"}>{m.ativo ? "Ativo" : "Desativado"}</Selo>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>
              <AlternarMunicipio id={m.id} nome={m.nome} ativo={m.ativo} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="administradores" className="flex flex-col gap-3">
        <h2 id="administradores" className="text-xl font-bold">Administradores da assessoria</h2>
        <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {admins.map((a) => (
            <li key={a.user_id} className="flex flex-col gap-2 border-b p-4 last:border-b-0">
              <span className="font-bold">{a.nome ?? "[Nome não informado]"}</span>
              <span className="text-sm break-all text-muted-foreground">{a.email}</span>
              {a.user_id === userId ? (
                <p className="text-sm text-muted-foreground">Você. Ninguém altera o próprio perfil administrativo.</p>
              ) : (
                <RemoverAdmin userId={a.user_id} quem={a.nome ?? a.email} />
              )}
            </li>
          ))}
        </ul>
        <ConcederAdmin />
      </section>
    </Pagina>
  );
}
