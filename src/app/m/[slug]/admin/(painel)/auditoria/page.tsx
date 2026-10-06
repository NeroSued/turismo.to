import type { Metadata } from "next";
import Link from "next/link";
import { Campo, Selecao } from "@/components/formulario";
import { Pagina } from "@/components/pagina";
import { Voltar } from "@/components/painel/telas-cadastro";
import { Button } from "@/components/ui/button";
import {
  AREAS_AUDITORIA,
  consultarAuditoria,
  esquemaFiltrosAuditoria,
  OPERACOES_AUDITORIA,
  pessoasDaAuditoria,
  POR_PAGINA,
  type RegistroAuditoria,
} from "@/lib/auditoria/dados";
import { formatarDataHora, hojeLocal, somarDias } from "@/lib/datas";
import { listarMunicipiosDoPainel } from "@/lib/municipio/dados";
import { exigirPainel } from "@/lib/painel/contexto";

export const metadata: Metadata = { title: "Auditoria" };

const TODOS = "todos";

function resumo(r: RegistroAuditoria): string {
  const area = AREAS_AUDITORIA[r.tabela] ?? r.tabela;
  const acao = OPERACOES_AUDITORIA[r.operacao];
  return `${acao} em ${area.toLowerCase()}`;
}

/** Auditoria (item 4.4): quem fez o quê e quando, com filtros por município, pessoa, período e tipo de ação. */
export default async function Auditoria({ params, searchParams }: PageProps<"/m/[slug]/admin/auditoria">) {
  const { slug } = await params;
  const { municipio, papel } = await exigirPainel(slug, ["gestor"]);
  const bruto = await searchParams;
  const f = esquemaFiltrosAuditoria.parse({
    ...Object.fromEntries(Object.entries(bruto).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
    // "filtro_municipio", não "municipio": esse nome é o da escolha de portal no preview (proxy).
    municipio: bruto.filtro_municipio === TODOS ? undefined : bruto.filtro_municipio,
  });
  const admin = papel === "admin";
  // O gestor vê só o município do painel; o admin escolhe qualquer um ou todos.
  const municipioId = admin ? (bruto.filtro_municipio === TODOS ? null : (f.municipio ?? municipio.id)) : municipio.id;
  const hoje = hojeLocal();
  const fim = f.fim ?? hoje;
  const inicio = f.inicio && f.inicio <= fim ? f.inicio : somarDias(fim, -30);

  const [registros, pessoas, municipios] = await Promise.all([
    consultarAuditoria({ municipioId, usuarioId: f.usuario, inicio, fim, area: f.area, acao: f.acao, antes: f.antes }),
    pessoasDaAuditoria(municipioId),
    admin ? listarMunicipiosDoPainel() : Promise.resolve([]),
  ]);
  const proxima = registros.length === POR_PAGINA ? registros[registros.length - 1].id : null;
  const consulta = new URLSearchParams(
    Object.entries({
      filtro_municipio: admin ? (municipioId ?? TODOS) : undefined,
      usuario: f.usuario,
      inicio,
      fim,
      area: f.area,
      acao: f.acao,
    }).filter((x): x is [string, string] => Boolean(x[1])),
  );

  return (
    <Pagina className="pt-2">
      <Voltar href="/admin/mais" rotulo="Mais" />
      <h1 className="text-[26px] font-bold">Auditoria</h1>
      <p className="text-muted-foreground">
        Registro automático de quem incluiu, alterou ou excluiu dados, e quando. Ninguém edita este registro.
      </p>

      <form method="get" className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4" aria-label="Filtros da auditoria">
        {admin ? (
          <Selecao id="filtro_municipio" rotulo="Município" defaultValue={municipioId ?? TODOS}>
            <option value={TODOS}>Todos os municípios</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        ) : null}
        <Selecao id="usuario" rotulo="Pessoa" defaultValue={f.usuario ?? ""}>
          <option value="">Todas as pessoas</option>
          {pessoas.map((p) => (
            <option key={p.usuario_id} value={p.usuario_id}>
              {p.nome ?? "[Sem nome]"}
            </option>
          ))}
        </Selecao>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="inicio" rotulo="De" type="date" defaultValue={inicio} max={hoje} />
          <Campo id="fim" rotulo="Até" type="date" defaultValue={fim} max={hoje} />
        </div>
        <Selecao id="area" rotulo="Área" defaultValue={f.area ?? ""}>
          <option value="">Todas as áreas</option>
          {Object.entries(AREAS_AUDITORIA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selecao>
        <Selecao id="acao" rotulo="Tipo de ação" defaultValue={f.acao ?? ""}>
          <option value="">Inclusão, alteração e exclusão</option>
          {Object.entries(OPERACOES_AUDITORIA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selecao>
        <Button type="submit" size="lg">
          Filtrar
        </Button>
      </form>

      <section aria-labelledby="registros" className="flex flex-col gap-3">
        <h2 id="registros" className="text-xl font-bold">Registros</h2>
        {registros.length === 0 ? (
          <p className="rounded-2xl border bg-superficie p-4">
            Nenhum registro com esses filtros. Amplie o período ou escolha &quot;Todas as pessoas&quot; e &quot;Todas as áreas&quot;.
          </p>
        ) : (
          <ol aria-label="Registros de auditoria" className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
            {registros.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-b p-4 last:border-b-0">
                <span className="font-bold">{resumo(r)}</span>
                <span className="text-sm">
                  {r.usuario_nome ?? "Sistema ou visitante"} · {formatarDataHora(r.em)}
                </span>
                {r.campos.length > 0 ? (
                  <span className="text-sm text-muted-foreground">Campos: {r.campos.join(", ")}</span>
                ) : null}
                {admin && municipioId === null ? (
                  <span className="text-sm text-muted-foreground">{r.municipio_nome ?? "Sem município"}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {proxima ? (
          <Link href={`/admin/auditoria?${consulta.toString()}&antes=${proxima}`} className="flex min-h-11 items-center justify-center font-bold">
            Mostrar registros mais antigos
          </Link>
        ) : null}
      </section>
    </Pagina>
  );
}
