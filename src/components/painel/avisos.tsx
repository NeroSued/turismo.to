"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type RefObject,
} from "react";
import type { ResultadoAcao } from "@/lib/painel/contexto";

/** Tempo, em milissegundos, que o aviso de sucesso fica na tela (pausa com dedo, mouse ou foco). */
export const DURACAO_AVISO = 3000;

type TipoAviso = "sucesso" | "erro";
type Aviso = { id: number; tipo: TipoAviso; texto: string };
type Mostrar = (tipo: TipoAviso, texto: string) => void;

const ContextoAvisos = createContext<Mostrar | null>(null);
const nenhum: Mostrar = () => {};

/**
 * Aviso flutuante único do painel (Fase 8.1). Um aviso por vez: o novo substitui o anterior.
 * As regiões `status` e `alert` ficam sempre na página, para o leitor de tela anunciar o que entra nelas.
 */
export function ProvedorAvisos({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const contador = useRef(0);
  const mostrar = useCallback<Mostrar>((tipo, texto) => {
    contador.current += 1;
    setAviso({ id: contador.current, tipo, texto });
  }, []);
  const fechar = useCallback(() => setAviso(null), []);

  return (
    <ContextoAvisos.Provider value={mostrar}>
      {children}
      {/* Celular: centralizado, acima da barra inferior (64px + borda). A partir de 768px: canto inferior direito. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:justify-end md:px-6 print:hidden">
        <div role="status" aria-live="polite">
          {aviso?.tipo === "sucesso" ? <PilulaAviso key={aviso.id} aviso={aviso} onFechar={fechar} /> : null}
        </div>
        <div role="alert">
          {aviso?.tipo === "erro" ? <PilulaAviso key={aviso.id} aviso={aviso} onFechar={fechar} /> : null}
        </div>
      </div>
    </ContextoAvisos.Provider>
  );
}

function PilulaAviso({ aviso, onFechar }: { aviso: Aviso; onFechar: () => void }) {
  const sucesso = aviso.tipo === "sucesso";
  const [ponteiro, setPonteiro] = useState(false);
  const [foco, setFoco] = useState(false);
  const pausado = ponteiro || foco;
  const restante = useRef(DURACAO_AVISO);

  // Só o sucesso some sozinho. Ao pausar, guarda o tempo que faltava e retoma dali.
  useEffect(() => {
    if (!sucesso || pausado) return;
    const inicio = performance.now();
    const temporizador = window.setTimeout(onFechar, restante.current);
    return () => {
      window.clearTimeout(temporizador);
      restante.current = Math.max(0, restante.current - (performance.now() - inicio));
    };
  }, [sucesso, pausado, onFechar]);

  const Icone = sucesso ? CircleCheck : CircleAlert;
  return (
    <div
      data-aviso={aviso.tipo}
      data-pausado={pausado ? "" : undefined}
      onPointerEnter={() => setPonteiro(true)}
      onPointerLeave={() => setPonteiro(false)}
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false);
      }}
      className="pointer-events-auto relative flex w-fit max-w-[min(28rem,calc(100vw-2rem))] items-center gap-2.5 overflow-hidden rounded-[26px] bg-[#16211B] py-1 pr-1 pl-4 text-white shadow-[0_8px_24px_rgb(22_33_27/0.28)] animate-in duration-200 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      {sucesso ? (
        <div
          aria-hidden="true"
          className="aviso-progresso absolute inset-x-0 top-0 h-[3px] origin-left bg-[#C99A3B] motion-reduce:hidden"
          style={{ animationDuration: `${DURACAO_AVISO}ms`, animationPlayState: pausado ? "paused" : "running" }}
        />
      ) : null}
      <Icone aria-hidden="true" className={sucesso ? "size-5 shrink-0 text-[#8FCBA3]" : "size-5 shrink-0 text-[#F0A08A]"} />
      <p className="flex-1 py-2.5 text-[15px] leading-snug font-bold">{aviso.texto}</p>
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar aviso"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

/** Mostra um aviso flutuante. Fora do painel (sem provedor) não faz nada. */
export function useAvisos(): Mostrar {
  return useContext(ContextoAvisos) ?? nenhum;
}

/**
 * Transforma o resultado de uma action em aviso flutuante (Fases 8.2 e 8.3). No erro, o aviso fica
 * até a pessoa fechar e o foco vai para o primeiro campo marcado como inválido dentro de `area`.
 */
export function useAvisoDoResultado(resultado: ResultadoAcao | null | undefined, area?: RefObject<HTMLElement | null>) {
  const mostrar = useAvisos();
  useEffect(() => {
    if (!resultado) return;
    if (resultado.ok) {
      if (resultado.aviso) mostrar("sucesso", resultado.aviso);
      return;
    }
    mostrar("erro", resultado.erro);
    area?.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [resultado, mostrar, area]);
}

/**
 * Para `<form action>` com `useActionState`: aviso do resultado e um único envio por vez (Fase 8.5).
 * Um segundo envio enquanto o primeiro não terminou é descartado (o React não chama a action
 * quando o `submit` foi cancelado).
 */
export function useFormularioPainel(
  resultado: ResultadoAcao | null | undefined,
  pendente: boolean,
  externo?: RefObject<HTMLFormElement | null>,
) {
  const interno = useRef<HTMLFormElement>(null);
  const ref = externo ?? interno;
  const enviando = useRef(false);
  useEffect(() => {
    if (!pendente) enviando.current = false;
  }, [pendente, resultado]);
  useAvisoDoResultado(resultado, ref);
  const onSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    if (enviando.current) e.preventDefault();
    else enviando.current = true;
  }, []);
  return { ref, onSubmit };
}

/**
 * Para botões que chamam uma action fora de formulário (publicar, arquivar, equipe...): um envio
 * por vez, aviso do resultado e qual botão está salvando.
 */
export function useAcaoPainel() {
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const [pendente, iniciar] = useTransition();
  const [chave, setChave] = useState<string | null>(null);
  const ocupado = useRef(false);
  useAvisoDoResultado(resultado);
  const executar = (f: () => Promise<ResultadoAcao>, qual = "acao") => {
    if (ocupado.current) return;
    ocupado.current = true;
    setChave(qual);
    iniciar(async () => {
      try {
        const r = await f();
        setResultado(r);
      } finally {
        ocupado.current = false;
      }
    });
  };
  const salvando = (qual = "acao") => pendente && chave === qual;
  return { resultado, pendente, executar, salvando };
}

/**
 * Aviso depois de um redirecionamento (ex.: criar e abrir a edição). Mostra uma vez e tira o
 * parâmetro da URL, para não repetir ao recarregar.
 */
export function AvisoDeChegada({ texto, parametro }: { texto: string; parametro: string }) {
  const mostrar = useAvisos();
  useEffect(() => {
    mostrar("sucesso", texto);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(parametro)) return;
    url.searchParams.delete(parametro);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [mostrar, texto, parametro]);
  return null;
}
