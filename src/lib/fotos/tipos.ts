// Cadastros que têm capa e galeria de fotos (Fase 7.3). Usado no servidor e no navegador.

export const TIPOS_FOTO = ["atrativos", "eventos", "prestadores", "atividades"] as const;
export type TipoFoto = (typeof TIPOS_FOTO)[number];

export const LIMITE_FOTOS = 12;

/** Coluna da tabela `fotos` que aponta para o cadastro. */
export const DONO_FOTO = {
  atrativos: "atrativo_id",
  eventos: "evento_id",
  prestadores: "prestador_id",
  atividades: "atividade_id",
} as const satisfies Record<TipoFoto, string>;

export type ColunaDono = (typeof DONO_FOTO)[TipoFoto];

/** Coluna com o nome do cadastro e rótulo do tipo, para o cabeçalho da tela de fotos. */
export const CADASTRO_FOTO: Record<TipoFoto, { coluna: string; rotulo: string }> = {
  atrativos: { coluna: "nome", rotulo: "Atrativo" },
  eventos: { coluna: "titulo", rotulo: "Evento" },
  prestadores: { coluna: "nome_publico", rotulo: "Prestador" },
  atividades: { coluna: "titulo", rotulo: "Atividade" },
};

export function tipoFotoValido(t: string): t is TipoFoto {
  return (TIPOS_FOTO as readonly string[]).includes(t);
}
