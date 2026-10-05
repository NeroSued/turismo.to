import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoInterno, nomeDoMunicipio, RodapePortal } from "@/components/portal/estrutura";
import { buscarMunicipioPorSlug } from "@/lib/municipio/dados";

export async function generateMetadata({ params }: PageProps<"/m/[slug]/privacidade">): Promise<Metadata> {
  const { slug } = await params;
  const m = await buscarMunicipioPorSlug(slug);
  return m ? { title: "Aviso de privacidade", description: `Como o portal de turismo de ${nomeDoMunicipio(m)} trata os dados dos visitantes.` } : {};
}

/** Aviso de privacidade configurável pelo gestor (item 2.4). Sem texto configurado: o que o sistema coleta. */
export default async function Privacidade({ params }: PageProps<"/m/[slug]/privacidade">) {
  const { slug } = await params;
  const municipio = await buscarMunicipioPorSlug(slug);
  if (!municipio) notFound();
  const aviso = municipio.configuracoes_municipio?.aviso_privacidade;

  return (
    <>
      <CabecalhoInterno titulo="Aviso de privacidade" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10">
        <h1 className="text-[28px] leading-tight font-bold">Aviso de privacidade</h1>
        {aviso ? (
          <div className="rounded-2xl border bg-superficie p-4 text-[17px] whitespace-pre-line">{aviso}</div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
            <p className="font-bold">A prefeitura de {nomeDoMunicipio(municipio)} ainda não publicou o aviso de privacidade deste portal.</p>
            <p>Enquanto isso, veja o que o portal coleta:</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Para reservar ou registrar uma visita: cidade e UF de origem e a quantidade de pessoas.</li>
              <li>Nome do responsável e telefone só quando a atividade exige, para a organização do grupo.</li>
              <li>Nunca pedimos CPF, documento ou endereço, e não é preciso criar conta.</li>
            </ul>
            <p className="text-muted-foreground">Dúvidas sobre os seus dados: fale com a Secretaria de Turismo pelo contato no fim da página.</p>
          </div>
        )}
      </main>
      <RodapePortal municipio={municipio} />
    </>
  );
}
