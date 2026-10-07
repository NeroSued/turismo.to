"use client";

import { ArrowDown, ArrowUp, Camera, Images, Star, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useAvisos, useFormularioPainel } from "@/components/painel/avisos";
import { enviarDireto } from "@/lib/arquivos/envio-direto";
import { adicionarFoto, salvarFotos } from "@/lib/fotos/acoes";
import { LIMITE_FOTOS, type TipoFoto } from "@/lib/fotos/tipos";
import { cn } from "@/lib/utils";

export type FotoDoPainel = { id: string; url: string; legenda: string | null; alt: string };

type Envio = { chave: string; nome: string; erro?: string };

const campoTexto =
  "min-h-11 w-full rounded-[10px] border-[1.5px] border-[#B9C1B5] bg-superficie px-3 text-base text-foreground aria-[invalid=true]:border-erro";
const botaoFoto =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border bg-background text-sm font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-35";

/** Tela "Gestor · fotos do cadastro": tirar ou escolher fotos, capa, galeria, legendas e crédito. */
export function GerenciarFotos({
  tipo,
  donoId,
  nome,
  fotos,
  credito,
}: {
  tipo: TipoFoto;
  donoId: string;
  nome: string;
  fotos: FotoDoPainel[];
  credito: string | null;
}) {
  const router = useRouter();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const mostrar = useAvisos();
  const [estado, acao, pendente] = useActionState(salvarFotos.bind(null, tipo, donoId), undefined);
  const { ref, onSubmit } = useFormularioPainel(estado, pendente);
  const enviando = envios.some((e) => !e.erro);
  const cheio = fotos.length >= LIMITE_FOTOS;
  const erroDe = (campo: string) => (estado && !estado.ok ? estado.campos?.[campo] : undefined);
  const valorDe = (campo: string, padrao: string | null) =>
    estado && !estado.ok && estado.valores?.[campo] !== undefined ? estado.valores[campo] : (padrao ?? "");
  // Depois de um erro, os campos remontam com o que foi digitado (o React reseta o formulário).
  const versao = estado && !estado.ok ? `erro-${JSON.stringify(estado.valores)}` : "ok";

  async function enviar(lista: FileList | null, campo: HTMLInputElement) {
    const arquivos = Array.from(lista ?? []);
    campo.value = "";
    if (!arquivos.length) return;
    const novos = arquivos.map((a, i) => ({ chave: `${Date.now()}-${i}`, nome: a.name || `foto ${i + 1}` }));
    setEnvios((atual) => [...atual.filter((e) => !e.erro), ...novos]);
    let enviadas = 0;
    // Uma por vez: a ordem de envio é a ordem na galeria, e o limite de 12 é conferido a cada foto.
    for (const [i, arquivo] of arquivos.entries()) {
      const dados = new FormData();
      dados.set("arquivo", arquivo);
      let erro: string | undefined;
      try {
        const r = await adicionarFoto(tipo, donoId, await enviarDireto(dados, "arquivo", "foto_original", "fotos"));
        if (r.ok) enviadas += 1;
        else erro = r.erro;
      } catch {
        erro = "A conexão caiu durante o envio. Confira a internet e tente de novo.";
      }
      setEnvios((atual) => (erro ? atual.map((e) => (e.chave === novos[i].chave ? { ...e, erro } : e)) : atual.filter((e) => e.chave !== novos[i].chave)));
      if (!erro) router.refresh();
    }
    if (enviadas) {
      mostrar("sucesso", `${enviadas === 1 ? "Foto enviada" : `${enviadas} fotos enviadas`}. GPS e dados da câmera removidos.`);
    }
  }

  const [capa, ...galeria] = fotos;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-2">
        <label
          className={cn(
            "relative flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-primary font-bold text-primary-foreground has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#C99A3B]",
            (cheio || enviando) && "cursor-not-allowed opacity-50",
          )}
        >
          <Camera aria-hidden="true" className="size-5" /> Tirar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={cheio || enviando}
            onChange={(e) => enviar(e.currentTarget.files, e.currentTarget)}
          />
        </label>
        <label
          className={cn(
            "relative box-border flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-foreground font-bold text-foreground has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#C99A3B]",
            (cheio || enviando) && "cursor-not-allowed opacity-50",
          )}
        >
          <Images aria-hidden="true" className="size-5" /> Da galeria
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={cheio || enviando}
            onChange={(e) => enviar(e.currentTarget.files, e.currentTarget)}
          />
        </label>
      </div>
      <p className="-mt-2 text-[13px] text-muted-foreground">
        {cheio
          ? `Este cadastro chegou a ${LIMITE_FOTOS} fotos, o máximo. Retire uma para enviar outra.`
          : `JPG, PNG ou WebP até 10 MB, até ${LIMITE_FOTOS} fotos. A localização GPS gravada na foto é removida antes de publicar.`}
      </p>

      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {envios
          .filter((e) => !e.erro)
          .map((e) => (
            <div key={e.chave} className="flex items-center gap-2.5 rounded-2xl border bg-superficie p-2.5">
              <div aria-hidden="true" className="marcador-foto size-14 shrink-0 rounded-[10px] opacity-60" />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-bold">Enviando {e.nome}</span>
                <div role="progressbar" aria-label={`Envio de ${e.nome}`} className="h-2 overflow-hidden rounded-full bg-[#E4E7E0]">
                  <div className="h-2 w-1/2 animate-pulse rounded-full bg-primary" />
                </div>
              </div>
            </div>
          ))}
      </div>
      {envios
        .filter((e) => e.erro)
        .map((e) => (
          <div key={e.chave} role="alert" className="flex gap-2.5 rounded-[14px] bg-erro-suave px-3.5 py-3 text-[#7A2C1D]">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm">
              <strong>{e.nome} não foi enviado.</strong> {e.erro}
            </p>
          </div>
        ))}

      <form ref={ref} action={acao} onSubmit={onSubmit} className="flex flex-col gap-[18px]" key={versao}>
        {!capa ? (
          <div className="flex flex-col gap-1 rounded-2xl border bg-superficie p-4">
            <p className="font-bold">Nenhuma foto ainda.</p>
            <p className="text-muted-foreground">
              Tire uma foto ou escolha da galeria. A primeira vira a capa, que aparece nas listas do portal. Use fotos oficiais ou
              cedidas com autorização.
            </p>
          </div>
        ) : (
          <section aria-labelledby="capa-titulo" className="flex flex-col gap-2.5">
            <h2 id="capa-titulo" className="text-[17px] font-bold">Capa</h2>
            <div className="overflow-hidden rounded-2xl border bg-superficie">
              <div className="relative h-60">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia do painel, já reduzida no envio */}
                <img src={capa.url} alt={capa.alt} className="size-full object-cover" />
                <span className="absolute top-2.5 left-2.5 rounded-full bg-[#C99A3B] px-2.5 py-0.5 text-xs font-bold text-foreground">Capa</span>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <label htmlFor={`legenda-${capa.id}`} className="text-sm font-bold">Legenda</label>
                <input
                  id={`legenda-${capa.id}`}
                  name={`legenda:${capa.id}`}
                  type="text"
                  maxLength={200}
                  defaultValue={valorDe(`legenda:${capa.id}`, capa.legenda)}
                  placeholder="O que aparece na foto?"
                  aria-invalid={erroDe(`legenda:${capa.id}`) ? true : undefined}
                  aria-describedby={`ajuda-${capa.id}`}
                  className={cn(campoTexto, "min-h-12 rounded-xl")}
                />
                <span id={`ajuda-${capa.id}`} className={cn("text-[13px]", erroDe(`legenda:${capa.id}`) ? "font-bold text-erro" : "text-muted-foreground")}>
                  {erroDe(`legenda:${capa.id}`) ??
                    `Descreva o que aparece. Ela também é lida por quem usa leitor de tela. Sem legenda, o portal usa “Foto 1 de ${nome}”.`}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    name="operacao"
                    value={`descer:${capa.id}`}
                    disabled={!galeria.length || pendente}
                    aria-label="Mover a capa para a galeria"
                    className={cn(botaoFoto, "w-11")}
                  >
                    <ArrowDown aria-hidden="true" className="size-[18px]" />
                  </button>
                  <button
                    type="submit"
                    name="operacao"
                    value={`retirar:${capa.id}`}
                    disabled={pendente}
                    className={cn(botaoFoto, "flex-1 border-[#E8C9C0] bg-erro-suave text-[#7A2C1D]")}
                  >
                    <Trash2 aria-hidden="true" className="size-[18px]" /> Retirar capa
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {galeria.length ? (
          <section aria-labelledby="galeria-titulo" className="flex flex-col gap-2.5">
            <h2 id="galeria-titulo" className="text-[17px] font-bold">Galeria</h2>
            <ol className="flex flex-col gap-2.5">
              {galeria.map((f, k) => {
                const n = k + 2;
                const rotulo = `foto ${n}`;
                const erro = erroDe(`legenda:${f.id}`);
                return (
                  <li key={f.id} className="flex flex-col gap-2.5 rounded-2xl border bg-superficie p-2.5">
                    <div className="flex gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do painel */}
                      <img src={f.url} alt={f.alt} loading="lazy" className="size-20 shrink-0 rounded-[10px] object-cover" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <label htmlFor={`legenda-${f.id}`} className="text-sm font-bold">Legenda da {rotulo}</label>
                        <input
                          id={`legenda-${f.id}`}
                          name={`legenda:${f.id}`}
                          type="text"
                          maxLength={200}
                          defaultValue={valorDe(`legenda:${f.id}`, f.legenda)}
                          placeholder="O que aparece na foto?"
                          aria-invalid={erro ? true : undefined}
                          aria-describedby={erro ? `erro-${f.id}` : undefined}
                          className={campoTexto}
                        />
                        {erro ? <span id={`erro-${f.id}`} className="text-[13px] font-bold text-erro">{erro}</span> : null}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="submit" name="operacao" value={`capa:${f.id}`} disabled={pendente} className={cn(botaoFoto, "flex-1")}>
                        <Star aria-hidden="true" className="size-4" /> Tornar capa
                      </button>
                      <button
                        type="submit"
                        name="operacao"
                        value={`subir:${f.id}`}
                        disabled={k === 0 || pendente}
                        aria-label={`Mover a ${rotulo} para cima`}
                        className={cn(botaoFoto, "w-11")}
                      >
                        <ArrowUp aria-hidden="true" className="size-[18px]" />
                      </button>
                      <button
                        type="submit"
                        name="operacao"
                        value={`descer:${f.id}`}
                        disabled={k === galeria.length - 1 || pendente}
                        aria-label={`Mover a ${rotulo} para baixo`}
                        className={cn(botaoFoto, "w-11")}
                      >
                        <ArrowDown aria-hidden="true" className="size-[18px]" />
                      </button>
                      <button
                        type="submit"
                        name="operacao"
                        value={`retirar:${f.id}`}
                        disabled={pendente}
                        aria-label={`Retirar a ${rotulo}`}
                        className={cn(botaoFoto, "w-11 border-[#E8C9C0] bg-erro-suave text-[#7A2C1D]")}
                      >
                        <Trash2 aria-hidden="true" className="size-[18px]" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {capa ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="credito" className="text-sm font-bold">
                Crédito das fotos <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="credito"
                name="credito"
                type="text"
                maxLength={120}
                defaultValue={valorDe("credito", credito)}
                placeholder="Ex.: Secretaria de Turismo"
                aria-invalid={erroDe("credito") ? true : undefined}
                aria-describedby="credito-ajuda"
                className={cn(campoTexto, "min-h-12 rounded-xl")}
              />
              <span id="credito-ajuda" className={cn("text-[13px]", erroDe("credito") ? "font-bold text-erro" : "text-muted-foreground")}>
                {erroDe("credito") ?? "Aparece na galeria do portal, abaixo de cada foto."}
              </span>
            </div>
            <button
              type="submit"
              name="operacao"
              value="salvar"
              disabled={pendente}
              className="mb-3 min-h-14 rounded-[14px] bg-primary text-[17px] font-bold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary),black_15%)] disabled:opacity-60"
            >
              {pendente ? "Salvando…" : "Salvar fotos"}
            </button>
          </>
        ) : null}
      </form>
    </div>
  );
}
