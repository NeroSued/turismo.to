import { z } from "zod";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const marcado = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const esquemaAtividade = z.object({
  titulo: z.string().trim().min(3, "Informe um nome com pelo menos 3 letras.").max(120, "Use no máximo 120 caracteres."),
  descricao: textoOpcional(4000),
  local_encontro: textoOpcional(300),
  condicoes: textoOpcional(2000),
  max_pessoas_por_voucher: z.coerce
    .number({ message: "Informe um número." })
    .int("Informe um número inteiro.")
    .min(1, "O mínimo é 1 pessoa por voucher.")
    .max(50, "O máximo é 50 pessoas por voucher."),
  exige_responsavel: marcado,
  exige_contato: marcado,
  // Ausente no formulário de criação: fica null (sem prestador).
  prestador_id: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ? v : null))
    .pipe(z.uuid("Prestador inválido.").nullable()),
});

export const esquemaNovaAtividade = esquemaAtividade.extend({
  modo: z.enum(["reserva", "registro_voluntario"], { message: "Escolha o tipo da atividade." }),
});

export const STATUS_ATIVIDADE = ["rascunho", "publicado", "arquivado"] as const;
export type StatusAtividade = (typeof STATUS_ATIVIDADE)[number];
export type ModoAtividade = "reserva" | "registro_voluntario";

const capacidade = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 10000) {
      ctx.addIssue({ code: "custom", message: "Vagas: um número de 1 a 10000, ou vazio para sem limite." });
      return z.NEVER;
    }
    return n;
  });

export const esquemaSessao = z
  .object({
    dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário de início."),
    hora_fim: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário de término."),
    capacidade,
  })
  .refine((s) => s.hora_fim > s.hora_inicio, {
    message: "O término precisa ser depois do início, no mesmo dia.",
    path: ["hora_fim"],
  });

export const esquemaCapacidade = z.object({ capacidade });

/** Primeira mensagem de cada campo, para mostrar junto do campo. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const i of erro.issues) {
    const k = String(i.path[0] ?? "formulario");
    campos[k] ??= i.message;
  }
  return campos;
}

export const ROTULO_STATUS: Record<StatusAtividade, string> = {
  rascunho: "Em elaboração",
  publicado: "Publicada",
  arquivado: "Arquivada",
};

export const ROTULO_MODO: Record<ModoAtividade, string> = {
  reserva: "Reserva gratuita",
  registro_voluntario: "Registro voluntário",
};
