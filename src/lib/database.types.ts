
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adesoes_prestador": {
                  Row: {
                    "atualizado_em": string,"comprovante_caminho": string | null,"contato_interno": string | null,"criado_em": string,"criado_por": string | null,"data_adesao": string,"id": string,"municipio_id": string,"observacoes": string | null,"prestador_id": string,"responsavel": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"comprovante_caminho"?: string | null,"contato_interno"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_adesao": string,"id"?: string,"municipio_id": string,"observacoes"?: string | null,"prestador_id": string,"responsavel": string
                  }
                  Update: {
                    "atualizado_em"?: string,"comprovante_caminho"?: string | null,"contato_interno"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_adesao"?: string,"id"?: string,"municipio_id"?: string,"observacoes"?: string | null,"prestador_id"?: string,"responsavel"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adesoes_prestador_municipio_id_prestador_id_fkey"
      columns: ["municipio_id","prestador_id"]
isOneToOne: false
      referencedRelation: "prestadores"
      referencedColumns: ["municipio_id","id"]
    }
                  ]
                },"atividades": {
                  Row: {
                    "atrativo_id": string | null,"atualizado_em": string,"condicoes": string | null,"criado_em": string,"criado_por": string | null,"descricao": string | null,"exige_contato": boolean,"exige_responsavel": boolean,"id": string,"local_encontro": string | null,"max_pessoas_por_voucher": number,"modo": string,"municipio_id": string,"prestador_id": string | null,"status": string,"titulo": string
                  }
                  Insert: {
                    "atrativo_id"?: string | null,"atualizado_em"?: string,"condicoes"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"exige_contato"?: boolean,"exige_responsavel"?: boolean,"id"?: string,"local_encontro"?: string | null,"max_pessoas_por_voucher"?: number,"modo": string,"municipio_id": string,"prestador_id"?: string | null,"status"?: string,"titulo": string
                  }
                  Update: {
                    "atrativo_id"?: string | null,"atualizado_em"?: string,"condicoes"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"exige_contato"?: boolean,"exige_responsavel"?: boolean,"id"?: string,"local_encontro"?: string | null,"max_pessoas_por_voucher"?: number,"modo"?: string,"municipio_id"?: string,"prestador_id"?: string | null,"status"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "atividades_atrativo_fk"
      columns: ["municipio_id","atrativo_id"]
isOneToOne: false
      referencedRelation: "atrativos"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "atividades_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atividades_prestador_fk"
      columns: ["municipio_id","prestador_id"]
isOneToOne: false
      referencedRelation: "prestadores"
      referencedColumns: ["municipio_id","id"]
    }
                  ]
                },"atrativos": {
                  Row: {
                    "acessibilidade": string | null,"atualizado_em": string,"categoria": string,"condicoes_acesso": string | null,"contato": string | null,"criado_em": string,"criado_por": string | null,"descricao": string | null,"endereco": string | null,"horarios": string | null,"id": string,"latitude": number | null,"longitude": number | null,"municipio_id": string,"nome": string,"orientacoes_ambientais": string | null,"status": string
                  }
                  Insert: {
                    "acessibilidade"?: string | null,"atualizado_em"?: string,"categoria": string,"condicoes_acesso"?: string | null,"contato"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"endereco"?: string | null,"horarios"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"municipio_id": string,"nome": string,"orientacoes_ambientais"?: string | null,"status"?: string
                  }
                  Update: {
                    "acessibilidade"?: string | null,"atualizado_em"?: string,"categoria"?: string,"condicoes_acesso"?: string | null,"contato"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"endereco"?: string | null,"horarios"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"municipio_id"?: string,"nome"?: string,"orientacoes_ambientais"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "atrativos_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"auditoria": {
                  Row: {
                    "antes": Json | null,"depois": Json | null,"em": string,"id": number,"municipio_id": string | null,"operacao": string,"registro_id": string | null,"tabela": string,"usuario_id": string | null
                  }
                  Insert: {
                    "antes"?: Json | null,"depois"?: Json | null,"em"?: string,"id"?: never,"municipio_id"?: string | null,"operacao": string,"registro_id"?: string | null,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "antes"?: Json | null,"depois"?: Json | null,"em"?: string,"id"?: never,"municipio_id"?: string | null,"operacao"?: string,"registro_id"?: string | null,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"configuracoes_municipio": {
                  Row: {
                    "atualizado_em": string,"aviso_privacidade": string | null,"capa_caminho": string | null,"contato_secretaria": string | null,"cor_primaria": string,"dias_anonimizacao": number,"logo_caminho": string | null,"municipio_id": string,"nome_exibicao": string | null,"ouvidoria_url": string | null,"referencia_icms": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"aviso_privacidade"?: string | null,"capa_caminho"?: string | null,"contato_secretaria"?: string | null,"cor_primaria"?: string,"dias_anonimizacao"?: number,"logo_caminho"?: string | null,"municipio_id": string,"nome_exibicao"?: string | null,"ouvidoria_url"?: string | null,"referencia_icms"?: string
                  }
                  Update: {
                    "atualizado_em"?: string,"aviso_privacidade"?: string | null,"capa_caminho"?: string | null,"contato_secretaria"?: string | null,"cor_primaria"?: string,"dias_anonimizacao"?: number,"logo_caminho"?: string | null,"municipio_id"?: string,"nome_exibicao"?: string | null,"ouvidoria_url"?: string | null,"referencia_icms"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracoes_municipio_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: true
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos": {
                  Row: {
                    "atrativo_id": string | null,"atualizado_em": string,"criado_em": string,"criado_por": string | null,"descricao": string | null,"fim": string,"id": string,"inicio": string,"local": string | null,"municipio_id": string,"organizador": string | null,"status": string,"titulo": string
                  }
                  Insert: {
                    "atrativo_id"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"fim": string,"id"?: string,"inicio": string,"local"?: string | null,"municipio_id": string,"organizador"?: string | null,"status"?: string,"titulo": string
                  }
                  Update: {
                    "atrativo_id"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"criado_por"?: string | null,"descricao"?: string | null,"fim"?: string,"id"?: string,"inicio"?: string,"local"?: string | null,"municipio_id"?: string,"organizador"?: string | null,"status"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_municipio_id_atrativo_id_fkey"
      columns: ["municipio_id","atrativo_id"]
isOneToOne: false
      referencedRelation: "atrativos"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "eventos_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"evidencias": {
                  Row: {
                    "ano_base": number,"arquivada": boolean,"atividade_id": string | null,"atualizado_em": string,"atualizado_por": string | null,"criado_em": string,"criado_por": string | null,"data_realizacao": string,"descricao": string,"id": string,"municipio_id": string,"responsavel": string,"tipo_acao": string,"titulo": string
                  }
                  Insert: {
                    "ano_base": number,"arquivada"?: boolean,"atividade_id"?: string | null,"atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_realizacao": string,"descricao": string,"id"?: string,"municipio_id": string,"responsavel": string,"tipo_acao": string,"titulo": string
                  }
                  Update: {
                    "ano_base"?: number,"arquivada"?: boolean,"atividade_id"?: string | null,"atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_realizacao"?: string,"descricao"?: string,"id"?: string,"municipio_id"?: string,"responsavel"?: string,"tipo_acao"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidencias_municipio_id_atividade_id_fkey"
      columns: ["municipio_id","atividade_id"]
isOneToOne: false
      referencedRelation: "atividades"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "evidencias_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"evidencias_arquivos": {
                  Row: {
                    "caminho": string,"criado_em": string,"criado_por": string | null,"evidencia_id": string,"id": string,"legenda": string,"mime": string,"municipio_id": string,"retirado": boolean,"retirado_em": string | null,"retirado_por": string | null,"tamanho": number,"tipo": string
                  }
                  Insert: {
                    "caminho": string,"criado_em"?: string,"criado_por"?: string | null,"evidencia_id": string,"id"?: string,"legenda": string,"mime": string,"municipio_id": string,"retirado"?: boolean,"retirado_em"?: string | null,"retirado_por"?: string | null,"tamanho": number,"tipo": string
                  }
                  Update: {
                    "caminho"?: string,"criado_em"?: string,"criado_por"?: string | null,"evidencia_id"?: string,"id"?: string,"legenda"?: string,"mime"?: string,"municipio_id"?: string,"retirado"?: boolean,"retirado_em"?: string | null,"retirado_por"?: string | null,"tamanho"?: number,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidencias_arquivos_municipio_id_evidencia_id_fkey"
      columns: ["municipio_id","evidencia_id"]
isOneToOne: false
      referencedRelation: "evidencias"
      referencedColumns: ["municipio_id","id"]
    }
                  ]
                },"evidencias_historico": {
                  Row: {
                    "acao": string,"antes": Json | null,"autor_id": string | null,"autor_nome": string | null,"campos": (string)[],"depois": Json | null,"em": string,"evidencia_id": string,"id": number,"municipio_id": string
                  }
                  Insert: {
                    "acao": string,"antes"?: Json | null,"autor_id"?: string | null,"autor_nome"?: string | null,"campos"?: (string)[],"depois"?: Json | null,"em"?: string,"evidencia_id": string,"id"?: never,"municipio_id": string
                  }
                  Update: {
                    "acao"?: string,"antes"?: Json | null,"autor_id"?: string | null,"autor_nome"?: string | null,"campos"?: (string)[],"depois"?: Json | null,"em"?: string,"evidencia_id"?: string,"id"?: never,"municipio_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotos": {
                  Row: {
                    "atrativo_id": string | null,"caminho": string,"criado_em": string,"criado_por": string | null,"evento_id": string | null,"id": string,"legenda": string,"municipio_id": string,"ordem": number,"prestador_id": string | null
                  }
                  Insert: {
                    "atrativo_id"?: string | null,"caminho": string,"criado_em"?: string,"criado_por"?: string | null,"evento_id"?: string | null,"id"?: string,"legenda": string,"municipio_id": string,"ordem"?: number,"prestador_id"?: string | null
                  }
                  Update: {
                    "atrativo_id"?: string | null,"caminho"?: string,"criado_em"?: string,"criado_por"?: string | null,"evento_id"?: string | null,"id"?: string,"legenda"?: string,"municipio_id"?: string,"ordem"?: number,"prestador_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fotos_municipio_id_atrativo_id_fkey"
      columns: ["municipio_id","atrativo_id"]
isOneToOne: false
      referencedRelation: "atrativos"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "fotos_municipio_id_evento_id_fkey"
      columns: ["municipio_id","evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "fotos_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fotos_municipio_id_prestador_id_fkey"
      columns: ["municipio_id","prestador_id"]
isOneToOne: false
      referencedRelation: "prestadores"
      referencedColumns: ["municipio_id","id"]
    }
                  ]
                },"limites_requisicao": {
                  Row: {
                    "alvo": string,"chave": string,"contagem": number,"escopo": string,"janela": string
                  }
                  Insert: {
                    "alvo": string,"chave": string,"contagem"?: number,"escopo": string,"janela": string
                  }
                  Update: {
                    "alvo"?: string,"chave"?: string,"contagem"?: number,"escopo"?: string,"janela"?: string
                  }
                  Relationships: [
                    
                  ]
                },"minutas_relatorio": {
                  Row: {
                    "analise": string | null,"ano_base": number,"atualizado_em": string,"atualizado_por": string | null,"criado_em": string,"limitacoes": string | null,"metodologia": string | null,"municipio_id": string,"recomendacoes": string | null
                  }
                  Insert: {
                    "analise"?: string | null,"ano_base": number,"atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"limitacoes"?: string | null,"metodologia"?: string | null,"municipio_id": string,"recomendacoes"?: string | null
                  }
                  Update: {
                    "analise"?: string | null,"ano_base"?: number,"atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"limitacoes"?: string | null,"metodologia"?: string | null,"municipio_id"?: string,"recomendacoes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "minutas_relatorio_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"municipios": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"id": string,"nome": string,"slug": string
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"nome": string,"slug": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"nome"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfis": {
                  Row: {
                    "admin_assessoria": boolean,"atualizado_em": string,"criado_em": string,"nome": string | null,"user_id": string
                  }
                  Insert: {
                    "admin_assessoria"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"nome"?: string | null,"user_id": string
                  }
                  Update: {
                    "admin_assessoria"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"nome"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prestadores": {
                  Row: {
                    "atualizado_em": string,"categoria": string,"contatos_publicos": string | null,"criado_em": string,"criado_por": string | null,"id": string,"localizacao": string | null,"municipio_id": string,"nome_publico": string,"servicos": string | null,"situacao_rede": string,"status": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"categoria": string,"contatos_publicos"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"localizacao"?: string | null,"municipio_id": string,"nome_publico": string,"servicos"?: string | null,"situacao_rede"?: string,"status"?: string
                  }
                  Update: {
                    "atualizado_em"?: string,"categoria"?: string,"contatos_publicos"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"localizacao"?: string | null,"municipio_id"?: string,"nome_publico"?: string,"servicos"?: string | null,"situacao_rede"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prestadores_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    }
                  ]
                },"sessoes": {
                  Row: {
                    "ativa": boolean,"atividade_id": string,"atualizado_em": string,"capacidade_pessoas": number | null,"criado_em": string,"fim": string,"id": string,"inicio": string,"municipio_id": string,"pessoas_reservadas": number
                  }
                  Insert: {
                    "ativa"?: boolean,"atividade_id": string,"atualizado_em"?: string,"capacidade_pessoas"?: number | null,"criado_em"?: string,"fim": string,"id"?: string,"inicio": string,"municipio_id": string,"pessoas_reservadas"?: number
                  }
                  Update: {
                    "ativa"?: boolean,"atividade_id"?: string,"atualizado_em"?: string,"capacidade_pessoas"?: number | null,"criado_em"?: string,"fim"?: string,"id"?: string,"inicio"?: string,"municipio_id"?: string,"pessoas_reservadas"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessoes_municipio_id_atividade_id_fkey"
      columns: ["municipio_id","atividade_id"]
isOneToOne: false
      referencedRelation: "atividades"
      referencedColumns: ["municipio_id","id"]
    }
                  ]
                },"vinculos": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"id": string,"municipio_id": string,"papel": string,"user_id": string
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"municipio_id": string,"papel": string,"user_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"municipio_id"?: string,"papel"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vinculos_municipio_id_fkey"
      columns: ["municipio_id"]
isOneToOne: false
      referencedRelation: "municipios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["user_id"]
    }
                  ]
                },"vouchers": {
                  Row: {
                    "atividade_id": string,"cancelado_em": string | null,"cancelado_por": string | null,"cancelado_via": string | null,"chave_idempotencia": string,"cidade": string,"codigo": string,"contato": string | null,"data_visita": string,"emitido_em": string,"emitido_por": string | null,"expirado_em": string | null,"id": string,"municipio_id": string,"nome_responsavel": string | null,"origem": string,"pessoas": number,"pessoas_atendidas": number | null,"sessao_id": string | null,"status": string,"token_hash": string,"uf": string,"utilizado_em": string | null,"utilizado_por": string | null
                  }
                  Insert: {
                    "atividade_id": string,"cancelado_em"?: string | null,"cancelado_por"?: string | null,"cancelado_via"?: string | null,"chave_idempotencia": string,"cidade": string,"codigo": string,"contato"?: string | null,"data_visita": string,"emitido_em"?: string,"emitido_por"?: string | null,"expirado_em"?: string | null,"id"?: string,"municipio_id": string,"nome_responsavel"?: string | null,"origem": string,"pessoas": number,"pessoas_atendidas"?: number | null,"sessao_id"?: string | null,"status"?: string,"token_hash": string,"uf": string,"utilizado_em"?: string | null,"utilizado_por"?: string | null
                  }
                  Update: {
                    "atividade_id"?: string,"cancelado_em"?: string | null,"cancelado_por"?: string | null,"cancelado_via"?: string | null,"chave_idempotencia"?: string,"cidade"?: string,"codigo"?: string,"contato"?: string | null,"data_visita"?: string,"emitido_em"?: string,"emitido_por"?: string | null,"expirado_em"?: string | null,"id"?: string,"municipio_id"?: string,"nome_responsavel"?: string | null,"origem"?: string,"pessoas"?: number,"pessoas_atendidas"?: number | null,"sessao_id"?: string | null,"status"?: string,"token_hash"?: string,"uf"?: string,"utilizado_em"?: string | null,"utilizado_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vouchers_municipio_id_atividade_id_fkey"
      columns: ["municipio_id","atividade_id"]
isOneToOne: false
      referencedRelation: "atividades"
      referencedColumns: ["municipio_id","id"]
    },{
      foreignKeyName: "vouchers_municipio_id_atividade_id_sessao_id_fkey"
      columns: ["municipio_id","atividade_id","sessao_id"]
isOneToOne: false
      referencedRelation: "sessoes"
      referencedColumns: ["municipio_id","atividade_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admins_assessoria":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"nome": string,"user_id": string
            }[]
                           },
"auditoria_consultar":
{ Args: { "p_antes_de": number,"p_fim": string,"p_inicio": string,"p_limite": number,"p_municipio_id": string,"p_operacao": string,"p_tabela": string,"p_usuario_id": string }; Returns: {
              "campos": (string)[],"em": string,"id": number,"municipio_id": string,"municipio_nome": string,"operacao": string,"registro_id": string,"tabela": string,"usuario_id": string,"usuario_nome": string
            }[]
                           },
"auditoria_usuarios":
{ Args: { "p_municipio_id": string }; Returns: {
              "nome": string,"usuario_id": string
            }[]
                           },
"cancelar_voucher_painel":
{ Args: { "p_codigo": string,"p_municipio_id": string }; Returns: Json
                           },
"cancelar_voucher_token":
{ Args: { "p_municipio_id": string,"p_token": string }; Returns: Json
                           },
"conferir_voucher":
{ Args: { "p_codigo": string,"p_municipio_id": string }; Returns: Json
                           },
"confirmar_voucher":
{ Args: { "p_codigo": string,"p_municipio_id": string,"p_pessoas_atendidas": number }; Returns: Json
                           },
"consultar_voucher_token":
{ Args: { "p_municipio_id": string,"p_token": string }; Returns: Json
                           },
"consumir_limite_requisicao":
{ Args: { "p_alvo": string,"p_chave": string,"p_escopo": string,"p_janela_segundos": number,"p_maximo": number }; Returns: boolean
                           },
"emitir_voucher_assistido":
{ Args: { "p_atividade_id": string,"p_chave_idempotencia": string,"p_cidade": string,"p_contato": string,"p_data_visita": string,"p_municipio_id": string,"p_nome_responsavel": string,"p_pessoas": number,"p_sessao_id": string,"p_uf": string }; Returns: {
              "codigo": string,"repetido": boolean,"voucher_id": string
            }[]
                           },
"emitir_voucher_publico":
{ Args: { "p_atividade_id": string,"p_chave_idempotencia": string,"p_cidade": string,"p_contato": string,"p_data_visita": string,"p_municipio_id": string,"p_nome_responsavel": string,"p_pessoas": number,"p_sessao_id": string,"p_uf": string }; Returns: {
              "codigo": string,"repetido": boolean,"token": string,"voucher_id": string
            }[]
                           },
"equipe_do_municipio":
{ Args: { "p_municipio_id": string }; Returns: {
              "ativo": boolean,"convite_pendente": boolean,"criado_em": string,"email": string,"nome": string,"papel": string,"user_id": string,"vinculo_id": string
            }[]
                           },
"excluir_arquivo_evidencia_lgpd":
{ Args: { "p_arquivo_id": string,"p_motivo": string }; Returns: undefined
                           },
"relatorio_completo":
{ Args: { "p_fim": string,"p_inicio": string,"p_municipio_id": string }; Returns: Json
                           },
"relatorio_vouchers":
{ Args: { "p_fim": string,"p_inicio": string,"p_municipio_id": string }; Returns: Json
                           },
"usuario_por_email":
{ Args: { "p_email": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
