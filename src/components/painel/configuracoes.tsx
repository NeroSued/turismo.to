"use client";

import { Trash2, Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { AreaTexto, Campo, MensagemEstado } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarImagemMunicipio, removerImagemMunicipio, salvarConfiguracoes } from "@/lib/configuracoes/acoes";
import type { ImagemMunicipio } from "@/lib/configuracoes/esquemas";
import type { ResultadoAcao } from "@/lib/painel/contexto";

type Valores = {
  nome_exibicao: string | null;
  cor_primaria: string;
  contato_secretaria: string | null;
  ouvidoria_url: string | null;
  aviso_privacidade: string | null;
  referencia_icms: string;
};

const SUGESTOES = ["#1F4D3A", "#2B4A6B", "#7A3B2E", "#4A5320"];

export function FormularioConfiguracoes({ municipioId, v: v0, nomeOficial }: { municipioId: string; v: Valores; nomeOficial: string }) {
  const [estado, acao, pendente] = useActionState(salvarConfiguracoes.bind(null, municipioId), undefined);
  const [cor, setCor] = useState(v0.cor_primaria);
  const campos = estado && !estado.ok ? estado.campos : undefined;
  // Depois de um erro, os campos mostram o que foi enviado (o React reseta o formulário).
  const v = { ...v0, ...(estado && !estado.ok ? estado.valores : undefined) };
  const corValida = /^#[0-9A-Fa-f]{6}$/.test(cor);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <Campo id="nome_exibicao" rotulo="Nome de exibição" defaultValue={v.nome_exibicao ?? ""} maxLength={120} erro={campos?.nome_exibicao}
        ajuda={`Vazio: o portal usa o nome oficial, ${nomeOficial}.`} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Cor primária</legend>
        <div className="flex items-end gap-3">
          <Campo id="cor_primaria" rotulo="Código da cor" value={cor} onChange={(e) => setCor(e.target.value)} required maxLength={7}
            erro={campos?.cor_primaria} className="flex-1" ajuda="Formato #RRGGBB. Precisa de contraste de 4.5:1 com o branco." />
          <span
            aria-hidden="true"
            className="mb-7 flex h-12 w-20 shrink-0 items-center justify-center rounded-xl border text-sm font-bold text-white"
            style={{ background: corValida ? cor : "transparent" }}
          >
            Aa
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cores sugeridas">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setCor(s)}
              aria-pressed={cor.toUpperCase() === s}
              className="flex min-h-11 items-center gap-2 rounded-full border bg-superficie px-3 text-sm font-bold aria-pressed:border-foreground"
            >
              <span aria-hidden="true" className="size-5 rounded-full" style={{ background: s }} /> {s}
            </button>
          ))}
        </div>
      </fieldset>

      <AreaTexto id="contato_secretaria" rotulo="Contato da Secretaria de Turismo" defaultValue={v.contato_secretaria ?? ""} maxLength={600}
        erro={campos?.contato_secretaria} ajuda="Endereço, telefone ou WhatsApp oficial e horário de atendimento. Aparece no rodapé do portal." />
      <Campo id="ouvidoria_url" rotulo="Link da Ouvidoria oficial" type="url" inputMode="url" defaultValue={v.ouvidoria_url ?? ""}
        maxLength={500} erro={campos?.ouvidoria_url} ajuda="Endereço completo, começando com https://. Vazio: o link não aparece." />
      <AreaTexto id="aviso_privacidade" rotulo="Aviso de privacidade" defaultValue={v.aviso_privacidade ?? ""} maxLength={8000}
        erro={campos?.aviso_privacidade} ajuda="Texto mostrado em Aviso de privacidade no portal. Precisa de revisão jurídica da prefeitura." />
      <Campo id="referencia_icms" rotulo="Referência da cartilha do ICMS Ecológico" defaultValue={v.referencia_icms} required maxLength={200}
        erro={campos?.referencia_icms} ajuda="Ex.: item 6.1.4. Atualize se a cartilha mudar a numeração." />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}

export function EnviarImagemMunicipio({ municipioId, qual, url, rotulo, ajuda }: {
  municipioId: string; qual: ImagemMunicipio; url: string | null; rotulo: string; ajuda: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: ResultadoAcao | undefined, dados: FormData) => {
    const r = await enviarImagemMunicipio(municipioId, qual, anterior, dados);
    if (r?.ok) formulario.current?.reset();
    return r;
  }, undefined);
  const [remocao, setRemocao] = useState<ResultadoAcao | null>(null);
  const [removendo, iniciar] = useTransition();
  const id = `arquivo-${qual}`;

  return (
    <form ref={formulario} action={acao} className="flex flex-col gap-3 rounded-2xl border bg-superficie p-4">
      <h3 className="text-lg font-bold">{rotulo}</h3>
      <MensagemEstado
        erro={estado && !estado.ok ? estado.erro : remocao && !remocao.ok ? remocao.erro : null}
        aviso={estado?.ok ? estado.aviso : remocao?.ok ? remocao.aviso : null}
      />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- prévia no painel, sem otimização
        <img src={url} alt={`${rotulo} atual`} className={qual === "logo" ? "size-20 rounded-xl object-contain" : "aspect-[16/10] w-full rounded-xl object-cover"} />
      ) : (
        <p className="text-muted-foreground">Nenhuma imagem enviada. O portal mostra um espaço reservado, sem imagem inventada.</p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Arquivo</Label>
        <Input id={id} name="arquivo" type="file" required accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-ajuda`} className="h-auto py-2.5" />
        <span id={`${id}-ajuda`} className="text-sm text-muted-foreground">{ajuda} JPEG, PNG ou WebP até 5 MB.</span>
      </div>
      <Button type="submit" variant="outline" size="lg" disabled={pendente}>
        <Upload aria-hidden="true" /> {pendente ? "Enviando…" : "Enviar imagem"}
      </Button>
      {url ? (
        <Button type="button" variant="ghost" disabled={removendo} onClick={() => iniciar(async () => setRemocao(await removerImagemMunicipio(municipioId, qual)))}>
          <Trash2 aria-hidden="true" /> Remover imagem
        </Button>
      ) : null}
    </form>
  );
}
