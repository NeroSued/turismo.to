import { Pagina } from "@/components/pagina";
import { overrideDeMunicipioPermitido } from "@/lib/env";
import { urlDoHub } from "@/lib/municipio/resolver";

export default function NaoEncontrado() {
  // Lido sem validar: esta página é pré-renderizada no build, que não exige variáveis.
  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return (
    <Pagina>
      <h1 className="text-[30px] leading-tight font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">
        Este endereço não corresponde a um portal ativo. Confira se o nome do município foi digitado
        corretamente ou volte para a lista de municípios participantes.
      </p>
      <a
        href={raiz ? urlDoHub(raiz, overrideDeMunicipioPermitido()) : "/"}
        className="flex min-h-11 items-center font-bold"
      >
        Ver municípios participantes
      </a>
    </Pagina>
  );
}
