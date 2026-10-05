"use client";

import { useActionState, useState, useTransition } from "react";
import { AreaTexto, CaixaMarcacao, Campo, MensagemEstado } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import {
  adicionarSessao,
  alterarCapacidade,
  alternarSessao,
  criarAtividade,
  excluirSessao,
  mudarStatusAtividade,
  salvarAtividade,
} from "@/lib/atividades/acoes";
import type { ResultadoAcao } from "@/lib/painel/contexto";

type Valores = {
  titulo: string;
  descricao: string | null;
  local_encontro: string | null;
  condicoes: string | null;
  max_pessoas_por_voucher: number;
  exige_responsavel: boolean;
  exige_contato: boolean;
};

function CamposComuns({ v, campos }: { v?: Valores; campos?: Record<string, string> }) {
  return (
    <>
      <Campo id="titulo" rotulo="Nome da atividade" defaultValue={v?.titulo} required maxLength={120} erro={campos?.titulo}
        ajuda="Como aparece no portal. Ex.: Visita guiada à cachoeira." />
      <AreaTexto id="descricao" rotulo="Descrição" defaultValue={v?.descricao ?? ""} maxLength={4000} erro={campos?.descricao} />
      <Campo id="local_encontro" rotulo="Local ou ponto de encontro" defaultValue={v?.local_encontro ?? ""} maxLength={300}
        erro={campos?.local_encontro} />
      <AreaTexto id="condicoes" rotulo="Condições da atividade" defaultValue={v?.condicoes ?? ""} maxLength={2000}
        erro={campos?.condicoes} ajuda="Idade mínima, o que levar, acessibilidade, regras ambientais." />
      <Campo id="max_pessoas_por_voucher" rotulo="Máximo de pessoas por voucher" type="number" inputMode="numeric" min={1} max={50}
        defaultValue={v?.max_pessoas_por_voucher ?? 10} required erro={campos?.max_pessoas_por_voucher} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Dados pedidos ao visitante</legend>
        <p className="text-sm text-muted-foreground">
          Cidade, UF e número de pessoas são sempre pedidos. Marque nome ou telefone só se a atividade precisar
          (por exemplo, lista do condutor). Nunca pedimos CPF, documento ou endereço.
        </p>
        <CaixaMarcacao id="exige_responsavel" rotulo="Pedir nome do responsável pelo grupo" defaultChecked={v?.exige_responsavel} />
        <CaixaMarcacao id="exige_contato" rotulo="Pedir telefone para avisos" defaultChecked={v?.exige_contato} />
      </fieldset>
    </>
  );
}

export function FormularioNovaAtividade() {
  const [estado, acao, pendente] = useActionState(criarAtividade, undefined);
  const campos = estado && !estado.ok ? estado.campos : undefined;
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Tipo da atividade</legend>
        <label className="flex cursor-pointer gap-3 rounded-2xl border bg-superficie p-3.5 has-[:checked]:border-primary has-[:checked]:bg-verde-suave">
          <input type="radio" name="modo" value="reserva" defaultChecked required className="mt-1 size-5 shrink-0 accent-[var(--cor-municipal)]" />
          <span className="flex flex-col">
            <span className="font-bold">Reserva gratuita</span>
            <span className="text-sm text-muted-foreground">Passeios e visitas com data, horário e, se preciso, limite de vagas.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-2xl border bg-superficie p-3.5 has-[:checked]:border-primary has-[:checked]:bg-verde-suave">
          <input type="radio" name="modo" value="registro_voluntario" className="mt-1 size-5 shrink-0 accent-[var(--cor-municipal)]" />
          <span className="flex flex-col">
            <span className="font-bold">Registro voluntário</span>
            <span className="text-sm text-muted-foreground">
              Atrativo de acesso livre. O visitante se registra se quiser; o cadastro não condiciona a entrada.
            </span>
          </span>
        </label>
        {campos?.modo ? <span className="text-sm font-bold text-erro">{campos.modo}</span> : null}
      </fieldset>
      <CamposComuns campos={campos} />
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Salvando…" : "Criar atividade"}
      </Button>
      <p className="text-sm text-muted-foreground">A atividade começa em elaboração e só aparece no portal depois de publicada.</p>
    </form>
  );
}

