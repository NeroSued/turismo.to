"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  definirNovaSenha,
  entrar,
  recuperarSenha,
  type EstadoFormulario,
} from "@/lib/auth/acoes";

function Mensagem({ estado }: { estado: EstadoFormulario }) {
  if (estado?.erro) {
    return (
      <p role="alert" className="rounded-xl bg-erro-suave p-3 text-erro">
        {estado.erro}
      </p>
    );
  }
  if (estado?.aviso) {
    return (
      <p role="status" className="rounded-xl bg-verde-suave p-3 text-primary">
        {estado.aviso}
      </p>
    );
  }
  return null;
}

function Campo(props: { id: string; rotulo: string } & React.ComponentProps<"input">) {
  const { id, rotulo, ...resto } = props;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} name={id} required {...resto} />
    </div>
  );
}

export function FormularioEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" inputMode="email" />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, acao, pendente] = useActionState(recuperarSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo id="email" rotulo="E-mail da sua conta" type="email" autoComplete="email" inputMode="email" />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}

export function FormularioNovaSenha() {
  const [estado, acao, pendente] = useActionState(definirNovaSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo id="senha" rotulo="Nova senha (mínimo 10 caracteres)" type="password" autoComplete="new-password" minLength={10} />
      <Campo id="confirmacao" rotulo="Repita a nova senha" type="password" autoComplete="new-password" minLength={10} />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar senha"}
      </Button>
    </form>
  );
}
