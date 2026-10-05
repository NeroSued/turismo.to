import { z } from "zod";

export const TIPOS_ACAO = ["reuniao", "capacitacao", "divulgacao", "evento", "melhoria_atrativo", "monitoramento", "outro"] as const;
export type TipoAcao = (typeof TIPOS_ACAO)[number];

export const ROTULO_TIPO_ACAO: Record<TipoAcao, string> = {
  reuniao: "Reunião ou audiência",
  capacitacao: "Capacitação ou oficina",
  divulgacao: "Divulgação",
  evento: "Evento ou atividade turística",
  melhoria_atrativo: "Melhoria em atrativo",
  monitoramento: "Monitoramento ou vistoria",
  outro: "Outra ação",
};

export const TIPOS_ARQUIVO = ["foto", "lista_presenca", "ata", "outro"] as const;
export type TipoArquivoEvidencia = (typeof TIPOS_ARQUIVO)[number];

export const ROTULO_TIPO_ARQUIVO: Record<TipoArquivoEvidencia, string> = {
  foto: "Foto",
  lista_presenca: "Lista de presença",
  ata: "Ata",
  outro: "Outro anexo",
};

export const ROTULO_CAMPO: Record<string, string> = {
  ano_base: "ano-base",
  tipo_acao: "tipo da ação",
  titulo: "título",
  descricao: "descrição",
  data_realizacao: "data de realização",
  responsavel: "responsável",
  atividade_id: "atividade",
  arquivada: "situação",
  legenda: "legenda",
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

/** Evidência. A data futura é recusada aqui e de novo pelo banco (fuso America/Araguaina). */
export function esquemaEvidencia(hoje: string) {
  return z.object({
    tipo_acao: z.enum(TIPOS_ACAO, { message: "Escolha o tipo da ação." }),
    titulo: z.string().trim().min(3, "Informe um título com pelo menos 3 letras.").max(160, "Use no máximo 160 caracteres."),
    descricao: z
      .string()
      .trim()
      .min(10, "Descreva a ação em pelo menos 10 caracteres: o que foi feito, com quem e onde.")
      .max(4000, "Use no máximo 4000 caracteres."),
    data_realizacao: dia
      .refine((d) => d <= hoje, "A data de realização não pode ser no futuro. Registre a evidência depois que a ação acontecer.")
      .refine((d) => d >= "2015-01-01", "Confira o ano da data de realização."),
    responsavel: z.string().trim().min(2, "Informe quem foi responsável pela ação.").max(160, "Use no máximo 160 caracteres."),
    ano_base: z.coerce.number({ message: "Escolha o ano-base." }).int().min(2020, "Ano-base inválido.").max(2100, "Ano-base inválido."),
    atividade_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Atividade inválida.").nullable()),
  });
}

export const esquemaArquivoEvidencia = z.object({
  tipo: z.enum(TIPOS_ARQUIVO, { message: "Escolha o tipo do arquivo." }),
  legenda: z
    .string()
    .trim()
    .min(3, "Escreva uma legenda: o que o arquivo mostra ou registra.")
    .max(200, "Use no máximo 200 caracteres."),
});
