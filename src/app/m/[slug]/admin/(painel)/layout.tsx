import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagina } from "@/components/pagina";
import { ProvedorAvisos } from "@/components/painel/avisos";
import { NavegacaoPainel } from "@/components/painel/navegacao";
import { SeletorMunicipio } from "@/components/painel/seletor-municipio";
import type { Papel } from "@/lib/auth/acesso";
import { sair } from "@/lib/auth/acoes";
import { envPublico, overrideDeMunicipioPermitido } from "@/lib/env";
import { urlDoPainel } from "@/lib/municipio/resolver";
import { contextoDoSlug } from "@/lib/painel/contexto";
import { municipiosParaTrocar } from "@/lib/painel/municipios";
import { sessaoCompartilhada } from "@/lib/supabase/cookies";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Assessoria",
  gestor: "Gestor",
  operador: "Operador",
};

/** Todo o painel exige sessão e vínculo ativo com o município do recurso. */
export default async function LayoutPainel({ params, children }: LayoutProps<"/m/[slug]/admin">) {
  const { slug } = await params;
  const { municipio, acesso } = await contextoDoSlug(slug);
  if (acesso.status === "anonimo") redirect("/admin/login");

  if (acesso.status === "sem_acesso") {
    return (
      <Pagina>
        <h1 className="text-[30px] leading-tight font-bold">Sem acesso a este painel</h1>
        <p>
          A conta {acesso.email ? <strong>{acesso.email}</strong> : null} não tem vínculo com {municipio.nome}.
        </p>
        <p className="text-muted-foreground">
          Se você trabalha na prefeitura de {municipio.nome}, peça à assessoria para liberar o seu acesso.
          Se entrou no município errado, saia e acesse o portal do seu município.
        </p>
        <form action={sair}>
          <Button type="submit" size="lg" variant="outline" className="w-full">
            Sair desta conta
          </Button>
        </form>
      </Pagina>
    );
  }

  // Troca de município (Fase 7.2): admin vê todos; quem tem mais de um vínculo, os seus.
  const raiz = envPublico().NEXT_PUBLIC_ROOT_DOMAIN;
  const override = overrideDeMunicipioPermitido();
  const municipios = await municipiosParaTrocar(acesso.userId, acesso.papel);
  const comSeletor = acesso.papel === "admin" || municipios.length > 1;
  const host = (await headers()).get("host");

  return (
    <div className="flex flex-1 flex-col pb-[88px] print:pb-0">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-4 py-3 print:hidden">
        {comSeletor ? (
          <SeletorMunicipio
            rotuloPapel={ROTULO_PAPEL[acesso.papel]}
            atual={{ slug: municipio.slug, nome: municipio.nome }}
            admin={acesso.papel === "admin"}
            compartilhada={override || sessaoCompartilhada(host)}
            opcoes={municipios.map((m) => ({
              ...m,
              href: urlDoPainel(m.slug, raiz, override),
              endereco: `${m.slug}.${raiz.replace(/:\d+$/, "")}/admin`,
            }))}
          />
        ) : (
          <div className="flex flex-col leading-tight">
            <span className="text-xs tracking-[0.06em] text-muted-foreground uppercase">
              Painel · {ROTULO_PAPEL[acesso.papel]}
            </span>
            <span className="font-heading text-xl font-bold">{municipio.nome}</span>
          </div>
        )}
        {acesso.papel === "admin" ? (
          <span className="ml-auto rounded-full bg-dourado-suave px-2.5 py-1 text-[13px] font-bold text-dourado-texto">Admin</span>
        ) : null}
        <form action={sair}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>
      <ProvedorAvisos>{children}</ProvedorAvisos>
      <NavegacaoPainel papel={acesso.papel} />
    </div>
  );
}
