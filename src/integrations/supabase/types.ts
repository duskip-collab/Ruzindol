export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null;
          audio_path: string | null;
          audio_url: string | null;
          content: string;
          created_at: string;
          audio_path: string | null;
          audio_url: string | null;
          external_id: string | null;
          id: string;
          expires_at: string | null;
          link: string | null;
          priority: string;
          published_at: string;
          source: string;
          title: string;
        };
          audio_path?: string | null;
          audio_url?: string | null;
        Insert: {
          author_id?: string | null;
          content: string;
          created_at?: string;
          audio_path?: string | null;
          audio_url?: string | null;
          expires_at?: string | null;
          external_id?: string | null;
          id?: string;
          link?: string | null;
          priority?: string;
          published_at?: string;
          source: string;
          audio_path?: string | null;
          audio_url?: string | null;
          title: string;
        };
        Update: {
          author_id?: string | null;
          content?: string;
          created_at?: string;
          expires_at?: string | null;
          audio_path?: string | null;
          audio_url?: string | null;
          external_id?: string | null;
          id?: string;
          link?: string | null;
          priority?: string;
          published_at?: string;
          source?: string;
          title?: string;
        };
        Relationships: [];
      };
      chats: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          item_id: string;
          seller_id: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          item_id: string;
          seller_id: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string;
          seller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chats_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          author_id: string | null;
          created_at: string;
          description: string;
          end_date: string | null;
          end_time: string | null;
          ends_at: string | null;
          id: string;
          image_url: string | null;
          location: string;
          municipality_id: string | null;
          source_url: string | null;
          starts_at: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          end_time?: string | null;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          location?: string;
          municipality_id?: string | null;
          source_url?: string | null;
          starts_at: string;
          title: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          description?: string;
          end_date?: string | null;
          end_time?: string | null;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          location?: string;
          municipality_id?: string | null;
          source_url?: string | null;
          starts_at?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendees: {
        Row: {
          created_at: string;
          event_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_admins: {
        Row: {
          created_at: string;
          granted_by: string | null;
          group_key: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          group_key: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          group_key?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_admins_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_announcements: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          deceased_name: string | null;
          expires_at: string | null;
          group_key: string;
          id: string;
          image_url: string | null;
          linked_event_id: string | null;
          post_kind: string;
          title: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          deceased_name?: string | null;
          expires_at?: string | null;
          group_key: string;
          id?: string;
          image_url?: string | null;
          linked_event_id?: string | null;
          post_kind?: string;
          title: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          deceased_name?: string | null;
          expires_at?: string | null;
          group_key?: string;
          id?: string;
          image_url?: string | null;
          linked_event_id?: string | null;
          post_kind?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_announcements_linked_event_id_fkey";
            columns: ["linked_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      invite_codes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          municipality_id: string | null;
          role: string;
          shared_at: string | null;
          shared_via: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          municipality_id?: string | null;
          role?: string;
          shared_at?: string | null;
          shared_via?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          municipality_id?: string | null;
          role?: string;
          shared_at?: string | null;
          shared_via?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invite_codes_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          sender_id: string;
          text: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          text: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      municipalities: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          mayor_name: string | null;
          latitude: number | null;
          name: string;
          region: string | null;
          longitude: number | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          mayor_name?: string | null;
          latitude?: number | null;
          name: string;
          region?: string | null;
          longitude?: number | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          mayor_name?: string | null;
          latitude?: number | null;
          name?: string;
          region?: string | null;
          longitude?: number | null;
          slug?: string;
        };
        Relationships: [];
      };
      mayor_inquiries: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          answered_by: string | null;
          body: string;
          category: string;
          created_at: string;
          id: string;
          image_url: string | null;
          is_anonymous_public: boolean;
          is_public: boolean;
          latitude: number | null;
          longitude: number | null;
          status: string;
          title: string;
          user_id: string;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          body: string;
          category: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_anonymous_public?: boolean;
          is_public?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          status?: string;
          title: string;
          user_id: string;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          body?: string;
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_anonymous_public?: boolean;
          is_public?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          status?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mayor_inquiries_answered_by_fkey";
            columns: ["answered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mayor_inquiries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          category: string | null;
          content: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          image_url: string | null;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          content?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          image_url?: string | null;
          title: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          content?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          image_url?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_replies: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          post_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          post_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_replies_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_replies_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reports: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          reason: string | null;
          reporter_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          reason?: string | null;
          reporter_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          reason?: string | null;
          reporter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          ban_reason: string | null;
          banned_until: string | null;
          created_at: string;
          email: string | null;
          id: string;
          invite_code: string | null;
          invited_by_user_id: string | null;
          is_active_neighbor: boolean;
          is_verified: boolean;
          municipality_id: string | null;
          name: string;
          role: string;
          street: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          ban_reason?: string | null;
          banned_until?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          invite_code?: string | null;
          invited_by_user_id?: string | null;
          is_active_neighbor?: boolean;
          is_verified?: boolean;
          municipality_id?: string | null;
          name?: string;
          role?: string;
          street?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          ban_reason?: string | null;
          banned_until?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          invite_code?: string | null;
          invited_by_user_id?: string | null;
          is_active_neighbor?: boolean;
          is_verified?: boolean;
          municipality_id?: string | null;
          name?: string;
          role?: string;
          street?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_user_id_fkey";
            columns: ["invited_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      warehouse_items: {
        Row: {
          created_at: string;
          description: string;
          expires_at: string | null;
          id: string;
          image_path: string | null;
          image_path_2: string | null;
          image_path_3: string | null;
          image_path_4: string | null;
          image_url: string | null;
          image_url_2: string | null;
          image_url_3: string | null;
          image_url_4: string | null;
          price: number;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          image_path?: string | null;
          image_path_2?: string | null;
          image_path_3?: string | null;
          image_path_4?: string | null;
          image_url?: string | null;
          image_url_2?: string | null;
          image_url_3?: string | null;
          image_url_4?: string | null;
          price?: number;
          title: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          image_path?: string | null;
          image_path_2?: string | null;
          image_path_3?: string | null;
          image_path_4?: string | null;
          image_url?: string | null;
          image_url_2?: string | null;
          image_url_3?: string | null;
          image_url_4?: string | null;
          price?: number;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ban_neighbor: {
        Args: { _days: number; _reason?: string; _target: string };
        Returns: string;
      };
      can_moderate: { Args: { _user_id: string }; Returns: boolean };
      can_manage_group_sections: { Args: { _user_id: string }; Returns: boolean };
      cleanup_expired_announcements: { Args: never; Returns: number };
      cleanup_expired_warehouse_items: { Args: never; Returns: number };
      cleanup_expired_group_announcements: { Args: never; Returns: number };
      cleanup_old_neighbor_posts: { Args: never; Returns: number };
      cleanup_used_invite_codes: { Args: never; Returns: number };
      current_user_municipality: { Args: never; Returns: string };
      delete_neighbor: { Args: { _target: string }; Returns: boolean };
      get_or_create_neighbor_invite_codes: {
        Args: { _count?: number };
        Returns: {
          id: string;
          code: string;
          created_at: string;
          shared_at: string | null;
          shared_via: string | null;
          used_by: string | null;
          used_at: string | null;
        }[];
      };
      get_active_warehouse_counts: {
        Args: never;
        Returns: {
          type: string;
          active_count: number;
        }[];
      };
      mark_invite_code_shared: {
        Args: { _invite_id: string; _via?: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_banned: { Args: { _user_id: string }; Returns: boolean };
      is_group_admin: { Args: { _group_key: string; _user_id: string }; Returns: boolean };
      redeem_invite_code: { Args: { _code: string }; Returns: boolean };
      unban_neighbor: { Args: { _target: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "Sused" | "Starosta" | "Uradnik" | "Farar" | "VIP_Firma";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "Sused", "Starosta", "Uradnik", "Farar", "VIP_Firma"],
    },
  },
} as const;
