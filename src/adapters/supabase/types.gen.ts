export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      content_reports: {
        Row: {
          content_version: number | null
          created_at: string
          id: number
          message: string
          ref_id: string
          user_id: string | null
        }
        Insert: {
          content_version?: number | null
          created_at?: string
          id?: never
          message: string
          ref_id: string
          user_id?: string | null
        }
        Update: {
          content_version?: number | null
          created_at?: string
          id?: never
          message?: string
          ref_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_created_at: string
          client_id: string
          created_at: string
          id: number
          payload: Json
          ref_id: string
          schema_version: number
          type: string
          user_id: string
          xp: number
        }
        Insert: {
          client_created_at: string
          client_id: string
          created_at?: string
          id?: never
          payload?: Json
          ref_id: string
          schema_version?: number
          type: string
          user_id: string
          xp: number
        }
        Update: {
          client_created_at?: string
          client_id?: string
          created_at?: string
          id?: never
          payload?: Json
          ref_id?: string
          schema_version?: number
          type?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          id: string
          score: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          id?: string
          score?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          id?: string
          score?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_emoji: string
          created_at: string
          group_id: string
          id: string
          pseudo: string
        }
        Insert: {
          avatar_emoji?: string
          created_at?: string
          group_id: string
          id: string
          pseudo: string
        }
        Update: {
          avatar_emoji?: string
          created_at?: string
          group_id?: string
          id?: string
          pseudo?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          badges: string[]
          coins: number
          dialogues_done: string[]
          equipped: Json
          exam_best: number | null
          group_id: string
          inventory: string[]
          last_active_day: string | null
          lessons_done: string[]
          streak: number
          streak_freezes: number
          today: string
          updated_at: string
          user_id: string
          week_start: string
          xp_today: number
          xp_total: number
          xp_week: number
        }
        Insert: {
          badges?: string[]
          coins?: number
          dialogues_done?: string[]
          equipped?: Json
          exam_best?: number | null
          group_id: string
          inventory?: string[]
          last_active_day?: string | null
          lessons_done?: string[]
          streak?: number
          streak_freezes?: number
          today?: string
          updated_at?: string
          user_id: string
          week_start?: string
          xp_today?: number
          xp_total?: number
          xp_week?: number
        }
        Update: {
          badges?: string[]
          coins?: number
          dialogues_done?: string[]
          equipped?: Json
          exam_best?: number | null
          group_id?: string
          inventory?: string[]
          last_active_day?: string | null
          lessons_done?: string[]
          streak?: number
          streak_freezes?: number
          today?: string
          updated_at?: string
          user_id?: string
          week_start?: string
          xp_today?: number
          xp_total?: number
          xp_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_emoji: string | null
          badges: string[] | null
          coins: number | null
          dialogues_done: string[] | null
          equipped: Json | null
          equipped_frame: string | null
          exam_best: number | null
          group_id: string | null
          lessons_done: string[] | null
          lessons_done_count: number | null
          pseudo: string | null
          streak: number | null
          user_id: string | null
          xp_total: number | null
          xp_week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_my_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      join_group: {
        Args: {
          p_invite_code: string
          p_pseudo: string
          p_avatar: string
        }
        Returns: undefined
      }
      my_group_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      paris_today: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      paris_week_start: {
        Args: {
          d: string
        }
        Returns: string
      }
      start_exam_attempt: {
        Args: Record<PropertyKey, never>
        Returns: Json
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

