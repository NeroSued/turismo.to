"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { AreaTexto, Campo, MensagemEstado, Selecao } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  criarCadastro,
  mudarStatusCadastro,
  registrarAdesao,
  salvarCadastro,
} from "@/lib/cadastros/acoes";
import { CAMPOS, type DefCampo } from "@/lib/cadastros/campos";
import { TEXTOS, type StatusConteudo, type TipoCadastro } from "@/lib/cadastros/esquemas";
import type { ResultadoAcao } from "@/lib/painel/contexto";
import { cn } from "@/lib/utils";
import { enviarDireto } from "@/lib/arquivos/envio-direto";

type Valores = Record<string, string | null | undefined>;
type OpcaoAtrativo = { id: string; nome: string };

function CampoCadastro({ c, v, erro, atrativos }: { c: DefCampo; v?: Valores; erro?: string; atrativos: OpcaoAtrativo[] }) {
  const valor = v?.[c.nome] ?? "";
  const comum = { id: c.nome, rotulo: c.rotulo, erro, required: c.obrigatorio, className: c.meia ? "min-w-0" : "col-span-2" };
  switch (c.tipo) {
    case "area":
      return <AreaTexto {...comum} defaultValue={valor} maxLength={c.max} ajuda={c.ajuda} />;
    case "selecao":
      return (
        <Selecao {...comum} defaultValue={valor}>
          {!c.obrigatorio || !valor ? <option value="">Escolha…</option> : null}
          {Object.entries(c.opcoes ?? {}).map(([k, r]) => (
            <option key={k} value={k}>
              {r}
            </option>
          ))}
        </Selecao>
      );
    case "atrativo":
      return (
        <div className="col-span-2 flex flex-col gap-1.5">
          <Selecao {...comum} className="" defaultValue={valor}>
            <option value="">Nenhum</option>
            {atrativos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </Selecao>
          {c.ajuda ? <span className="text-sm text-muted-foreground">{c.ajuda}</span> : null}
        </div>
      );
    case "data":
      return <Campo {...comum} type="date" defaultValue={valor} ajuda={c.ajuda} />;
    case "hora":
      return <Campo {...comum} type="time" defaultValue={valor} ajuda={c.ajuda} />;
    case "decimal":
      return <Campo {...comum} inputMode="decimal" defaultValue={valor} ajuda={c.ajuda} />;
    default:
      return <Campo {...comum} defaultValue={valor} maxLength={c.max} ajuda={c.ajuda} />;
  }
}

function Campos({ tipo, essenciais, v, campos, atrativos }: {
  tipo: TipoCadastro;
  essenciais?: boolean;
  v?: Valores;
  campos?: Record<string, string>;
  atrativos: OpcaoAtrativo[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
      {CAMPOS[tipo]
        .filter((c) => !essenciais || c.essencial)
        .map((c) => (
          <CampoCadastro key={c.nome} c={c} v={v} erro={campos?.[c.nome]} atrativos={atrativos} />
        ))}
    </div>
  );
}

export function FormularioNovoCadastro({ tipo, valores, atrativos = [] }: { tipo: TipoCadastro; valores?: Valores; atrativos?: OpcaoAtrativo[] }) {
  const [estado, acao, pendente] = useActionState(criarCadastro.bind(null, tipo), undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} />
      <Campos tipo={tipo} essenciais v={(estado && !estado.ok && estado.valores) || valores} campos={estado && !estado.ok ? estado.campos : undefined} atrativos={atrativos} />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : `Criar ${TEXTOS[tipo].singular}`}
      </Button>
      <p className="text-sm text-muted-foreground">
        Começa em elaboração e só aparece no portal depois de publicado. Os demais dados e as fotos você completa na
        próxima tela.
      </p>
    </form>
  );
}

export function FormularioEditarCadastro({ tipo, id, valores, atrativos = [] }: { tipo: TipoCadastro; id: string; valores: Valores; atrativos?: OpcaoAtrativo[] }) {
  const [estado, acao, pendente] = useActionState(salvarCadastro.bind(null, tipo, id), undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <Campos tipo={tipo} v={(estado && !estado.ok && estado.valores) || valores} campos={estado && !estado.ok ? estado.campos : undefined} atrativos={atrativos} />
      <Button type="submit" size="lg" variant="outline" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}

function useAcaoSimples() {
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const [pendente, iniciar] = useTransition();
  const executar = (f: () => Promise<ResultadoAcao>) => iniciar(async () => setResultado(await f()));
  return { resultado, pendente, executar };
}

export function AcoesStatusCadastro({ tipo, id, status }: { tipo: TipoCadastro; id: string; status: StatusConteudo }) {
  const { resultado, pendente, executar } = useAcaoSimples();
  const mudar = (s: StatusConteudo) => executar(() => mudarStatusCadastro(tipo, id, s));
  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      {status !== "publicado" ? (
        <Button size="lg" disabled={pendente} onClick={() => mudar("publicado")}>
          Publicar no portal
        </Button>
      ) : (
        <Button size="lg" variant="outline" disabled={pendente} onClick={() => mudar("rascunho")}>
          Voltar para elaboração
        </Button>
      )}
      {status !== "arquivado" ? (
        <Button variant="ghost" disabled={pendente} onClick={() => mudar("arquivado")}>
          Arquivar (tira do portal)
        </Button>
      ) : null}
    </div>
  );
}

export function FormularioAdesao({ prestadorId, hoje }: { prestadorId: string; hoje: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: ResultadoAcao | undefined, dados: FormData) => {
    const r = await registrarAdesao(prestadorId, anterior, await enviarDireto(dados, "comprovante", "documento", "adesoes"));
    if (r?.ok) formulario.current?.reset();
    return r;
  }, undefined);
  const campos = estado && !estado.ok ? estado.campos : undefined;
  const v = estado && !estado.ok ? estado.valores : undefined;
  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
      <h3 className="text-lg font-bold">Registrar adesão</h3>
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <Campo id="data_adesao" rotulo="Data da adesão" type="date" required defaultValue={v?.data_adesao ?? hoje} max={hoje} erro={campos?.data_adesao} />
      <Campo id="responsavel" rotulo="Responsável pelo prestador" defaultValue={v?.responsavel} required maxLength={120} erro={campos?.responsavel} />
      <Campo id="contato_interno" rotulo="Contato interno" defaultValue={v?.contato_interno} maxLength={300} erro={campos?.contato_interno}
        ajuda="Telefone ou e-mail para a Secretaria. Não aparece no portal." />
      <AreaTexto id="observacoes" rotulo="Observações" defaultValue={v?.observacoes} maxLength={2000} erro={campos?.observacoes} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comprovante">Comprovante (opcional)</Label>
        <Input
          id="comprovante"
          name="comprovante"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          aria-describedby="comprovante-ajuda"
          aria-invalid={campos?.comprovante ? true : undefined}
          className="h-auto py-2.5"
        />
        <span id="comprovante-ajuda" className={cn("text-sm", campos?.comprovante ? "font-bold text-erro" : "text-muted-foreground")}>
          {campos?.comprovante ?? "Termo assinado ou ficha de adesão. PDF, JPEG ou PNG até 10 MB. Fica guardado em área privada."}
        </span>
      </div>
      <Button type="submit" size="lg" variant="outline" disabled={pendente}>
        {pendente ? "Salvando…" : "Registrar adesão"}
      </Button>
    </form>
  );
}
