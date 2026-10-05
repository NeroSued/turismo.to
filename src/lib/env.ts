import { z } from "zod";

/**
 * Variáveis públicas. Referenciadas uma a uma porque o Next só embute no
 * navegador as que aparecem literalmente como process.env.NEXT_PUBLIC_*.
 */
const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1),
});

export function envPublico() {
  const r = esquemaPublico.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  });
  if (!r.success) {
    const faltando = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Variáveis de ambiente ausentes ou inválidas: ${faltando}. Copie .env.example para .env.local e preencha.`,
    );
  }
  return r.data;
}

/** Override de município por ?municipio= só quando explicitamente permitido. */
export function overrideDeMunicipioPermitido(): boolean {
  return process.env.ALLOW_TENANT_OVERRIDE === "true";
}
