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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          external_id: string | null
          id: string
          link: string | null
          priority: string
          published_at: string
          source: string
          title: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          external_id?: string | null
          id?: string
          link?: string | null
          priority?: string
          published_at?: string
          source: string
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          external_id?: string | null
          id?: string
          link?: string | null
          priority?: string
          published_at?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          item_id: string
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          item_id: string
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          item_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          author_id: string
          created_at: string
          description: string
          ends_at: string | null
          id: string
          location: string
          municipality_id: string | null
          starts_at: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          municipality_id?: string | null
          starts_at: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          municipality_id?: string | null
          starts_at?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          municipality_id: string | null
          role: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          municipality_id?: string | null
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          municipality_id?: string | null
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          sender_id: string
          text: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
          text: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          mayor_name: string | null
          name: string
          region: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mayor_name?: string | null
          name: string
          region?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mayor_name?: string | null
          name?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned_until: string | null
          created_at: string
          id: string
          invite_code: string | null
          is_active_neighbor: boolean
          municipality_id: string | null
          name: string
          role: string
          street: string | null
          updated_at: string
        }
        Insert: {
          ban_reason?: string | null
          banned_until?: string | null
          created_at?: string
          id: string
          invite_code?: string | null
          is_active_neighbor?: boolean
          municipality_id?: string | null
          name?: string
          role?: string
          street?: string | null
          updated_at?: string
        }
        Update: {
          ban_reason?: string | null
          banned_until?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          is_active_neighbor?: boolean
          municipality_id?: string | null
          name?: string
          role?: string
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouse_items: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          price: number
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          price?: number
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          price?: number
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ban_neighbor: {
        Args: { _days: number; _reason?: string; _target: string }
        Returns: string
      }
      can_moderate: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_announcements: { Args: never; Returns: number }
      cleanup_old_neighbor_posts: { Args: never; Returns: number }
      cleanup_used_invite_codes: { Args: never; Returns: number }
      current_user_municipality: { Args: never; Returns: string }
      delete_neighbor: { Args: { _target: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      redeem_invite_code: { Args: { _code: string }; Returns: boolean }
      unban_neighbor: { Args: { _target: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "Sused"
        | "Starosta"
        | "Uradnik"
        | "Farar"
        | "VIP_Firma"
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
      app_role: ["admin", "Sused", "Starosta", "Uradnik", "Farar", "VIP_Firma"],
    },
  },
} as const
