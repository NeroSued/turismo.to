import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const variantesBotao = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Botão secundário de contorno escuro, como no canvas ("Registrar minha visita",
        // "Emitir voucher para visitante sem celular"): borda de 1,5px na cor do texto.
        contorno:
          "border-[1.5px] border-foreground bg-transparent text-foreground hover:bg-superficie hover:text-foreground",
        destructive:
          "bg-erro-suave text-erro hover:bg-erro hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Alvo de toque mínimo de 44px em todos os tamanhos.
        default: "h-11 gap-2 px-4 text-base font-bold",
        sm: "h-11 gap-1.5 px-3 text-sm font-bold",
        // Botão principal: 54px (CLAUDE.md pede 52 a 56px).
        lg: "h-[54px] gap-2.5 px-5 text-[17px] font-bold rounded-[14px]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type OpcoesBotao = Parameters<typeof variantesBotao>[0]

/**
 * Classes do botão, já mescladas com `cn`: a classe extra substitui a da variante em vez de
 * competir com ela (antes, um `<Link>` com `border-foreground` mantinha `border-border` e
 * `border-transparent` e a borda escura não aparecia).
 */
function buttonVariants(opcoes?: OpcoesBotao) {
  return cn(variantesBotao(opcoes))
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof variantesBotao>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(variantesBotao({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
