"use client";

import { Minus, Plus, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { Campo, MensagemEstado, Selecao } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EstadoReserva } from "@/lib/voucher/acoes-publicas";
import { UFS_ORIGEM } from "@/lib/voucher/esquemas";

export type SessaoOpcao = {
  id: string;
  dia: string; // "2026-10-12"
  semana: string; // "Sáb"
  diaMes: string; // "12"
  dataCurta: string; // "12/10"
  hora: string; // "08:00"
  vagas: number | null; // restantes; null = sem limite
};

export type AtividadeReserva = {
  id: string;
  titulo: string;
  modo: "reserva" | "registro_voluntario";
  max_pessoas_por_voucher: number;
  exige_responsavel: boolean;
  exige_contato: boolean;
};

type Props = {
  atividade: AtividadeReserva;
  sessoes: SessaoOpcao[];
  chave: string;
  hoje: string;
  ultimoDia: string;
  acao: (estado: EstadoReserva, dados: FormData) => Promise<EstadoReserva>;
  rotuloBotao: string;
  /** Emissão assistida: textos voltados ao operador. */
  assistida?: boolean;
};

const textoVagas = (v: number | null) => (v === null ? "Vagas livres" : v === 0 ? "Esgotado" : v === 1 ? "1 vaga" : `${v} vagas`);

