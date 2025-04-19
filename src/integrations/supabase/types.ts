export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      auto_email_settings: {
        Row: {
          auto_send_enabled: boolean
          auto_send_time: string
          email: string
          id: string
          last_sent_date: string | null
        }
        Insert: {
          auto_send_enabled?: boolean
          auto_send_time?: string
          email: string
          id?: string
          last_sent_date?: string | null
        }
        Update: {
          auto_send_enabled?: boolean
          auto_send_time?: string
          email?: string
          id?: string
          last_sent_date?: string | null
        }
        Relationships: []
      }
      cron_job_log: {
        Row: {
          id: number
          job_name: string
          run_at: string
        }
        Insert: {
          id?: number
          job_name: string
          run_at?: string
        }
        Update: {
          id?: number
          job_name?: string
          run_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          is_recurring: boolean
          owner_ids: string[] | null
          recurrence_pattern: string | null
          start_time: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean
          owner_ids?: string[] | null
          recurrence_pattern?: string | null
          start_time: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean
          owner_ids?: string[] | null
          recurrence_pattern?: string | null
          start_time?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      point_entries: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          points: number
          timestamp: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          points: number
          timestamp?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reward_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          created_at: string | null
          id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: string
          message: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string
          message?: string
        }
        Relationships: []
      }
      reminder_notifications: {
        Row: {
          body: string | null
          id: string
          reminder_id: string
          sent_at: string
          sent_to: string[]
          title: string
        }
        Insert: {
          body?: string | null
          id?: string
          reminder_id: string
          sent_at?: string
          sent_to?: string[]
          title: string
        }
        Update: {
          body?: string | null
          id?: string
          reminder_id?: string
          sent_at?: string
          sent_to?: string[]
          title?: string
        }
        Relationships: []
      }
      reminder_owners: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
          reminder_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
          reminder_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_owners_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          active: boolean
          created_at: string | null
          days: string[]
          id: string
          time: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          days: string[]
          id?: string
          time: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          days?: string[]
          id?: string
          time?: string
          title?: string
        }
        Relationships: []
      }
      reward_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          point_value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          point_value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          point_value?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id: string
          name?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      user_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      vapid_keys: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_send_reminders: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      debug_test_push_notification: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_points_summary_html: {
        Args: { summary_date: string }
        Returns: string
      }
      send_scheduled_emails: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
