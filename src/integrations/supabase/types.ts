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
          is_titular: boolean | null
          score: number
          situacao: string | null
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
          is_titular?: boolean | null
          score?: number
          situacao?: string | null
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
          is_titular?: boolean | null
          score?: number
          situacao?: string | null
          total_votos?: number
          updated_at?: string
          votos_alinhados?: number
        }
        Relationships: []
      }
      analises_ponderadas: {
        Row: {
          ano: number
          casa: string
          components: Json
          id: string
          nome: string | null
          parlamentar_id: number
          partido: string | null
          score_ia: number
          score_tradicional: number
          total_votos: number
          uf: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          casa: string
          components?: Json
          id?: string
          nome?: string | null
          parlamentar_id: number
          partido?: string | null
          score_ia?: number
          score_tradicional?: number
          total_votos?: number
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          casa?: string
          components?: Json
          id?: string
          nome?: string | null
          parlamentar_id?: number
          partido?: string | null
          score_ia?: number
          score_tradicional?: number
          total_votos?: number
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analises_senadores: {
        Row: {
          ano: number
          classificacao: Database["public"]["Enums"]["classificacao_tipo"]
          created_at: string
          descricao_participacao: string | null
          id: string
          is_titular: boolean | null
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
          descricao_participacao?: string | null
          id?: string
          is_titular?: boolean | null
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
          descricao_participacao?: string | null
          id?: string
          is_titular?: boolean | null
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
      chat_conversations: {
        Row: {
          context: string | null
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deputy_performance_scores: {
        Row: {
          ano: number
          casa: string
          created_at: string
          dados_brutos: Json | null
          foto: string | null
          id: string
          nome: string | null
          parlamentar_id: number
          partido: string | null
          score_alinhamento: number
          score_engajamento: number
          score_impacto: number
          score_presenca: number
          score_total: number
          uf: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          casa: string
          created_at?: string
          dados_brutos?: Json | null
          foto?: string | null
          id?: string
          nome?: string | null
          parlamentar_id: number
          partido?: string | null
          score_alinhamento?: number
          score_engajamento?: number
          score_impacto?: number
          score_presenca?: number
          score_total?: number
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          casa?: string
          created_at?: string
          dados_brutos?: Json | null
          foto?: string | null
          id?: string
          nome?: string | null
          parlamentar_id?: number
          partido?: string | null
          score_alinhamento?: number
          score_engajamento?: number
          score_impacto?: number
          score_presenca?: number
          score_total?: number
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emendas_orcamentarias_transparencia: {
        Row: {
          ano: number
          area_publica: string | null
          autor: string | null
          casa: string | null
          codigo_emenda: string
          confianca_ia: number
          created_at: string
          documentos: Json
          estagio_execucao: string
          fetched_at: string
          funcao: string | null
          id: string
          localidade_gasto: string | null
          nome_autor: string | null
          numero_emenda: string | null
          parlamentar_id: number | null
          partido: string | null
          publico_beneficiado: string | null
          raw_data: Json
          resumo_ia: string | null
          risco_execucao: string
          subfuncao: string | null
          subtema_ia: string | null
          tema_ia: string
          tipo_emenda: string
          uf: string | null
          updated_at: string
          valor_empenhado: number
          valor_liquidado: number
          valor_pago: number
          valor_resto_cancelado: number
          valor_resto_inscrito: number
          valor_resto_pago: number
        }
        Insert: {
          ano: number
          area_publica?: string | null
          autor?: string | null
          casa?: string | null
          codigo_emenda: string
          confianca_ia?: number
          created_at?: string
          documentos?: Json
          estagio_execucao?: string
          fetched_at?: string
          funcao?: string | null
          id?: string
          localidade_gasto?: string | null
          nome_autor?: string | null
          numero_emenda?: string | null
          parlamentar_id?: number | null
          partido?: string | null
          publico_beneficiado?: string | null
          raw_data?: Json
          resumo_ia?: string | null
          risco_execucao?: string
          subfuncao?: string | null
          subtema_ia?: string | null
          tema_ia?: string
          tipo_emenda: string
          uf?: string | null
          updated_at?: string
          valor_empenhado?: number
          valor_liquidado?: number
          valor_pago?: number
          valor_resto_cancelado?: number
          valor_resto_inscrito?: number
          valor_resto_pago?: number
        }
        Update: {
          ano?: number
          area_publica?: string | null
          autor?: string | null
          casa?: string | null
          codigo_emenda?: string
          confianca_ia?: number
          created_at?: string
          documentos?: Json
          estagio_execucao?: string
          fetched_at?: string
          funcao?: string | null
          id?: string
          localidade_gasto?: string | null
          nome_autor?: string | null
          numero_emenda?: string | null
          parlamentar_id?: number | null
          partido?: string | null
          publico_beneficiado?: string | null
          raw_data?: Json
          resumo_ia?: string | null
          risco_execucao?: string
          subfuncao?: string | null
          subtema_ia?: string | null
          tema_ia?: string
          tipo_emenda?: string
          uf?: string | null
          updated_at?: string
          valor_empenhado?: number
          valor_liquidado?: number
          valor_pago?: number
          valor_resto_cancelado?: number
          valor_resto_inscrito?: number
          valor_resto_pago?: number
        }
        Relationships: []
      }
      emendas_parlamentares_cache: {
        Row: {
          ano: number
          area_politica: string | null
          cache_key: string
          casa: string
          confianca: number
          created_at: string
          data_apresentacao: string | null
          ementa: string | null
          fetched_at: string
          id: string
          impacto_estimado: string
          numero: string
          parlamentar_id: number
          parlamentar_nome: string | null
          proposicao_ano: number | null
          proposicao_numero: string | null
          proposicao_tipo: string | null
          publico_afetado: string | null
          raw_data: Json
          resumo_ia: string | null
          situacao: string | null
          source: string
          tema: string
          tipo: string
          tipo_beneficio: string | null
          updated_at: string
          url: string | null
          valor: number | null
        }
        Insert: {
          ano: number
          area_politica?: string | null
          cache_key: string
          casa: string
          confianca?: number
          created_at?: string
          data_apresentacao?: string | null
          ementa?: string | null
          fetched_at?: string
          id?: string
          impacto_estimado?: string
          numero: string
          parlamentar_id: number
          parlamentar_nome?: string | null
          proposicao_ano?: number | null
          proposicao_numero?: string | null
          proposicao_tipo?: string | null
          publico_afetado?: string | null
          raw_data?: Json
          resumo_ia?: string | null
          situacao?: string | null
          source?: string
          tema?: string
          tipo?: string
          tipo_beneficio?: string | null
          updated_at?: string
          url?: string | null
          valor?: number | null
        }
        Update: {
          ano?: number
          area_politica?: string | null
          cache_key?: string
          casa?: string
          confianca?: number
          created_at?: string
          data_apresentacao?: string | null
          ementa?: string | null
          fetched_at?: string
          id?: string
          impacto_estimado?: string
          numero?: string
          parlamentar_id?: number
          parlamentar_nome?: string | null
          proposicao_ano?: number | null
          proposicao_numero?: string | null
          proposicao_tipo?: string | null
          publico_afetado?: string | null
          raw_data?: Json
          resumo_ia?: string | null
          situacao?: string | null
          source?: string
          tema?: string
          tipo?: string
          tipo_beneficio?: string | null
          updated_at?: string
          url?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          context: string | null
          created_at: string
          feature_key: string
          id: string
          user_id: string | null
          vote: number
        }
        Insert: {
          context?: string | null
          created_at?: string
          feature_key: string
          id?: string
          user_id?: string | null
          vote?: number
        }
        Update: {
          context?: string | null
          created_at?: string
          feature_key?: string
          id?: string
          user_id?: string | null
          vote?: number
        }
        Relationships: []
      }
      nolan_diagrams: {
        Row: {
          ano: number
          casa: string
          created_at: string
          economic_axis: number
          id: string
          parlamentar_id: number
          rationale: string | null
          social_axis: number
          updated_at: string
        }
        Insert: {
          ano: number
          casa: string
          created_at?: string
          economic_axis?: number
          id?: string
          parlamentar_id: number
          rationale?: string | null
          social_axis?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          casa?: string
          created_at?: string
          economic_axis?: number
          id?: string
          parlamentar_id?: number
          rationale?: string | null
          social_axis?: number
          updated_at?: string
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
      portal_api_quota: {
        Row: {
          daily_limit: number
          date: string
          requests_used: number
          updated_at: string
        }
        Insert: {
          daily_limit?: number
          date?: string
          requests_used?: number
          updated_at?: string
        }
        Update: {
          daily_limit?: number
          date?: string
          requests_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      prioridade_agregada: {
        Row: {
          ano: number
          casa: string
          contra: number
          favor: number
          neutro: number
          numero: string
          prioridade_media: number
          proposicao_id: string
          tema: string
          tipo: string
          titulo: string
          total_votos: number
          updated_at: string
        }
        Insert: {
          ano: number
          casa: string
          contra?: number
          favor?: number
          neutro?: number
          numero: string
          prioridade_media?: number
          proposicao_id: string
          tema: string
          tipo: string
          titulo: string
          total_votos?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          casa?: string
          contra?: number
          favor?: number
          neutro?: number
          numero?: string
          prioridade_media?: number
          proposicao_id?: string
          tema?: string
          tipo?: string
          titulo?: string
          total_votos?: number
          updated_at?: string
        }
        Relationships: []
      }
      prioridade_votos: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          posicao: string
          prioridade: number
          proposicao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          posicao: string
          prioridade: number
          proposicao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          posicao?: string
          prioridade?: number
          proposicao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prioridade_votos_proposicao_id_fkey"
            columns: ["proposicao_id"]
            isOneToOne: false
            referencedRelation: "proposicoes_prioritarias"
            referencedColumns: ["id"]
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
          partido_filiacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favoritos?: number[] | null
          id?: string
          partido_filiacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favoritos?: number[] | null
          id?: string
          partido_filiacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposicoes_parlamentares: {
        Row: {
          ano: number
          casa: string
          created_at: string
          data_apresentacao: string | null
          ementa: string | null
          id: string
          numero: string
          parlamentar_id: number
          peso_tipo: number | null
          status_tramitacao: string | null
          tema: string | null
          tipo: string
          tipo_autoria: string | null
          url: string | null
        }
        Insert: {
          ano: number
          casa: string
          created_at?: string
          data_apresentacao?: string | null
          ementa?: string | null
          id?: string
          numero: string
          parlamentar_id: number
          peso_tipo?: number | null
          status_tramitacao?: string | null
          tema?: string | null
          tipo: string
          tipo_autoria?: string | null
          url?: string | null
        }
        Update: {
          ano?: number
          casa?: string
          created_at?: string
          data_apresentacao?: string | null
          ementa?: string | null
          id?: string
          numero?: string
          parlamentar_id?: number
          peso_tipo?: number | null
          status_tramitacao?: string | null
          tema?: string | null
          tipo?: string
          tipo_autoria?: string | null
          url?: string | null
        }
        Relationships: []
      }
      proposicoes_prioritarias: {
        Row: {
          ano: number
          ativa: boolean
          casa: string
          created_at: string
          destaque: boolean
          ementa: string | null
          id: string
          numero: string
          ordem: number
          tema: string
          tipo: string
          titulo: string
          updated_at: string
          url: string | null
        }
        Insert: {
          ano: number
          ativa?: boolean
          casa: string
          created_at?: string
          destaque?: boolean
          ementa?: string | null
          id?: string
          numero: string
          ordem?: number
          tema: string
          tipo: string
          titulo: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          ano?: number
          ativa?: boolean
          casa?: string
          created_at?: string
          destaque?: boolean
          ementa?: string | null
          id?: string
          numero?: string
          ordem?: number
          tema?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          url?: string | null
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
      sync_query_cache: {
        Row: {
          cache_key: string
          created_at: string
          endpoint: string
          expires_at: string
          hit_count: number
          id: string
          params: Json
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          endpoint: string
          expires_at: string
          hit_count?: number
          id?: string
          params?: Json
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          hit_count?: number
          id?: string
          params?: Json
          response?: Json
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
      tramitacoes_cache: {
        Row: {
          ano: number
          casa: string
          created_at: string
          ementa: string | null
          eventos: Json
          fetched_at: string
          id: string
          numero: string
          proposicao_id_externo: string | null
          tipo: string
          ultima_atualizacao: string | null
          ultima_situacao: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          casa: string
          created_at?: string
          ementa?: string | null
          eventos?: Json
          fetched_at?: string
          id?: string
          numero: string
          proposicao_id_externo?: string | null
          tipo: string
          ultima_atualizacao?: string | null
          ultima_situacao?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          casa?: string
          created_at?: string
          ementa?: string | null
          eventos?: Json
          fetched_at?: string
          id?: string
          numero?: string
          proposicao_id_externo?: string | null
          tipo?: string
          ultima_atualizacao?: string | null
          ultima_situacao?: string | null
          updated_at?: string
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
      votacao_temas: {
        Row: {
          ano: number
          casa: string
          confianca: number
          created_at: string
          id: string
          tema: string
          votacao_id: string
        }
        Insert: {
          ano: number
          casa: string
          confianca?: number
          created_at?: string
          id?: string
          tema: string
          votacao_id: string
        }
        Update: {
          ano?: number
          casa?: string
          confianca?: number
          created_at?: string
          id?: string
          tema?: string
          votacao_id?: string
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
      get_parlamentar_badges: {
        Args: { _ano: number; _casa: string; _parlamentar_id: number }
        Returns: {
          badge: string
          nao: number
          ratio: number
          sim: number
          tema: string
          total: number
        }[]
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      refresh_prioridade_agregada: {
        Args: { _proposicao_id?: string }
        Returns: undefined
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
