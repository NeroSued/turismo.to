"use client";

import { useActionState } from "react";
import { AreaTexto, MensagemEstado } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { salvarTextosMinuta } from "@/lib/minuta/acoes";
import { SECOES_EDITAVEIS, type SecaoEditavel } from "@/lib/minuta/conteudo";

export function FormularioTextosMinuta({ ano, valores }: { ano: number; valores: Partial<Record<SecaoEditavel, string | null>> }) {
  const [estado, acao, pendente] = useActionState(salvarTextosMinuta.bind(null, ano), undefined);
  const erro = estado && !estado.ok ? estado : undefined;
  const v = (erro?.valores ?? valores) as Partial<Record<SecaoEditavel, string | null>>;
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
      <h2 id="completar" className="text-xl font-bold">
        Completar as seções do responsável
      </h2>
      <p className="text-sm text-muted-foreground">
        Escreva com as suas palavras. O sistema não preenche estas seções. Separe parágrafos com uma linha em branco.
      </p>
      <MensagemEstado erro={erro?.erro} aviso={estado?.ok ? estado.aviso : null} />
      {SECOES_EDITAVEIS.map((s) => (
        <AreaTexto
          key={`${s.chave}-${JSON.stringify(erro?.valores ?? "")}`}
          id={s.chave}
          rotulo={s.titulo}
          defaultValue={v[s.chave] ?? ""}
          maxLength={8000}
          rows={5}
          ajuda={s.orientacao}
          erro={erro?.campos?.[s.chave]}
        />
      ))}
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar seções"}
      </Button>
    </form>
  );
}