export function FormularioReserva({ atividade, sessoes, chave, hoje, ultimoDia, acao, rotuloBotao, assistida }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const campos = estado?.campos;
  const reserva = atividade.modo === "reserva";

  const dias = [...new Map(sessoes.map((s) => [s.dia, s])).values()];
  const primeiraComVaga = sessoes.find((s) => s.vagas === null || s.vagas > 0);
  const [dia, setDia] = useState(primeiraComVaga?.dia ?? dias[0]?.dia ?? "");
  const [sessaoId, setSessaoId] = useState(primeiraComVaga?.id ?? "");
  const [pessoas, setPessoas] = useState(1);
  const [dataVisita, setDataVisita] = useState(hoje);

  const doDia = sessoes.filter((s) => s.dia === dia);
  const sessao = sessoes.find((s) => s.id === sessaoId);
  const livres = reserva ? (sessao ? (sessao.vagas ?? Infinity) : 0) : Infinity;
  const maximo = Math.max(1, Math.min(atividade.max_pessoas_por_voucher, livres));
  const qtd = Math.min(pessoas, maximo);
  const passo = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

  if (reserva && sessoes.length === 0) {
    return (
      <p className="rounded-2xl border bg-superficie p-4 text-muted-foreground">
        Não há horários abertos para reserva nesta atividade agora. Volte mais tarde ou fale com a Secretaria de Turismo.
      </p>
    );
  }

  const escolherDia = (d: string) => {
    setDia(d);
    const s = sessoes.find((x) => x.dia === d && (x.vagas === null || x.vagas > 0));
    setSessaoId(s?.id ?? "");
  };

  let n = 0;
  const etapa = () => ++n;

  return (
    <form action={enviar} className="flex flex-col gap-7" noValidate>
      <input type="hidden" name="atividade_id" value={atividade.id} />
      <input type="hidden" name="chave_idempotencia" value={chave} />
      <input type="hidden" name="pessoas" value={qtd} />
      <MensagemEstado erro={estado?.erro} />

      {reserva ? (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[17px] font-bold">
              <span className="text-muted-foreground">{etapa()}.</span> Escolha a data
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {dias.map((d) => (
                <label
                  key={d.dia}
                  className={cn(
                    "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-[14px] border-[1.5px] p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-dourado",
                    d.dia === dia ? "border-primary bg-primary text-primary-foreground" : "border-border bg-superficie",
                  )}
                >
                  <input type="radio" name="dia" value={d.dia} checked={d.dia === dia} onChange={() => escolherDia(d.dia)} className="sr-only" />
                  <span className="text-[13px]">{d.semana}</span>
                  <span className="font-heading text-[22px] leading-tight font-bold">{d.diaMes}</span>
                  <span className="sr-only">{d.dataCurta}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-3 text-[17px] font-bold">
              <span className="text-muted-foreground">{etapa()}.</span> Escolha o horário
            </legend>
            {doDia.map((s) => {
              const esgotado = s.vagas === 0;
              const marcado = s.id === sessaoId;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex min-h-14 items-center justify-between rounded-[14px] border-[1.5px] px-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-dourado",
                    esgotado
                      ? "cursor-not-allowed border-[#E4E7E0] bg-[#E4E7E0] text-[#5E675F]"
                      : marcado
                        ? "cursor-pointer border-primary bg-primary text-primary-foreground"
                        : "cursor-pointer border-border bg-superficie",
                  )}
                >
                  <input
                    type="radio"
                    name="sessao_id"
                    value={s.id}
                    checked={marcado}
                    disabled={esgotado}
                    onChange={() => setSessaoId(s.id)}
                    className="sr-only"
                  />
                  <span className="text-lg font-bold">{s.hora}</span>
                  <span className="text-sm">{textoVagas(s.vagas)}</span>
                </label>
              );
            })}
            {campos?.sessao_id ? <span className="text-sm font-bold text-erro">{campos.sessao_id}</span> : null}
          </fieldset>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-[14px] bg-dourado-suave p-3.5 text-dourado-texto">
            O acesso a este atrativo é livre. Este registro é voluntário e <strong>não condiciona a entrada</strong>: ele
            ajuda a Secretaria de Turismo a conhecer quem visita o município.
          </p>
          <Campo
            id="data_visita"
            rotulo={
              <>
                <span className="text-muted-foreground">{etapa()}.</span> Dia da visita
              </>
            }
            type="date"
            min={hoje}
            max={ultimoDia}
            value={dataVisita}
            onChange={(e) => setDataVisita(e.target.value)}
            required
            erro={campos?.data_visita}
          />
        </div>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="titulo-pessoas">
        <h2 id="titulo-pessoas" className="font-sans text-[17px] font-bold tracking-normal">
          <span className="text-muted-foreground">{etapa()}.</span> {assistida ? "Quantas pessoas no grupo?" : "Quantas pessoas vão?"}
        </h2>
        <div className="flex items-center justify-between rounded-[14px] border bg-superficie p-2">
          <Button type="button" variant="outline" className="size-[52px] bg-background" aria-label="Diminuir quantidade"
            disabled={qtd <= 1} onClick={() => setPessoas(Math.max(1, qtd - 1))}>
            <Minus aria-hidden="true" className="size-[22px]" />
          </Button>
          <output aria-live="polite" className="flex flex-col items-center leading-tight" aria-label="Pessoas">
            <span className="font-heading text-[32px] font-bold">{qtd}</span>
            <span className="text-[13px] text-muted-foreground">{qtd === 1 ? "pessoa" : "pessoas"}</span>
          </output>
          <Button type="button" variant="outline" className="size-[52px] bg-background" aria-label="Aumentar quantidade"
            disabled={qtd >= maximo} onClick={() => setPessoas(Math.min(maximo, qtd + 1))}>
            <Plus aria-hidden="true" className="size-[22px]" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {reserva && sessao && sessao.vagas !== null
            ? `Restam ${sessao.vagas === 1 ? "1 vaga" : `${sessao.vagas} vagas`} neste horário. As vagas contam pessoas, não vouchers. `
            : ""}
          Até {passo(atividade.max_pessoas_por_voucher)} por voucher. Crianças de colo também contam.
        </p>
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="titulo-origem">
        <h2 id="titulo-origem" className="font-sans text-[17px] font-bold tracking-normal">
          <span className="text-muted-foreground">{etapa()}.</span> {assistida ? "De onde o grupo vem?" : "De onde vocês vêm?"}
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
          <Campo id="cidade" rotulo="Cidade" autoComplete="address-level2" placeholder="Ex.: Gurupi" required maxLength={80}
            erro={campos?.cidade} />
          <Selecao id="uf" rotulo="UF" defaultValue="TO" erro={campos?.uf}>
            {UFS_ORIGEM.map((uf) => (
              <option key={uf} value={uf}>
                {uf === "EX" ? "Exterior" : uf}
              </option>
            ))}
          </Selecao>
        </div>
        {atividade.exige_responsavel ? (
          <Campo id="nome_responsavel" rotulo="Nome do responsável pelo grupo" autoComplete={assistida ? "off" : "name"} required
            maxLength={120} ajuda="Pedido pela organização desta atividade, para a lista do condutor." erro={campos?.nome_responsavel} />
        ) : null}
        {atividade.exige_contato ? (
          <Campo id="contato" rotulo="Telefone para avisos" type="tel" inputMode="tel" autoComplete={assistida ? "off" : "tel"}
            placeholder="(63) 9 0000-0000" required maxLength={120} ajuda="Usado só para avisos sobre esta atividade."
            erro={campos?.contato} />
        ) : null}
      </section>

      <div className="flex gap-3 rounded-[14px] border bg-superficie p-3.5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-[22px] shrink-0 text-primary" />
        <p className="text-sm text-[#3D4740]">
          Não pedimos CPF, documento nem endereço. A cidade de origem entra nas estatísticas do município
          {atividade.exige_responsavel || atividade.exige_contato
            ? "; nome e telefone são usados só para organizar esta atividade."
            : "."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={pendente || (reserva && !sessaoId)}>
          {pendente ? "Emitindo…" : rotuloBotao}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          {reserva && sessao ? `${sessao.semana} ${sessao.dataCurta} às ${sessao.hora} · ${passo(qtd)}` : passo(qtd)} · gratuito
        </p>
      </div>
    </form>
  );
}
