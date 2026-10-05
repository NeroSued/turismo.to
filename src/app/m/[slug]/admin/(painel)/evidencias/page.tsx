import { ChevronRight, Paperclip, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Selecao, Selo } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatarData } from "@/lib/datas";
import { listarEvidencias } from "@/lib/evidencias/dados";
import { ROTULO_TIPO_ACAO } from "@/lib/evidencias/esquemas";
import { exigirPainel } from "@/lib/painel/contexto";
import { anosDisponiveis, lerPeriodo } from "@/lib/relatorios/periodo";

export const metadata: Metadata = { title: "Evidências" };

/** Evidências do ano-base (item 3.4): o que foi feito, quando, por quem, com fotos e anexos. */
export default async function Evidencias({ params, searchParams }: PageProps<"/m/[slug]/admin/evidencias">) {
  const { slug } = await params;
  const { municipio } = await exigirPainel(slug, ["gestor"]);
  const sp = await searchParams;
  const ano = lerPeriodo({ ano: sp.ano }).ano!;
  const arquivadas = sp.arquivadas === "1";
  const evidencias = await listarEvidencias(municipio.id, ano, { arquivadas });
  const semAnexo = evidencias.filter((e) => !e.arquivada && e.evidencias_arquivos.length === 0).length;

  return (
    <Pagina className="pt-2">
      <h1 className="text-[26px] font-bold">Evidências</h1>
      <p className="text-muted-foreground">
        Registre as ações de turismo realizadas em {municipio.nome}, com fotos, listas de presença e atas. Elas entram na minuta do
        relatório de implantação do ano-base.
      </p>
      <Link href="/admin/evidencias/nova" className={buttonVariants({ size: "lg", className: "no-underline hover:text-primary-foreground" })}>
        <Plus aria-hidden="true" /> Nova evidência
      </Link>
      <form method="get" className="flex items-end gap-2 rounded-2xl border bg-superficie p-4">
        {arquivadas ? <input type="hidden" name="arquivadas" value="1" /> : null}
        <Selecao id="ano" rotulo="Ano-base" defaultValue={ano} className="flex-1">
          {anosDisponiveis().map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selecao>
        <Button type="submit" variant="outline" className="h-12">
          Ver ano
        </Button>
      </form>
      {semAnexo > 0 ? (
        <p className="rounded-xl bg-dourado-suave p-3 text-dourado-texto">
          {semAnexo === 1 ? "1 evidência ainda não tem" : `${semAnexo} evidências ainda não têm`} foto nem anexo. Abra e envie os arquivos.
        </p>
      ) : null}

      {evidencias.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-superficie p-4">
          <p className="font-bold">Nenhuma evidência no ano-base {ano}.</p>
          <p className="text-muted-foreground">
            Toque em &quot;Nova evidência&quot; para registrar uma reunião, oficina, ação de divulgação ou melhoria feita no município.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {evidencias.map((e) => (
            <li key={e.id} className="border-b last:border-b-0">
              <Link href={`/admin/evidencias/${e.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-background">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-bold">{e.titulo}</span>
                  <span className="text-sm text-muted-foreground">
                    {ROTULO_TIPO_ACAO[e.tipo_acao]} · realizada em {formatarData(e.data_realizacao)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {e.arquivada ? <Selo tom="cinza">Arquivada</Selo> : null}
                    {e.evidencias_arquivos.length === 0 ? (
                      <Selo tom="dourado">Sem anexo</Selo>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Paperclip aria-hidden="true" className="size-4" />
                        {e.evidencias_arquivos.length === 1 ? "1 arquivo" : `${e.evidencias_arquivos.length} arquivos`}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/admin/evidencias?ano=${ano}${arquivadas ? "" : "&arquivadas=1"}`} className="flex min-h-11 items-center font-bold">
        {arquivadas ? "Esconder evidências arquivadas" : "Mostrar também as arquivadas"}
      </Link>
    </Pagina>
  );
}
