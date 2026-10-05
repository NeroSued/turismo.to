"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { Campo, MensagemEstado } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { concederAdmin, definirMunicipioAtivo, removerAdmin } from "@/lib/assessoria/acoes";
import type { ResultadoAcao } from "@/lib/painel/contexto";

function useAcao() {
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const [pendente, iniciar] = useTransition();
  const executar = (f: () => Promise<ResultadoAcao>) => iniciar(async () => setResultado(await f()));
  return { resultado, pendente, executar };
}

export function AlternarMunicipio({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const { resultado, pendente, executar } = useAcao();
  return (
    <div className="flex flex-col gap-2">
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      <Button variant={ativo ? "ghost" : "outline"} disabled={pendente} onClick={() => executar(() => definirMunicipioAtivo(id, !ativo))}
        aria-label={`${ativo ? "Desativar" : "Ativar"} ${nome}`}>
        {ativo ? "Desativar portal" : "Ativar portal"}
      </Button>
    </div>
  );
}

export function ConcederAdmin() {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: ResultadoAcao | undefined, dados: FormData) => {
    const r = await concederAdmin(anterior, dados);
    if (r?.ok) formulario.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
      <h3 className="text-lg font-bold">Conceder acesso de administrador</h3>
      <p className="text-sm text-muted-foreground">
        Para uma conta que já existe. O administrador vê e altera todos os municípios.
      </p>
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <Campo id="email_admin" name="email" rotulo="E-mail da conta" type="email" inputMode="email" autoComplete="off" required
        maxLength={254} defaultValue={estado && !estado.ok ? estado.valores?.email : ""} erro={estado && !estado.ok ? estado.campos?.email : undefined} />
      <Button type="submit" variant="outline" size="lg" disabled={pendente}>
        <ShieldCheck aria-hidden="true" /> {pendente ? "Salvando…" : "Tornar administrador"}
      </Button>
    </form>
  );
}

export type AdminListado = { user_id: string; nome: string | null; email: string };

/**
 * Lista de administradores com "Remover acesso". O resultado fica acima da lista: depois da remoção
 * a pessoa sai da lista, e a confirmação precisa continuar visível (item 5.8).
 */
export function ListaAdmins({ admins, userId }: { admins: AdminListado[]; userId: string }) {
  const { resultado, pendente, executar } = useAcao();
  const remover = (a: AdminListado) =>
    executar(async () => {
      const r = await removerAdmin(a.user_id);
      return r.ok ? { ok: true, aviso: `Acesso de administrador de ${a.nome ?? a.email} removido.` } : r;
    });
  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      <ul className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
        {admins.map((a) => (
          <li key={a.user_id} className="flex flex-col gap-2 border-b p-4 last:border-b-0">
            <span className="font-bold">{a.nome ?? "[Nome não informado]"}</span>
            <span className="text-sm break-all text-muted-foreground">{a.email}</span>
            {a.user_id === userId ? (
              <p className="text-sm text-muted-foreground">Você. Ninguém altera o próprio perfil administrativo.</p>
            ) : (
              <Button variant="ghost" disabled={pendente} onClick={() => remover(a)}
                aria-label={`Remover o acesso de administrador de ${a.nome ?? a.email}`}>
                Remover acesso de administrador
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
