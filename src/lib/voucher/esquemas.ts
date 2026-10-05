import { z } from "zod";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** UF de origem; EX = visitante do exterior. */
export const UFS_ORIGEM = [...UFS, "EX"] as const;

const alfabeto = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODIGO = new RegExp(`^[${alfabeto}]{12}$`);

/** Normaliza o código digitado ou lido do QR: maiúsculas, sem hífens nem espaços. */
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[\s-]/g, "");
}

export function codigoValido(entrada: string): boolean {
  return CODIGO.test(normalizarCodigo(entrada));
}

/** "7KQ4M2XP9WDT" → "7KQ4-M2XP-9WDT". */
export function formatarCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

const textoOpcional = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null)
    .refine((v) => v === null || (v.length >= min && v.length <= max), msg);

/** Entrada da emissão (pública ou assistida). O banco confere de novo tudo o que depende da atividade. */
export const esquemaEmissao = z.object({
  atividade_id: z.uuid({ message: "Atividade inválida." }),
  sessao_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null)
    .refine((v) => v === null || z.uuid().safeParse(v).success, "Escolha um horário."),
  data_visita: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Informe o dia da visita."),
  pessoas: z.coerce
    .number({ message: "Informe quantas pessoas vão." })
    .int("Informe um número inteiro.")
    .min(1, "Pelo menos 1 pessoa.")
    .max(50, "No máximo 50 pessoas por voucher."),
  cidade: z.string().trim().min(2, "Informe a cidade de origem.").max(80, "Use no máximo 80 caracteres."),
  uf: z.enum(UFS_ORIGEM, { message: "Escolha a UF." }),
  nome_responsavel: textoOpcional(2, 120, "Informe o nome do responsável (2 a 120 letras)."),
  contato: textoOpcional(8, 120, "Informe um telefone com DDD."),
  chave_idempotencia: z.uuid({ message: "Recarregue a página e tente de novo." }),
});

export type EntradaEmissao = z.infer<typeof esquemaEmissao>;

export function lerEmissao(dados: FormData) {
  const v = (k: string) => {
    const x = dados.get(k);
    return typeof x === "string" ? x : "";
  };
  return esquemaEmissao.safeParse({
    atividade_id: v("atividade_id"),
    sessao_id: v("sessao_id"),
    data_visita: v("data_visita"),
    pessoas: v("pessoas"),
    cidade: v("cidade"),
    uf: v("uf"),
    nome_responsavel: v("nome_responsavel"),
    contato: v("contato"),
    chave_idempotencia: v("chave_idempotencia"),
  });
}

/** Erros de regra do banco (P0001, mensagem = chave) em texto para quem está usando. */
export const MENSAGENS_EMISSAO: Record<string, string> = {
  sem_vagas:
    "As vagas deste horário acabaram ou não cabem todas essas pessoas. Escolha outro horário ou diminua o número de pessoas.",
  sessao_indisponivel: "Este horário não aceita mais reservas. Escolha outro horário.",
  atividade_indisponivel: "Esta atividade não está mais disponível para reserva. Volte ao portal e escolha outra.",
  quantidade_invalida: "Número de pessoas acima do permitido para um voucher desta atividade.",
  responsavel_obrigatorio: "Esta atividade pede o nome do responsável pelo grupo.",
  contato_obrigatorio: "Esta atividade pede um telefone para avisos.",
  data_invalida: "Escolha um dia a partir de hoje para a visita.",
  sem_permissao: "Sua conta não tem permissão para emitir vouchers neste município.",
  dados_invalidos: "Recarregue a página e tente de novo.",
};

export function mensagemEmissao(chave: string | undefined): string {
  return (chave && MENSAGENS_EMISSAO[chave]) || "Não foi possível emitir o voucher agora. Confira a conexão e tente de novo.";
}
