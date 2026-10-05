import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Mensagem de resultado de uma action: erro (alert) ou aviso (status). */
export function MensagemEstado({ erro, aviso }: { erro?: string | null; aviso?: string | null }) {
  if (erro) {
    return (
      <p role="alert" className="rounded-xl bg-erro-suave p-3 text-erro">
        {erro}
      </p>
    );
  }
  if (aviso) {
    return (
      <p role="status" className="rounded-xl bg-verde-suave p-3 text-primary">
        {aviso}
      </p>
    );
  }
  return null;
}

function Ajuda({ id, texto, erro }: { id: string; texto?: string; erro?: string }) {
  return (
    <>
      {texto ? (
        <span id={`${id}-ajuda`} className="text-sm text-muted-foreground">
          {texto}
        </span>
      ) : null}
      {erro ? (
        <span id={`${id}-erro`} className="text-sm font-bold text-erro">
          {erro}
        </span>
      ) : null}
    </>
  );
}

function descritores(id: string, ajuda?: string, erro?: string) {
  return [ajuda ? `${id}-ajuda` : null, erro ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined;
}

type CampoProps = { id: string; rotulo: React.ReactNode; ajuda?: string; erro?: string } & React.ComponentProps<"input">;

export function Campo({ id, rotulo, ajuda, erro, className, ...resto }: CampoProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        name={resto.name ?? id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores(id, ajuda, erro)}
        {...resto}
      />
      <Ajuda id={id} texto={ajuda} erro={erro} />
    </div>
  );
}

type AreaProps = { id: string; rotulo: React.ReactNode; ajuda?: string; erro?: string } & React.ComponentProps<"textarea">;

export function AreaTexto({ id, rotulo, ajuda, erro, className, ...resto }: AreaProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      <textarea
        id={id}
        name={resto.name ?? id}
        rows={4}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores(id, ajuda, erro)}
        className="min-h-24 w-full rounded-xl border border-input bg-superficie px-3 py-2.5 text-base aria-invalid:border-erro aria-invalid:bg-erro-suave"
        {...resto}
      />
      <Ajuda id={id} texto={ajuda} erro={erro} />
    </div>
  );
}

type CaixaProps = { id: string; rotulo: React.ReactNode; ajuda?: string } & React.ComponentProps<"input">;

/** Caixa de marcação com área de toque de 44px+ e rótulo clicável. */
export function CaixaMarcacao({ id, rotulo, ajuda, ...resto }: CaixaProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
        <input
          id={id}
          name={resto.name ?? id}
          type="checkbox"
          className="size-6 shrink-0 accent-[var(--cor-municipal)]"
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          {...resto}
        />
        {rotulo}
      </label>
      {ajuda ? (
        <span id={`${id}-ajuda`} className="pl-9 text-sm text-muted-foreground">
          {ajuda}
        </span>
      ) : null}
    </div>
  );
}

type SelecaoProps = { id: string; rotulo: React.ReactNode; erro?: string } & React.ComponentProps<"select">;

export function Selecao({ id, rotulo, erro, className, children, ...resto }: SelecaoProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      <select
        id={id}
        name={resto.name ?? id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className="h-12 w-full rounded-xl border border-input bg-superficie px-3 text-base aria-invalid:border-erro"
        {...resto}
      >
        {children}
      </select>
      <Ajuda id={id} erro={erro} />
    </div>
  );
}

/** Selo de status (texto, nunca só cor). */
export function Selo({ tom = "verde", children }: { tom?: "verde" | "dourado" | "cinza" | "erro"; children: React.ReactNode }) {
  const tons = {
    verde: "bg-verde-suave text-primary",
    dourado: "bg-dourado-suave text-dourado-texto",
    cinza: "bg-[#E4E7E0] text-[#3D4740]",
    erro: "bg-erro-suave text-erro",
  };
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold", tons[tom])}>
      {children}
    </span>
  );
}
