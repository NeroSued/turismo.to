"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { AreaTexto, Campo, MensagemEstado, Selecao } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { arquivarEvidencia, criarEvidencia, enviarArquivoEvidencia, removerArquivoEvidencia, salvarEvidencia } from "@/lib/evidencias/acoes";
import { ROTULO_TIPO_ACAO, ROTULO_TIPO_ARQUIVO, TIPOS_ACAO, TIPOS_ARQUIVO } from "@/lib/evidencias/esquemas";
import type { ResultadoAcao } from "@/lib/painel/contexto";
import { cn } from "@/lib/utils";

export type ValoresEvidencia = {
  tipo_acao: string;
  titulo: string;
  descricao: string;
  data_realizacao: string;
  responsavel: string;
  ano_base: string;
  atividade_id: string;
};

type Opcao = { id: string; titulo: string };

function Campos({ v, campos, atividades, anos, hoje }: {
  v?: Partial<ValoresEvidencia>;
  campos?: Record<string, string>;
  atividades: Opcao[];
  anos: number[];
  hoje: string;
}) {
  return (
    <>
      <Selecao id="tipo_acao" rotulo="Tipo da ação" defaultValue={v?.tipo_acao ?? ""} required erro={campos?.tipo_acao}>
        <option value="" disabled>
          Escolha
        </option>
        {TIPOS_ACAO.map((t) => (
          <option key={t} value={t}>
            {ROTULO_TIPO_ACAO[t]}
          </option>
        ))}
      </Selecao>
      <Campo id="titulo" rotulo="Título" defaultValue={v?.titulo} required maxLength={160} erro={campos?.titulo}
        ajuda="Ex.: Oficina de condutores locais." />
      <AreaTexto id="descricao" rotulo="Descrição" defaultValue={v?.descricao} required maxLength={4000} erro={campos?.descricao}
        ajuda="O que foi feito, com quem, onde e qual o resultado." />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="data_realizacao" rotulo="Data de realização" type="date" max={hoje} required defaultValue={v?.data_realizacao}
          erro={campos?.data_realizacao} />
        <Selecao id="ano_base" rotulo="Ano-base" defaultValue={v?.ano_base ?? hoje.slice(0, 4)} required erro={campos?.ano_base}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selecao>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        A data de realização é quando a ação aconteceu. A data de inclusão no sistema é registrada automaticamente.
      </p>
      <Campo id="responsavel" rotulo="Responsável pela ação" defaultValue={v?.responsavel} required maxLength={160}
        erro={campos?.responsavel} ajuda="Pessoa ou setor. Ex.: Secretaria de Turismo." />
      <Selecao id="atividade_id" rotulo="Atividade relacionada (opcional)" defaultValue={v?.atividade_id ?? ""} erro={campos?.atividade_id}>
        <option value="">Nenhuma</option>
        {atividades.map((a) => (
          <option key={a.id} value={a.id}>
            {a.titulo}
          </option>
        ))}
      </Selecao>
    </>
  );
}

export function FormularioNovaEvidencia({ atividades, anos, hoje }: { atividades: Opcao[]; anos: number[]; hoje: string }) {
  const [estado, acao, pendente] = useActionState(criarEvidencia, undefined);
  const erro = estado && !estado.ok ? estado : undefined;
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={erro?.erro} />
      <Campos key={JSON.stringify(erro?.valores ?? {})} v={erro?.valores} campos={erro?.campos} atividades={atividades} anos={anos} hoje={hoje} />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : "Registrar evidência"}
      </Button>
      <p className="text-sm text-muted-foreground">Depois de registrar, anexe fotos com legenda, listas de presença e atas.</p>
    </form>
  );
}

export function FormularioEditarEvidencia({ id, valores, atividades, anos, hoje }: {
  id: string;
  valores: ValoresEvidencia;
  atividades: Opcao[];
  anos: number[];
  hoje: string;
}) {
  const [estado, acao, pendente] = useActionState(salvarEvidencia.bind(null, id), undefined);
  const erro = estado && !estado.ok ? estado : undefined;
  const v = erro?.valores ?? valores;
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={erro?.erro} aviso={estado?.ok ? estado.aviso : null} />
      <Campos key={JSON.stringify(v)} v={v} campos={erro?.campos} atividades={atividades} anos={anos} hoje={hoje} />
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

export function ArquivarEvidencia({ id, arquivada }: { id: string; arquivada: boolean }) {
  const { resultado, pendente, executar } = useAcaoSimples();
  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      <Button variant={arquivada ? "outline" : "ghost"} disabled={pendente} onClick={() => executar(() => arquivarEvidencia(id, !arquivada))}>
        {arquivada ? "Reativar evidência" : "Arquivar evidência"}
      </Button>
    </div>
  );
}

