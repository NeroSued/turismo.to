import { ChevronRight } from "lucide-react";
import { Pagina } from "@/components/pagina";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { listarMunicipiosAtivos } from "@/lib/municipio/dados";
import { urlDoMunicipio } from "@/lib/municipio/resolver";

const IGNORAR = new Set(["do", "da", "de", "dos", "das"]);

/** Sigla decorativa: iniciais das palavras principais, ou as duas primeiras letras. */
function sigla(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => !IGNORAR.has(p.toLowerCase()));
  const s = palavras.length > 1 ? palavras.slice(0, 2).map((p) => p[0]).join("") : nome.slice(0, 2);
  return s.toUpperCase();
}

export default async function Hub() {
  const municipios = await listarMunicipiosAtivos();
  const { NEXT_PUBLIC_ROOT_DOMAIN: raiz } = envPublico();
  const override = overrideDeMunicipioPermitido();

  return (
    <Pagina>
      <header className="flex items-center justify-between">
        <span className="font-heading text-[22px] font-bold">
          turismo<span className="text-dourado-texto">.to</span>
        </span>
        <span className="text-sm text-muted-foreground">Tocantins</span>
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="text-[30px] leading-[1.08] font-bold">Turismo nos municípios participantes</h1>
        <p className="text-muted-foreground">
          Escolha um município para ver atrativos, eventos e reservar atividades gratuitas.
        </p>
      </div>

      <nav aria-label="Municípios" className="flex flex-col gap-2">
        {municipios.length === 0 ? (
          <p className="rounded-2xl border bg-superficie p-4">
            Nenhum município está ativo no momento. A assessoria ativa cada portal quando a prefeitura
            estiver pronta para publicar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {municipios.map((m) => (
              <li key={m.slug}>
                <a
                  href={urlDoMunicipio(m.slug, raiz, override)}
                  className="flex min-h-[60px] items-center gap-3 rounded-[14px] border bg-superficie px-3 py-2 text-foreground no-underline hover:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-verde-suave text-sm font-bold text-primary"
                  >
                    {sigla(m.nome)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="font-bold">{m.nome}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {m.slug}.{raiz.replace(/:\d+$/, "")}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <p className="mt-auto text-[13px] text-muted-foreground">
        Cada prefeitura é responsável pelas informações publicadas no seu portal.
      </p>
    </Pagina>
  );
}
