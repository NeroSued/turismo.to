import { cn } from "@/lib/utils";

/**
 * Coluna base das telas. Projetada para 390px; em telas maiores apenas
 * centraliza e limita a largura de leitura.
 */
export function Pagina({
  className,
  children,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-5 pb-6",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}
