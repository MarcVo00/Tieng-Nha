// Hand-written until `npm run db:types` can run — regenerate then.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: { id: string; name: string; invite_code: string; created_at: string };
        Insert: { id?: string; name: string; invite_code: string; created_at?: string };
        Update: { id?: string; name?: string; invite_code?: string; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; group_id: string; pseudo: string; avatar_emoji: string; created_at: string };
        Insert: { id: string; group_id: string; pseudo: string; avatar_emoji?: string; created_at?: string };
        Update: { id?: string; group_id?: string; pseudo?: string; avatar_emoji?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: "profiles_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      events: {
        Row: {
          id: number; client_id: string; user_id: string; schema_version: number; type: string; ref_id: string;
          xp: number; payload: Json; client_created_at: string; created_at: string;
        };
        Insert: {
          id?: never; client_id: string; user_id: string; schema_version?: number; type: string; ref_id: string;
          xp: number; payload?: Json; client_created_at: string; created_at?: string;
        };
        Update: {
          id?: never; client_id?: string; user_id?: string; schema_version?: number; type?: string; ref_id?: string;
          xp?: number; payload?: Json; client_created_at?: string; created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "events_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      user_stats: {
        Row: {
          user_id: string; group_id: string; xp_total: number; xp_week: number; week_start: string; xp_today: number;
          today: string; streak: number; last_active_day: string | null; lessons_done: string[];
          dialogues_done: string[]; badges: string[]; exam_best: number | null; updated_at: string;
        };
        Insert: {
          user_id: string; group_id: string; xp_total?: number; xp_week?: number; week_start?: string; xp_today?: number;
          today?: string; streak?: number; last_active_day?: string | null; lessons_done?: string[];
          dialogues_done?: string[]; badges?: string[]; exam_best?: number | null; updated_at?: string;
        };
        Update: {
          user_id?: string; group_id?: string; xp_total?: number; xp_week?: number; week_start?: string; xp_today?: number;
          today?: string; streak?: number; last_active_day?: string | null; lessons_done?: string[];
          dialogues_done?: string[]; badges?: string[]; exam_best?: number | null; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "user_stats_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "user_stats_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      exam_attempts: {
        Row: { id: string; user_id: string; started_at: string; score: number | null };
        Insert: { id?: string; user_id: string; started_at?: string; score?: number | null };
        Update: { id?: string; user_id?: string; started_at?: string; score?: number | null };
        Relationships: [
          { foreignKeyName: "exam_attempts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      content_reports: {
        Row: { id: number; user_id: string | null; ref_id: string; message: string; content_version: number | null; created_at: string };
        Insert: { id?: never; user_id?: string | null; ref_id: string; message: string; content_version?: number | null; created_at?: string };
        Update: { id?: never; user_id?: string | null; ref_id?: string; message?: string; content_version?: number | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "content_reports_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          user_id: string | null; group_id: string | null; pseudo: string | null; avatar_emoji: string | null;
          xp_total: number | null; xp_week: number | null; streak: number | null; lessons_done_count: number | null;
          lessons_done: string[] | null; dialogues_done: string[] | null; badges: string[] | null; exam_best: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      join_group: { Args: { p_invite_code: string; p_pseudo: string; p_avatar: string }; Returns: undefined };
      start_exam_attempt: { Args: Record<PropertyKey, never>; Returns: Json };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      my_group_id: { Args: Record<PropertyKey, never>; Returns: string };
      paris_today: { Args: Record<PropertyKey, never>; Returns: string };
      paris_week_start: { Args: { d: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
