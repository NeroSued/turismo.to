import { z } from "zod";

// Atrativos, eventos e prestadores (SPEC 4). Mesmos estados das atividades.

export const TIPOS_CADASTRO = ["atrativos", "eventos", "prestadores"] as const;
export type TipoCadastro = (typeof TIPOS_CADASTRO)[number];

export const STATUS_CONTEUDO = ["rascunho", "publicado", "arquivado"] as const;
export type StatusConteudo = (typeof STATUS_CONTEUDO)[number];

export const CATEGORIAS_ATRATIVO = {
  natureza: "Natureza",
  cultura: "Cultura",
  historico: "Histórico",
  religioso: "Religioso",
  aventura: "Aventura",
  lazer: "Lazer",
  gastronomia: "Gastronomia",
  outro: "Outro",
} as const;

export const CATEGORIAS_PRESTADOR = {
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  guias: "Guias e condutores",
  transporte: "Transporte",
  artesanato: "Artesanato",
  agencia: "Agência de turismo",
  outro: "Outros serviços",
} as const;

export const SITUACOES_REDE = {
  participante: "Participa da rede",
  em_adesao: "Em adesão",
  desligado: "Desligado da rede",
} as const;

export type CategoriaAtrativo = keyof typeof CATEGORIAS_ATRATIVO;
export type CategoriaPrestador = keyof typeof CATEGORIAS_PRESTADOR;
export type SituacaoRede = keyof typeof SITUACOES_REDE;

const chaves = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const coordenada = (limite: number, nome: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > limite) {
        ctx.addIssue({ code: "custom", message: `${nome}: número entre -${limite} e ${limite}, com ponto ou vírgula.` });
        return z.NEVER;
      }
      return Math.round(n * 1e6) / 1e6;
    });

export const esquemaAtrativo = z
  .object({
    nome: z.string().trim().min(3, "Informe um nome com pelo menos 3 letras.").max(120, "Use no máximo 120 caracteres."),
    categoria: z.enum(chaves(CATEGORIAS_ATRATIVO), { message: "Escolha a categoria." }),
    descricao: textoOpcional(4000),
    endereco: textoOpcional(300),
    latitude: coordenada(90, "Latitude").default(null),
    longitude: coordenada(180, "Longitude").default(null),
    horarios: textoOpcional(500),
    contato: textoOpcional(300),
    condicoes_acesso: textoOpcional(2000),
    acessibilidade: textoOpcional(2000),
    orientacoes_ambientais: textoOpcional(2000),
  })
  .refine((a) => (a.latitude === null) === (a.longitude === null), {
    message: "Informe latitude e longitude juntas, ou deixe as duas vazias.",
    path: ["longitude"],
  });

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário.");

export const esquemaEvento = z
  .object({
    titulo: z.string().trim().min(3, "Informe um nome com pelo menos 3 letras.").max(120, "Use no máximo 120 caracteres."),
    dia_inicio: dia,
    hora_inicio: hora,
    dia_fim: dia,
    hora_fim: hora,
    local: textoOpcional(300),
    organizador: textoOpcional(200),
    descricao: textoOpcional(2000),
    atrativo_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Atrativo inválido.").nullable())
      .default(null),
  })
  .refine((e) => `${e.dia_fim}T${e.hora_fim}` >= `${e.dia_inicio}T${e.hora_inicio}`, {
    message: "O término precisa ser igual ou depois do início.",
    path: ["dia_fim"],
  });

export const esquemaPrestador = z.object({
  nome_publico: z.string().trim().min(2, "Informe o nome com pelo menos 2 letras.").max(120, "Use no máximo 120 caracteres."),
  categoria: z.enum(chaves(CATEGORIAS_PRESTADOR), { message: "Escolha a categoria." }),
  situacao_rede: z.enum(chaves(SITUACOES_REDE), { message: "Escolha a situação na rede." }),
  servicos: textoOpcional(2000),
  descricao: textoOpcional(2000),
  contatos_publicos: textoOpcional(300),
  localizacao: textoOpcional(300),
});

export const esquemaAdesao = z.object({
  data_adesao: dia,
  responsavel: z.string().trim().min(2, "Informe o nome do responsável.").max(120, "Use no máximo 120 caracteres."),
  contato_interno: textoOpcional(300),
  observacoes: textoOpcional(2000),
});

export const ROTULO_STATUS: Record<StatusConteudo, string> = {
  rascunho: "Em elaboração",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export const TOM_STATUS: Record<StatusConteudo, "verde" | "dourado" | "cinza"> = {
  publicado: "verde",
  rascunho: "dourado",
  arquivado: "cinza",
};

/** Nomes e textos de cada tipo de cadastro, usados nas telas e mensagens. */
export const TEXTOS: Record<
  TipoCadastro,
  { singular: string; plural: string; novo: string; artigo: "o" | "a"; vazio: string }
> = {
  atrativos: {
    singular: "atrativo",
    plural: "Atrativos",
    novo: "Novo atrativo",
    artigo: "o",
    vazio:
      "Cadastre cachoeiras, praias de rio, igrejas, museus e outros lugares para visitar. Comece pelo nome e pela categoria; endereço, horários, fotos e orientações podem vir depois. Cadastrar um atrativo não cria exigência de voucher.",
  },
  eventos: {
    singular: "evento",
    plural: "Eventos",
    novo: "Novo evento",
    artigo: "o",
    vazio:
      "Cadastre festas, feiras e festivais com data, horário e local. Eventos publicados aparecem no calendário do portal.",
  },
  prestadores: {
    singular: "prestador",
    plural: "Prestadores",
    novo: "Novo prestador",
    artigo: "o",
    vazio:
      "Cadastre pousadas, restaurantes, guias e outros serviços da rede municipal. Registre a adesão com data, responsável e comprovante; esses dados internos nunca aparecem no portal.",
  },
};
