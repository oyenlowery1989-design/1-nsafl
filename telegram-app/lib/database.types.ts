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
      access_attempts: {
        Row: {
          created_at: string | null
          devtools_opened: boolean | null
          geo_location: string | null
          id: string
          ip: string | null
          language: string | null
          referrer: string | null
          screen: string | null
          telegram_first_name: string | null
          telegram_id: number | null
          telegram_username: string | null
          tg_sdk_fake: boolean | null
          tg_sdk_present: boolean | null
          tg_start_param: string | null
          timezone: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          devtools_opened?: boolean | null
          geo_location?: string | null
          id?: string
          ip?: string | null
          language?: string | null
          referrer?: string | null
          screen?: string | null
          telegram_first_name?: string | null
          telegram_id?: number | null
          telegram_username?: string | null
          tg_sdk_fake?: boolean | null
          tg_sdk_present?: boolean | null
          tg_start_param?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          devtools_opened?: boolean | null
          geo_location?: string | null
          id?: string
          ip?: string | null
          language?: string | null
          referrer?: string | null
          screen?: string | null
          telegram_first_name?: string | null
          telegram_id?: number | null
          telegram_username?: string | null
          tg_sdk_fake?: boolean | null
          tg_sdk_present?: boolean | null
          tg_start_param?: string | null
          timezone?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      blocked_telegram_ids: {
        Row: {
          blocked_at: string | null
          id: string
          reason: string | null
          telegram_id: number
        }
        Insert: {
          blocked_at?: string | null
          id?: string
          reason?: string | null
          telegram_id: number
        }
        Update: {
          blocked_at?: string | null
          id?: string
          reason?: string | null
          telegram_id?: number
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          asset_code: string
          created_at: string | null
          donation_target: string | null
          donation_type: string
          id: string
          stellar_tx_hash: string
          verified: boolean | null
          wallet_id: string
        }
        Insert: {
          amount: number
          asset_code: string
          created_at?: string | null
          donation_target?: string | null
          donation_type: string
          id?: string
          stellar_tx_hash: string
          verified?: boolean | null
          wallet_id: string
        }
        Update: {
          amount?: number
          asset_code?: string
          created_at?: string | null
          donation_target?: string | null
          donation_type?: string
          id?: string
          stellar_tx_hash?: string
          verified?: boolean | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          balls_spawned: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          kicks: number | null
          telegram_id: number | null
          wallet_id: string | null
        }
        Insert: {
          balls_spawned?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          kicks?: number | null
          telegram_id?: number | null
          wallet_id?: string | null
        }
        Update: {
          balls_spawned?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          kicks?: number | null
          telegram_id?: number | null
          wallet_id?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string | null
          token_amount: number | null
          id: string
          purchase_type: string | null
          stellar_tx_hash: string
          verified: boolean | null
          wallet_id: string | null
          xlm_amount: number
        }
        Insert: {
          created_at?: string | null
          token_amount?: number | null
          id?: string
          purchase_type?: string | null
          stellar_tx_hash: string
          verified?: boolean | null
          wallet_id?: string | null
          xlm_amount: number
        }
        Update: {
          created_at?: string | null
          token_amount?: number | null
          id?: string
          purchase_type?: string | null
          stellar_tx_hash?: string
          verified?: boolean | null
          wallet_id?: string | null
          xlm_amount?: number
        }
        Relationships: []
      }
      team_change_requests: {
        Row: {
          admin_note: string | null
          created_at: string | null
          id: string
          requested_team: string
          resolved_at: string | null
          status: string
          telegram_id: number
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          id?: string
          requested_team: string
          resolved_at?: string | null
          status?: string
          telegram_id: number
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          id?: string
          requested_team?: string
          resolved_at?: string | null
          status?: string
          telegram_id?: number
        }
        Relationships: []
      }
      afl_bets: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          match_id: string
          picked_winner: string
          telegram_id: number
          tier_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id: string
          picked_winner: string
          telegram_id: number
          tier_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id?: string
          picked_winner?: string
          telegram_id?: number
          tier_id?: string
        }
        Relationships: []
      }
      funding_config: {
        Row: {
          created_at: string | null
          id: string
          milestones: Json
          target_xlm: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          milestones?: Json
          target_xlm?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          milestones?: Json
          target_xlm?: number
        }
        Relationships: []
      }
      movement_stats: {
        Row: {
          id: string
          monthly_data: Json | null
          target_funding: number | null
          total_funding: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          monthly_data?: Json | null
          target_funding?: number | null
          total_funding?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          monthly_data?: Json | null
          target_funding?: number | null
          total_funding?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          read: boolean
          telegram_id: number | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          read?: boolean
          telegram_id?: number | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          read?: boolean
          telegram_id?: number | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      regional_support: {
        Row: {
          color: string
          display_order: number | null
          id: string
          percentage: number | null
          region_name: string
        }
        Insert: {
          color: string
          display_order?: number | null
          id?: string
          percentage?: number | null
          region_name: string
        }
        Update: {
          color?: string
          display_order?: number | null
          id?: string
          percentage?: number | null
          region_name?: string
        }
        Relationships: []
      }
      tiers: {
        Row: {
          color: string
          display_order: number | null
          icon: string | null
          id: string
          max_balance: number | null
          min_balance: number
          name: string
          perks: Json | null
        }
        Insert: {
          color: string
          display_order?: number | null
          icon?: string | null
          id?: string
          max_balance?: number | null
          min_balance: number
          name: string
          perks?: Json | null
        }
        Update: {
          color?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          max_balance?: number | null
          min_balance?: number
          name?: string
          perks?: Json | null
        }
        Relationships: []
      }
      top_supporters: {
        Row: {
          amount: number | null
          hub_name: string | null
          id: string
          rank: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          amount?: number | null
          hub_name?: string | null
          id?: string
          rank?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          amount?: number | null
          hub_name?: string | null
          id?: string
          rank?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          display_preference: string | null
          favorite_team: string | null
          id: string
          is_blocked: boolean | null
          opt_in_telegram_notifications: boolean
          referred_by: number | null
          telegram_first_name: string | null
          telegram_id: number
          telegram_phone: string | null
          telegram_photo_url: string | null
          telegram_username: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_preference?: string | null
          favorite_team?: string | null
          id?: string
          is_blocked?: boolean | null
          opt_in_telegram_notifications?: boolean
          referred_by?: number | null
          telegram_first_name?: string | null
          telegram_id: number
          telegram_phone?: string | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_preference?: string | null
          favorite_team?: string | null
          id?: string
          is_blocked?: boolean | null
          opt_in_telegram_notifications?: boolean
          referred_by?: number | null
          telegram_first_name?: string | null
          telegram_id?: number
          telegram_phone?: string | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          balance_week_ago: number | null
          id: string
          last_synced_at: string | null
          nsafl_balance: number | null
          updated_at: string | null
          wallet_id: string
          xlm_balance: number | null
        }
        Insert: {
          balance_week_ago?: number | null
          id?: string
          last_synced_at?: string | null
          nsafl_balance?: number | null
          updated_at?: string | null
          wallet_id: string
          xlm_balance?: number | null
        }
        Update: {
          balance_week_ago?: number | null
          id?: string
          last_synced_at?: string | null
          nsafl_balance?: number | null
          updated_at?: string | null
          wallet_id?: string
          xlm_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balances_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          label: string | null
          last_connected_at: string | null
          stellar_address: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          last_connected_at?: string | null
          stellar_address: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          last_connected_at?: string | null
          stellar_address?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      game_aggregate: {
        Row: {
          high_score: number | null
          total_balls: number | null
          total_kicks: number | null
          total_sessions: number | null
          unique_players: number | null
        }
        Relationships: []
      }
      game_leaderboard: {
        Row: {
          balls_spawned: number | null
          display_preference: string | null
          duration_seconds: number | null
          kicks: number | null
          stellar_address: string | null
          telegram_first_name: string | null
          telegram_id: number | null
          telegram_username: string | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const
