import { CATEGORIAS_ATRATIVO, CATEGORIAS_PRESTADOR, SITUACOES_REDE, type TipoCadastro } from "./esquemas";

/** Campo de formulário de cadastro. `essencial`: aparece no formulário curto de criação. */
export type DefCampo = {
  nome: string;
  rotulo: string;
  tipo: "texto" | "area" | "selecao" | "data" | "hora" | "decimal" | "atrativo";
  max?: number;
  obrigatorio?: boolean;
  essencial?: boolean;
  meia?: boolean;
  ajuda?: string;
  opcoes?: Record<string, string>;
};

export const CAMPOS: Record<TipoCadastro, DefCampo[]> = {
  atrativos: [
    { nome: "nome", rotulo: "Nome do atrativo", tipo: "texto", max: 120, obrigatorio: true, essencial: true, ajuda: "Como aparece no portal. Ex.: Cachoeira do Sossego." },
    { nome: "categoria", rotulo: "Categoria", tipo: "selecao", obrigatorio: true, essencial: true, opcoes: CATEGORIAS_ATRATIVO },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", max: 4000, essencial: true },
    { nome: "endereco", rotulo: "Endereço ou como chegar", tipo: "texto", max: 300 },
    { nome: "latitude", rotulo: "Latitude", tipo: "decimal", meia: true, ajuda: "Opcional. Ex.: -13,0412" },
    { nome: "longitude", rotulo: "Longitude", tipo: "decimal", meia: true, ajuda: "Opcional. Ex.: -48,3011" },
    { nome: "horarios", rotulo: "Horários de visitação", tipo: "texto", max: 500, ajuda: "Ex.: Todos os dias, das 8h às 17h." },
    { nome: "contato", rotulo: "Contato para o público", tipo: "texto", max: 300, ajuda: "Aparece no portal. Use só contatos oficiais ou autorizados." },
    { nome: "condicoes_acesso", rotulo: "Condições de acesso", tipo: "area", max: 2000, ajuda: "Estrada, trilha, distância, se precisa de guia." },
    { nome: "acessibilidade", rotulo: "Acessibilidade", tipo: "area", max: 2000, ajuda: "Rampas, banheiro adaptado, trechos com degraus." },
    { nome: "orientacoes_ambientais", rotulo: "Orientações ambientais", tipo: "area", max: 2000, ajuda: "Lixo, fogo, som, animais, áreas proibidas." },
  ],
  eventos: [
    { nome: "titulo", rotulo: "Nome do evento", tipo: "texto", max: 120, obrigatorio: true, essencial: true },
    { nome: "dia_inicio", rotulo: "Data de início", tipo: "data", obrigatorio: true, essencial: true, meia: true },
    { nome: "hora_inicio", rotulo: "Horário de início", tipo: "hora", obrigatorio: true, essencial: true, meia: true },
    { nome: "dia_fim", rotulo: "Data de término", tipo: "data", obrigatorio: true, essencial: true, meia: true },
    { nome: "hora_fim", rotulo: "Horário de término", tipo: "hora", obrigatorio: true, essencial: true, meia: true },
    { nome: "local", rotulo: "Local", tipo: "texto", max: 300, essencial: true },
    { nome: "organizador", rotulo: "Organização", tipo: "texto", max: 200, ajuda: "Prefeitura, associação, igreja..." },
    { nome: "atrativo_id", rotulo: "Atrativo onde acontece", tipo: "atrativo", ajuda: "Opcional. Liga o evento a um atrativo cadastrado." },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", max: 2000, ajuda: "Aparece na página pública. Separe os parágrafos com uma linha em branco. Até 2000 caracteres." },
  ],
  prestadores: [
    { nome: "nome_publico", rotulo: "Nome público", tipo: "texto", max: 120, obrigatorio: true, essencial: true, ajuda: "Nome como o prestador quer aparecer no portal." },
    { nome: "categoria", rotulo: "Categoria", tipo: "selecao", obrigatorio: true, essencial: true, opcoes: CATEGORIAS_PRESTADOR },
    { nome: "situacao_rede", rotulo: "Situação na rede", tipo: "selecao", obrigatorio: true, essencial: true, opcoes: SITUACOES_REDE },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", max: 2000, ajuda: "Aparece na página pública. Separe os parágrafos com uma linha em branco. Até 2000 caracteres." },
    { nome: "servicos", rotulo: "Serviços oferecidos", tipo: "area", max: 2000 },
    {
      nome: "contatos_publicos",
      rotulo: "Contatos autorizados para o portal",
      tipo: "texto",
      max: 300,
      ajuda: "Só o que o prestador autorizou divulgar. Contatos internos vão na adesão, que é privada.",
    },
    { nome: "localizacao", rotulo: "Localização", tipo: "texto", max: 300 },
  ],
};
