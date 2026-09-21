export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          audio_path: string | null;
          audio_url: string | null;
          author_id: string | null;
          content: string;
          created_at: string;
          expires_at: string | null;
          external_id: string | null;
          id: string;
          link: string | null;
          municipality_id: string | null;
          priority: string;
          published_at: string;
          source: string;
          title: string;
        };
        Insert: {
          audio_path?: string | null;
          audio_url?: string | null;
          author_id?: string | null;
          content: string;
          created_at?: string;
          expires_at?: string | null;
          external_id?: string | null;
          id?: string;
          link?: string | null;
          municipality_id?: string | null;
          priority?: string;
          published_at?: string;
          source: string;
          title: string;
        };
        Update: {
          audio_path?: string | null;
          audio_url?: string | null;
          author_id?: string | null;
          content?: string;
          created_at?: string;
          expires_at?: string | null;
          external_id?: string | null;
          id?: string;
          link?: string | null;
          municipality_id?: string | null;
          priority?: string;
          published_at?: string;
          source?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          inquiries_enabled: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          inquiries_enabled?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          inquiries_enabled?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          location: string | null;
          start_date: string;
          title: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          start_date: string;
          title: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          start_date?: string;
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
      election_candidates: {
        Row: {
          age: number | null;
          bio: string | null;
          created_at: string;
          election_id: string | null;
          email: string | null;
          facebook_url: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          motto: string | null;
          party_or_independent: string;
          photo_url: string | null;
          position_type: string;
          profession: string | null;
          program_priorities: string[];
          sort_order: number;
          website_url: string | null;
        };
        Insert: {
          age?: number | null;
          bio?: string | null;
          created_at?: string;
          election_id?: string | null;
          email?: string | null;
          facebook_url?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          motto?: string | null;
          party_or_independent: string;
          photo_url?: string | null;
          position_type: string;
          profession?: string | null;
          program_priorities?: string[];
          sort_order?: number;
          website_url?: string | null;
        };
        Update: {
          age?: number | null;
          bio?: string | null;
          created_at?: string;
          election_id?: string | null;
          email?: string | null;
          facebook_url?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          motto?: string | null;
          party_or_independent?: string;
          photo_url?: string | null;
          position_type?: string;
          profession?: string | null;
          program_priorities?: string[];
          sort_order?: number;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "election_candidates_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
        ];
      };
      election_candidates_deleted_log: {
        Row: {
          deleted_at: string | null;
          election_id: string | null;
          full_name: string | null;
          id: string;
          position_type: string | null;
        };
        Insert: {
          deleted_at?: string | null;
          election_id?: string | null;
          full_name?: string | null;
          id: string;
          position_type?: string | null;
        };
        Update: {
          deleted_at?: string | null;
          election_id?: string | null;
          full_name?: string | null;
          id?: string;
          position_type?: string | null;
        };
        Relationships: [];
      };
      elections: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          election_date: string | null;
          id: string;
          is_active: boolean;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          election_date?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          election_date?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "elections_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      elections_attachments: {
        Row: {
          created_at: string;
          description: string | null;
          election_id: string;
          file_name: string;
          file_size_bytes: number | null;
          file_type: string;
          file_url: string;
          id: string;
          sort_order: number;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          election_id: string;
          file_name: string;
          file_size_bytes?: number | null;
          file_type: string;
          file_url: string;
          id?: string;
          sort_order?: number;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          election_id?: string;
          file_name?: string;
          file_size_bytes?: number | null;
          file_type?: string;
          file_url?: string;
          id?: string;
          sort_order?: number;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "elections_attachments_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "elections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "elections_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
            foreignKeyName: "events_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
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
      help_guide_sections: {
        Row: {
          content: Json;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          section_emoji: string | null;
          section_key: string;
          section_order: number;
          section_title: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          content: Json;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          section_emoji?: string | null;
          section_key: string;
          section_order: number;
          section_title: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          content?: Json;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          section_emoji?: string | null;
          section_key?: string;
          section_order?: number;
          section_title?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
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
            foreignKeyName: "invite_codes_created_by_profiles_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invite_codes_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: false;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_reactions: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          reaction_type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          reaction_type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          reaction_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_reactions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "fk_mayor_inquiries_profiles";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
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
          calendar_url: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          logo_url: string | null;
          longitude: number | null;
          mayor_name: string | null;
          name: string;
          region: string | null;
          rss_url: string | null;
          slug: string;
        };
        Insert: {
          calendar_url?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          logo_url?: string | null;
          longitude?: number | null;
          mayor_name?: string | null;
          name: string;
          region?: string | null;
          rss_url?: string | null;
          slug: string;
        };
        Update: {
          calendar_url?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          logo_url?: string | null;
          longitude?: number | null;
          mayor_name?: string | null;
          name?: string;
          region?: string | null;
          rss_url?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      municipality_office_info: {
        Row: {
          address: string;
          email: string;
          id: string;
          mayor: string;
          municipality_id: string | null;
          office_hours: string;
          phone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string;
          email?: string;
          id?: string;
          mayor?: string;
          municipality_id?: string | null;
          office_hours?: string;
          phone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string;
          email?: string;
          id?: string;
          mayor?: string;
          municipality_id?: string | null;
          office_hours?: string;
          phone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "municipality_office_info_municipality_id_fkey";
            columns: ["municipality_id"];
            isOneToOne: true;
            referencedRelation: "municipalities";
            referencedColumns: ["id"];
          },
        ];
      };
      neighbor_connections: {
        Row: {
          created_at: string | null;
          id: string;
          receiver_id: string;
          requester_id: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          receiver_id: string;
          requester_id: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          receiver_id?: string;
          requester_id?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "neighbor_connections_receiver_id_fkey";
            columns: ["receiver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "neighbor_connections_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_critical: boolean;
          is_read: boolean;
          priority: string | null;
          ref_id: string | null;
          title: string;
          type: string;
          updated_at: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_critical?: boolean;
          is_read?: boolean;
          priority?: string | null;
          ref_id?: string | null;
          title: string;
          type: string;
          updated_at?: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_critical?: boolean;
          is_read?: boolean;
          priority?: string | null;
          ref_id?: string | null;
          title?: string;
          type?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      podnety_odpovede: {
        Row: {
          author_id: string;
          created_at: string;
          id: string;
          inquiry_id: string;
          message: string;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          id?: string;
          inquiry_id: string;
          message: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          id?: string;
          inquiry_id?: string;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "podnety_odpovede_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "podnety_odpovede_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "mayor_inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_options: {
        Row: {
          id: string;
          option_text: string;
          poll_id: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          option_text: string;
          poll_id: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          option_text?: string;
          poll_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_votes: {
        Row: {
          created_at: string;
          id: string;
          option_id: string;
          poll_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          option_id: string;
          poll_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          option_id?: string;
          poll_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "poll_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      polls: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          expires_at: string;
          id: string;
          is_active: boolean;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          expires_at: string;
          id?: string;
          is_active?: boolean;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          expires_at?: string;
          id?: string;
          is_active?: boolean;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey";
            columns: ["created_by"];
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
          is_admin: boolean | null;
          is_official: boolean | null;
          is_verified: boolean | null;
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
          is_admin?: boolean | null;
          is_official?: boolean | null;
          is_verified?: boolean | null;
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
          is_admin?: boolean | null;
          is_official?: boolean | null;
          is_verified?: boolean | null;
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
        ];
      };
      reminders: {
        Row: {
          created_at: string;
          event_id: string | null;
          id: string;
          remind_at: string;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          remind_at: string;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          remind_at?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      user_activity_log: {
        Row: {
          activity_type: string;
          created_at: string;
          id: string;
          page_name: string | null;
          user_id: string;
        };
        Insert: {
          activity_type: string;
          created_at?: string;
          id?: string;
          page_name?: string | null;
          user_id: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string;
          id?: string;
          page_name?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_push_subscriptions: {
        Row: {
          auth: string | null;
          created_at: string;
          endpoint: string;
          id: string;
          last_seen_at: string;
          p256dh: string | null;
          subscription: Json;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth?: string | null;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_seen_at?: string;
          p256dh?: string | null;
          subscription: Json;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string | null;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_seen_at?: string;
          p256dh?: string | null;
          subscription?: Json;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
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
      user_settings: {
        Row: {
          created_at: string;
          notifications_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      can_manage_group_sections: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      can_moderate: { Args: { _user_id: string }; Returns: boolean };
      can_write_neighbor_content: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      cast_poll_vote: {
        Args: { p_option_id: string; p_poll_id: string };
        Returns: Json;
      };
      cleanup_expired_and_old_data: { Args: never; Returns: undefined };
      cleanup_expired_announcements: { Args: never; Returns: number };
      cleanup_expired_group_announcements: { Args: never; Returns: number };
      cleanup_expired_official_notices: { Args: never; Returns: number };
      cleanup_expired_warehouse_items: { Args: never; Returns: number };
      cleanup_old_neighbor_posts: { Args: never; Returns: number };
      cleanup_used_invite_codes: { Args: never; Returns: number };
      current_user_municipality: { Args: never; Returns: string };
      delete_my_account: { Args: never; Returns: boolean };
      delete_neighbor: { Args: { _target: string }; Returns: boolean };
      enqueue_waste_collection_notifications: { Args: never; Returns: number };
      get_active_warehouse_counts: {
        Args: never;
        Returns: {
          active_count: number;
          type: string;
        }[];
      };
      get_community_statistics: {
        Args: { _municipality_id?: string };
        Returns: {
          active_this_month: number;
          active_today: number;
          total_registered: number;
        }[];
      };
      get_listing_reaction_count: {
        Args: { p_item_id: string };
        Returns: number;
      };
      get_or_create_neighbor_invite_codes: {
        Args: { _count?: number };
        Returns: {
          code: string;
          created_at: string;
          id: string;
          shared_at: string;
          shared_via: string;
          used_at: string;
          used_by: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      invite_code_random: { Args: never; Returns: string };
      is_active_verified_neighbor: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      is_admin_or_official: { Args: never; Returns: boolean };
      is_banned: { Args: { _user_id: string }; Returns: boolean };
      is_group_admin: {
        Args: { _group_key: string; _user_id: string };
        Returns: boolean;
      };
      is_inquiry_manager: { Args: { _user_id: string }; Returns: boolean };
      log_user_activity: {
        Args: { _activity_type: string; _page_name?: string };
        Returns: undefined;
      };
      mark_invite_code_shared: {
        Args: { _invite_id: string; _via?: string };
        Returns: boolean;
      };
      redeem_invite_code: { Args: { _code: string }; Returns: boolean };
      save_push_subscription: {
        Args: {
          p_auth: string;
          p_endpoint: string;
          p_p256dh: string;
          p_subscription: Json;
          p_user_agent: string;
        };
        Returns: undefined;
      };
      unban_neighbor: { Args: { _target: string }; Returns: boolean };
      verify_neighbor_manual:
        | { Args: { _neighbor_id: string }; Returns: boolean }
        | {
            Args: { _neighbor_id?: string; target_user_id?: string };
            Returns: boolean;
          };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "Sused", "Starosta", "Uradnik", "Farar", "VIP_Firma"],
    },
  },
} as const;