export function FormularioEditarAtividade({ id, valores }: { id: string; valores: Valores }) {
  const [estado, acao, pendente] = useActionState(salvarAtividade.bind(null, id), undefined);
  return (
    <form action={acao} className="flex flex-col gap-5">
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <CamposComuns v={valores} campos={estado && !estado.ok ? estado.campos : undefined} />
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

export function AcoesStatus({ id, status, modo, temSessoes }: { id: string; status: string; modo: string; temSessoes: boolean }) {
  const { resultado, pendente, executar } = useAcaoSimples();
  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado erro={resultado && !resultado.ok ? resultado.erro : null} aviso={resultado?.ok ? resultado.aviso : null} />
      {status !== "publicado" ? (
        <>
          {modo === "reserva" && !temSessoes ? (
            <p className="rounded-xl bg-dourado-suave p-3 text-dourado-texto">
              Ainda não há horários. Você pode publicar agora, mas o visitante só consegue reservar depois que houver um horário futuro.
            </p>
          ) : null}
          <Button size="lg" disabled={pendente} onClick={() => executar(() => mudarStatusAtividade(id, "publicado"))}>
            Publicar no portal
          </Button>
        </>
      ) : null}
      {status === "publicado" ? (
        <Button size="lg" variant="outline" disabled={pendente} onClick={() => executar(() => mudarStatusAtividade(id, "rascunho"))}>
          Voltar para elaboração
        </Button>
      ) : null}
      {status !== "arquivado" ? (
        <Button variant="ghost" disabled={pendente} onClick={() => executar(() => mudarStatusAtividade(id, "arquivado"))}>
          Arquivar atividade
        </Button>
      ) : null}
    </div>
  );
}

export function FormularioSessao({ atividadeId, hoje }: { atividadeId: string; hoje: string }) {
  const [estado, acao, pendente] = useActionState(adicionarSessao.bind(null, atividadeId), undefined);
  const campos = estado && !estado.ok ? estado.campos : undefined;
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-2xl border bg-superficie p-4">
      <h3 className="text-lg font-bold">Novo horário</h3>
      <MensagemEstado erro={estado && !estado.ok ? estado.erro : null} aviso={estado?.ok ? estado.aviso : null} />
      <Campo id="dia" rotulo="Data" type="date" min={hoje} required erro={campos?.dia} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="hora_inicio" rotulo="Início" type="time" required erro={campos?.hora_inicio} />
        <Campo id="hora_fim" rotulo="Término" type="time" required erro={campos?.hora_fim} />
      </div>
      <Campo id="capacidade" rotulo="Vagas (pessoas)" type="number" inputMode="numeric" min={1} max={10000}
        ajuda="Deixe vazio para sem limite. As vagas contam pessoas, não vouchers." erro={campos?.capacidade} />
      <p className="text-sm text-muted-foreground">Horários no fuso de Tocantins (America/Araguaina).</p>
      <Button type="submit" size="lg" disabled={pendente}>
        {pendente ? "Adicionando…" : "Adicionar horário"}
      </Button>
    </form>
  );
}

export function ControlesSessao(p: {
  sessaoId: string;
  atividadeId: string;
  capacidade: number | null;
  reservadas: number;
  ativa: boolean;
  rotulo: string;
}) {
  const [estado, acao, pendenteCap] = useActionState(alterarCapacidade.bind(null, p.sessaoId, p.atividadeId), undefined);
  const { resultado, pendente, executar } = useAcaoSimples();
  const msg = resultado ?? estado ?? null;
  const idCap = `cap-${p.sessaoId}`;
  return (
    <div className="flex flex-col gap-3">
      <MensagemEstado erro={msg && !msg.ok ? msg.erro : null} aviso={msg?.ok ? msg.aviso : null} />
      <form action={acao} className="flex items-end gap-2">
        <Campo id={idCap} name="capacidade" rotulo={`Vagas de ${p.rotulo}`} type="number" inputMode="numeric" min={1} max={10000}
          defaultValue={p.capacidade ?? ""} placeholder="Sem limite" className="flex-1" />
        <Button type="submit" variant="outline" disabled={pendenteCap}>
          Salvar vagas
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pendente} onClick={() => executar(() => alternarSessao(p.sessaoId, p.atividadeId, !p.ativa))}>
          {p.ativa ? "Fechar para reservas" : "Reabrir para reservas"}
        </Button>
        {p.reservadas === 0 ? (
          <Button variant="destructive" size="sm" disabled={pendente} onClick={() => executar(() => excluirSessao(p.sessaoId, p.atividadeId))}>
            Excluir horário
          </Button>
        ) : null}
      </div>
    </div>
  );
}
