import { z } from "zod";
import { CONTRASTE_MINIMO, contraste, ehHexValido } from "@/lib/cores";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

/** Configurações editáveis pelo gestor (item 2.4). O banco repete as regras de cor e tamanho. */
export const esquemaConfiguracoes = z.object({
  nome_exibicao: z
    .string()
    .trim()
    .max(120, "Use no máximo 120 caracteres.")
    .refine((v) => v === "" || v.length >= 2, "Use pelo menos 2 letras, ou deixe vazio para usar o nome oficial.")
    .transform((v) => (v === "" ? null : v)),
  cor_primaria: z
    .string()
    .trim()
    .transform((v) => (v.startsWith("#") ? v : `#${v}`).toUpperCase())
    .refine(ehHexValido, "Use o formato #RRGGBB, por exemplo #1F4D3A.")
    .refine(
      (v) => !ehHexValido(v) || contraste(v, "#FFFFFF") >= CONTRASTE_MINIMO,
      `Cor clara demais: o texto branco sobre ela fica com contraste menor que ${CONTRASTE_MINIMO}:1. Escolha um tom mais escuro.`,
    ),
  contato_secretaria: textoOpcional(600),
  ouvidoria_url: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .refine((v) => v === "" || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v), "Informe o endereço completo, começando com https://")
    .transform((v) => (v === "" ? null : v)),
  aviso_privacidade: textoOpcional(8000),
  referencia_icms: z.string().trim().min(1, "Informe a referência (por exemplo, item 6.1.4).").max(200, "Use no máximo 200 caracteres."),
  // D10: o banco aceita de 1 a 3650 dias; abaixo de 7 o gestor perde o contato antes de resolver pendências da visita.
  dias_anonimizacao: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Informe um número inteiro de dias, por exemplo 90.")
    .transform(Number)
    .refine((n) => n >= 7 && n <= 3650, "Use de 7 a 3650 dias."),
});

export const IMAGENS_MUNICIPIO = { logo: "logo_caminho", capa: "capa_caminho" } as const;
export type ImagemMunicipio = keyof typeof IMAGENS_MUNICIPIO;
