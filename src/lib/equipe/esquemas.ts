import { z } from "zod";

export const PAPEIS_EQUIPE = ["gestor", "operador"] as const;
export type PapelEquipe = (typeof PAPEIS_EQUIPE)[number];

export const ROTULO_PAPEL_EQUIPE: Record<PapelEquipe, string> = {
  gestor: "Gestor municipal",
  operador: "Operador",
};

export const DESCRICAO_PAPEL_EQUIPE: Record<PapelEquipe, string> = {
  gestor: "Cuida do conteúdo, vouchers, relatórios, evidências e da equipe do município.",
  operador: "Só atende visitantes: confere e confirma vouchers e emite voucher para quem não tem celular.",
};

// Campos extras (como admin_assessoria) são recusados: nada além disto chega ao servidor.
export const esquemaConvite = z.strictObject({
  municipio_id: z.uuid({ error: "Município inválido." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um e-mail válido, como nome@prefeitura.to.gov.br." }).max(254)),
  nome: z
    .string()
    .trim()
    .max(120, { error: "Use até 120 caracteres." })
    .transform((v) => v || null),
  papel: z.enum(PAPEIS_EQUIPE, { error: "Escolha gestor ou operador." }),
});

export const esquemaAlteracaoVinculo = z.strictObject({
  municipio_id: z.uuid(),
  vinculo_id: z.uuid(),
  papel: z.enum(PAPEIS_EQUIPE).optional(),
  ativo: z.boolean().optional(),
});
