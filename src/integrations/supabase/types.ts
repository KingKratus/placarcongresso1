export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analises_deputados: {
        Row: {
          ano: number
          classificacao: Database["public"]["Enums"]["classificacao_tipo"]
          created_at: string
          deputado_foto: string | null
          deputado_id: number
          deputado_nome: string
          deputado_partido: string | null
          deputado_uf: string | null
          id: string
          score: number
          total_votos: number
          updated_at: string
          votos_alinhados: number
        }
        Insert: {
          ano: number
          classificacao?: Database["public"]["Enums"]["classificacao_tipo"]
          created_at?: string
          deputado_foto?: string | null
          deputado_id: number
          deputado_nome: string
          deputado_partido?: string | null
          deputado_uf?: string | null
          id?: string
          score?: number
          total_votos?: number
          updated_at?: string
          votos_alinhados?: number
        }
        Update: {
          ano?: number
          classificacao?: Database["public"]["Enums"]["classificacao_tipo"]
          created_at?: string
          deputado_foto?: string | null
          deputado_id?: number
          deputado_nome?: string
          deputado_partido?: string | null
          deputado_uf?: string | null
          id?: string
          score?: number
          total_votos?: number
          updated_at?: string
          votos_alinhados?: number
        }
        Relationships: []
      }
      analises_senadores: {
        Row: {
          ano: number
          classificacao: Database["public"]["Enums"]["classificacao_tipo"]
          created_at: string
          id: string
          score: number
          senador_foto: string | null
          senador_id: number
          senador_nome: string
          senador_partido: string | null
          senador_uf: string | null
          total_votos: number
          updated_at: string
          votos_alinhados: number
        }
        Insert: {
          ano: number
          classificacao?: Database["public"]["Enums"]["classificacao_tipo"]
          created_at?: string
          id?: string
          score?: number
          senador_foto?: string | null
          senador_id: number
          senador_nome: string
          senador_partido?: string | null
          senador_uf?: string | null
          total_votos?: number
          updated_at?: string
          votos_alinhados?: number
        }
        Update: {
          ano?: number
          classificacao?: Database["public"]["Enums"]["classificacao_tipo"]
          created_at?: string
          id?: string
          score?: number
          senador_foto?: string | null
          senador_id?: number
          senador_nome?: string
          senador_partido?: string | null
          senador_uf?: string | null
          total_votos?: number
          updated_at?: string
          votos_alinhados?: number
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      orientacoes: {
        Row: {
          created_at: string
          id: string
          id_votacao: string
          orientacao_voto: string
          sigla_orgao_politico: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_votacao: string
          orientacao_voto: string
          sigla_orgao_politico: string
        }
        Update: {
          created_at?: string
          id?: string
          id_votacao?: string
          orientacao_voto?: string
          sigla_orgao_politico?: string
        }
        Relationships: [
          {
            foreignKeyName: "orientacoes_id_votacao_fkey"
            columns: ["id_votacao"]
            isOneToOne: false
            referencedRelation: "votacoes"
            referencedColumns: ["id_votacao"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          favoritos: number[] | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favoritos?: number[] | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favoritos?: number[] | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          casa: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          casa: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          casa?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_run_events: {
        Row: {
          created_at: string
          id: string
          message: string
          run_id: string
          step: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          run_id: string
          step: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          run_id?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          ano: number
          casa: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          summary: Json | null
          user_id: string | null
        }
        Insert: {
          ano?: number
          casa: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json | null
          user_id?: string | null
        }
        Update: {
          ano?: number
          casa?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votacoes: {
        Row: {
          ano: number
          created_at: string
          data: string | null
          descricao: string | null
          id: string
          id_votacao: string
          proposicao_ano: number | null
          proposicao_ementa: string | null
          proposicao_numero: string | null
          proposicao_tipo: string | null
          sigla_orgao: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          id_votacao: string
          proposicao_ano?: number | null
          proposicao_ementa?: string | null
          proposicao_numero?: string | null
          proposicao_tipo?: string | null
          sigla_orgao?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          id_votacao?: string
          proposicao_ano?: number | null
          proposicao_ementa?: string | null
          proposicao_numero?: string | null
          proposicao_tipo?: string | null
          sigla_orgao?: string | null
        }
        Relationships: []
      }
      votacoes_senado: {
        Row: {
          ano: number
          codigo_sessao_votacao: string
          created_at: string
          data: string | null
          descricao: string | null
          ementa: string | null
          id: string
          materia_ano: number | null
          numero_materia: string | null
          resultado: string | null
          sigla_materia: string | null
        }
        Insert: {
          ano: number
          codigo_sessao_votacao: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          ementa?: string | null
          id?: string
          materia_ano?: number | null
          numero_materia?: string | null
          resultado?: string | null
          sigla_materia?: string | null
        }
        Update: {
          ano?: number
          codigo_sessao_votacao?: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          ementa?: string | null
          id?: string
          materia_ano?: number | null
          numero_materia?: string | null
          resultado?: string | null
          sigla_materia?: string | null
        }
        Relationships: []
      }
      votos_deputados: {
        Row: {
          ano: number
          created_at: string
          deputado_id: number
          id: string
          id_votacao: string
          voto: string
        }
        Insert: {
          ano: number
          created_at?: string
          deputado_id: number
          id?: string
          id_votacao: string
          voto: string
        }
        Update: {
          ano?: number
          created_at?: string
          deputado_id?: number
          id?: string
          id_votacao?: string
          voto?: string
        }
        Relationships: []
      }
      votos_senadores: {
        Row: {
          ano: number
          codigo_sessao_votacao: string
          created_at: string
          id: string
          senador_id: number
          voto: string
        }
        Insert: {
          ano: number
          codigo_sessao_votacao: string
          created_at?: string
          id?: string
          senador_id: number
          voto: string
        }
        Update: {
          ano?: number
          codigo_sessao_votacao?: string
          created_at?: string
          id?: string
          senador_id?: number
          voto?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_monthly_alignment: {
        Args: { p_ano: number }
        Returns: {
          alinhados: number
          casa: string
          mes: number
          score: number
          total: number
        }[]
      }
      has_role:
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      classificacao_tipo: "Governo" | "Centro" | "Oposição" | "Sem Dados"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      classificacao_tipo: ["Governo", "Centro", "Oposição", "Sem Dados"],
    },
  },
} as const