export type ArquivoPainel = { id: string; tipo: string; legenda: string; url: string; imagem: boolean };

export function GerenciarArquivosEvidencia({ evidenciaId, arquivos }: { evidenciaId: string; arquivos: ArquivoPainel[] }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState("foto");
  const [estado, acao, pendente] = useActionState(async (anterior: ResultadoAcao | undefined, dados: FormData) => {
    const r = await enviarArquivoEvidencia(evidenciaId, anterior, dados);
    if (r?.ok) formulario.current?.reset();
    return r;
  }, undefined);
  const remocao = useAcaoSimples();
  const campos = estado && !estado.ok ? estado.campos : undefined;
  const fotos = arquivos.filter((a) => a.imagem);
  const anexos = arquivos.filter((a) => !a.imagem);

  return (
    <div className="flex flex-col gap-4">
      {arquivos.length === 0 ? (
        <p className="rounded-2xl border bg-dourado-suave p-4 text-dourado-texto">
          Esta evidência ainda não tem fotos nem anexos. Envie ao menos uma foto com legenda, lista de presença ou ata.
        </p>
      ) : null}
      {fotos.length > 0 ? (
        <ul aria-label="Fotos" className="grid grid-cols-2 gap-3">
          {fotos.map((f) => (
            <li key={f.id} className="flex flex-col gap-1.5 rounded-2xl border bg-superficie p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado por URL assinada, sem otimização */}
              <img src={f.url} alt={f.legenda} className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />
              <span className="text-sm">{f.legenda}</span>
              <Button variant="ghost" size="sm" disabled={remocao.pendente} aria-label={`Remover a foto ${f.legenda}`}
                onClick={() => remocao.executar(() => removerArquivoEvidencia(evidenciaId, f.id))}>
                <Trash2 aria-hidden="true" /> Remover
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {anexos.length > 0 ? (
        <ul aria-label="Anexos" className="flex flex-col overflow-hidden rounded-2xl border bg-superficie">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center gap-2">
                <FileText aria-hidden="true" className="size-5 shrink-0" />
                <span className="flex flex-col">
                  <span className="font-bold">{a.legenda}</span>
                  <span className="text-sm text-muted-foreground">{ROTULO_TIPO_ARQUIVO[a.tipo as keyof typeof ROTULO_TIPO_ARQUIVO]}</span>
                </span>
              </a>
              <Button variant="ghost" size="icon" disabled={remocao.pendente} aria-label={`Remover o anexo ${a.legenda}`}
                onClick={() => remocao.executar(() => removerArquivoEvidencia(evidenciaId, a.id))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <MensagemEstado
        erro={remocao.resultado && !remocao.resultado.ok ? remocao.resultado.erro : null}
        aviso={remocao.resultado?.ok ? remocao.resultado.aviso : null}
      />
      <form ref={formulario} action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
        <h3 className="text-lg font-bold">Enviar foto ou anexo</h3>
        <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
        <Selecao id="tipo" rotulo="Tipo do arquivo" value={tipo} onChange={(e) => setTipo(e.target.value)} erro={campos?.tipo}>
          {TIPOS_ARQUIVO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_ARQUIVO[t]}
            </option>
          ))}
        </Selecao>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="arquivo">Arquivo</Label>
          <Input
            id="arquivo"
            name="arquivo"
            type="file"
            required
            accept={tipo === "foto" ? "image/jpeg,image/png" : "application/pdf,image/jpeg,image/png"}
            aria-describedby="arquivo-ajuda"
            aria-invalid={campos?.arquivo ? true : undefined}
            className="h-auto py-2.5"
          />
          <span id="arquivo-ajuda" className={cn("text-sm", campos?.arquivo ? "font-bold text-erro" : "text-muted-foreground")}>
            {campos?.arquivo ??
              (tipo === "foto" ? "JPEG ou PNG até 5 MB." : "PDF, JPEG ou PNG até 10 MB (foto ou digitalização do papel assinado).")}{" "}
            Fica em área privada, visível só para gestores do município.
          </span>
        </div>
        <Campo
          id="legenda"
          rotulo="Legenda"
          key={estado && !estado.ok ? `erro-${estado.valores?.legenda}` : "legenda"}
          defaultValue={estado && !estado.ok ? estado.valores?.legenda : undefined}
          required
          maxLength={200}
          erro={campos?.legenda}
          ajuda={tipo === "foto" ? "Descreva o que aparece na foto." : "Ex.: Lista de presença da oficina de 12/03."}
        />
        <Button type="submit" size="lg" variant="outline" disabled={pendente}>
          <Upload aria-hidden="true" /> {pendente ? "Enviando…" : "Enviar arquivo"}
        </Button>
      </form>
    </div>
  );
}
