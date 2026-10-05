"use client";

import { Send } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { Campo, MensagemEstado, Selo } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { alterarVinculo, convidarParaEquipe } from "@/lib/equipe/acoes";
import { DESCRICAO_PAPEL_EQUIPE, PAPEIS_EQUIPE, ROTULO_PAPEL_EQUIPE, type PapelEquipe } from "@/lib/equipe/esquemas";
import type { ResultadoAcao } from "@/lib/painel/contexto";

export type Membro = {
  vinculo_id: string;
  nome: string | null;
  email: string;
  papel: PapelEquipe;
  ativo: boolean;
  convite_pendente: boolean;
  eu: boolean;
};

export function ConvidarParaEquipe({ municipioId, nomeMunicipio }: { municipioId: string; nomeMunicipio: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: ResultadoAcao | undefined, dados: FormData) => {
    const r = await convidarParaEquipe(anterior, dados);
    if (r?.ok) formulario.current?.reset();
    return r;
  }, undefined);
  const campos = estado && !estado.ok ? estado.campos : undefined;
  const v = estado && !estado.ok ? estado.valores : undefined;

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
      <h2 className="text-xl font-bold">Convidar pessoa</h2>
      <p className="text-sm text-muted-foreground">
        A pessoa recebe um e-mail para criar a própria senha. Ninguém recebe senha pronta e cada pessoa tem a sua conta.
      </p>
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <input type="hidden" name="municipio_id" value={municipioId} />
      <Campo id="email" name="email" rotulo="E-mail" type="email" inputMode="email" autoComplete="off" required maxLength={254}
        defaultValue={v?.email ?? ""} erro={campos?.email} ajuda="Use o e-mail de trabalho da pessoa." />
      <Campo id="nome" name="nome" rotulo="Nome (opcional)" maxLength={120} defaultValue={v?.nome ?? ""} erro={campos?.nome}
        ajuda="Aparece no histórico e nos registros de atendimento." />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Papel em {nomeMunicipio}</legend>
        {PAPEIS_EQUIPE.map((p) => (
          <label key={p} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 has-checked:border-foreground">
            <input type="radio" name="papel" value={p} required defaultChecked={(v?.papel ?? "operador") === p} className="mt-1 size-5 accent-primary" />
            <span className="flex flex-col">
              <span className="font-bold">{ROTULO_PAPEL_EQUIPE[p]}</span>
              <span className="text-sm text-muted-foreground">{DESCRICAO_PAPEL_EQUIPE[p]}</span>
            </span>
          </label>
        ))}
        {campos?.papel ? <span className="text-sm font-bold text-erro">{campos.papel}</span> : null}
      </fieldset>
      <Button type="submit" size="lg" disabled={pendente}>
        <Send aria-hidden="true" /> {pendente ? "Enviando…" : "Enviar convite"}
      </Button>
    </form>
  );
}

function ItemEquipe({ municipioId, m }: { municipioId: string; m: Membro }) {
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const [pendente, iniciar] = useTransition();
  const executar = (mudanca: { papel?: PapelEquipe; ativo?: boolean }) =>
    iniciar(async () => setResultado(await alterarVinculo({ municipio_id: municipioId, vinculo_id: m.vinculo_id, ...mudanca })));
  const outroPapel: PapelEquipe = m.papel === "gestor" ? "operador" : "gestor";
  const quem = m.nome ?? m.email;

  return (
    <li className="flex flex-col gap-3 border-b p-4 last:border-b-0">
      <div className="flex flex-col gap-1">
        <span className="font-bold">{m.nome ?? "[Nome não informado]"}</span>
        <span className="text-sm break-all text-muted-foreground">{m.email}</span>
        <span className="flex flex-wrap gap-2 pt-1">
          <Selo tom={m.ativo ? "verde" : "cinza"}>{m.ativo ? ROTULO_PAPEL_EQUIPE[m.papel] : `${ROTULO_PAPEL_EQUIPE[m.papel]} · desativado`}</Selo>
          {m.convite_pendente && m.ativo ? <Selo tom="dourado">Ainda não entrou</Selo> : null}
          {m.eu ? <Selo tom="cinza">Você</Selo> : null}
        </span>
      </div>
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      {m.eu ? (
        <p className="text-sm text-muted-foreground">Ninguém altera o próprio acesso.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {m.ativo ? (
            <Button variant="outline" disabled={pendente} onClick={() => executar({ papel: outroPapel })}
              aria-label={`Tornar ${quem} ${ROTULO_PAPEL_EQUIPE[outroPapel].toLowerCase()}`}>
              Tornar {ROTULO_PAPEL_EQUIPE[outroPapel].toLowerCase()}
            </Button>
          ) : null}
          <Button variant={m.ativo ? "ghost" : "outline"} disabled={pendente} onClick={() => executar({ ativo: !m.ativo })}
            aria-label={`${m.ativo ? "Desativar" : "Reativar"} o acesso de ${quem}`}>
            {m.ativo ? "Desativar acesso" : "Reativar acesso"}
          </Button>
        </div>
      )}
    </li>
  );
}

export function ListaEquipe({ municipioId, membros }: { municipioId: string; membros: Membro[] }) {
  if (membros.length === 0) {
    return (
      <p className="rounded-2xl border bg-superficie p-4">
        Ninguém tem acesso a este município ainda. Convide o gestor da Secretaria de Turismo e, depois, os operadores do atendimento.
      </p>
    );
  }
  return (
    <ul aria-label="Equipe" className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
      {membros.map((m) => (
        <ItemEquipe key={m.vinculo_id} municipioId={municipioId} m={m} />
      ))}
    </ul>
  );
}
