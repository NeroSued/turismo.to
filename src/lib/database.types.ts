
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
            "auditoria": {
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
                    "atualizado_em": string,"aviso_privacidade": string | null,"contato_secretaria": string | null,"cor_primaria": string,"dias_anonimizacao": number,"logo_caminho": string | null,"municipio_id": string,"nome_exibicao": string | null,"ouvidoria_url": string | null,"referencia_icms": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"aviso_privacidade"?: string | null,"contato_secretaria"?: string | null,"cor_primaria"?: string,"dias_anonimizacao"?: number,"logo_caminho"?: string | null,"municipio_id": string,"nome_exibicao"?: string | null,"ouvidoria_url"?: string | null,"referencia_icms"?: string
                  }
                  Update: {
                    "atualizado_em"?: string,"aviso_privacidade"?: string | null,"contato_secretaria"?: string | null,"cor_primaria"?: string,"dias_anonimizacao"?: number,"logo_caminho"?: string | null,"municipio_id"?: string,"nome_exibicao"?: string | null,"ouvidoria_url"?: string | null,"referencia_icms"?: string
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
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
