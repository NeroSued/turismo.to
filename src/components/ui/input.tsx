import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // 48px de altura e 16px de fonte em qualquer largura (evita zoom no iOS).
        "h-12 w-full min-w-0 rounded-xl border border-input bg-superficie px-3 text-base transition-colors file:inline-flex file:h-8 file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-erro aria-invalid:bg-erro-suave",
        className
      )}
      {...props}
    />
  )
}

export { Input }
