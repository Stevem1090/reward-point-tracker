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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
      bill_accounts: {
        Row: {
          account_kind: string
          apr: number | null
          color: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number
          family_id: string
          id: string
          name: string
          promo_end_date: string | null
          sort_order: number
        }
        Insert: {
          account_kind?: string
          apr?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          family_id?: string
          id?: string
          name: string
          promo_end_date?: string | null
          sort_order?: number
        }
        Update: {
          account_kind?: string
          apr?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          family_id?: string
          id?: string
          name?: string
          promo_end_date?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_types: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          family_id: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_types_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          bill_type_id: string | null
          created_at: string
          custom_count: number | null
          expiry_date: string | null
          family_id: string
          frequency: string
          id: string
          name: string
          payment_date: string | null
          payment_day: number | null
          updated_at: string
          weekly_days: string[] | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount: number
          bill_type_id?: string | null
          created_at?: string
          custom_count?: number | null
          expiry_date?: string | null
          family_id?: string
          frequency: string
          id?: string
          name: string
          payment_date?: string | null
          payment_day?: number | null
          updated_at?: string
          weekly_days?: string[] | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          bill_type_id?: string | null
          created_at?: string
          custom_count?: number | null
          expiry_date?: string | null
          family_id?: string
          frequency?: string
          id?: string
          name?: string
          payment_date?: string | null
          payment_day?: number | null
          updated_at?: string
          weekly_days?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bill_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_bill_type_id_fkey"
            columns: ["bill_type_id"]
            isOneToOne: false
            referencedRelation: "bill_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_categories: {
        Row: {
          color: string
          created_at: string
          family_id: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          family_id?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_completions: {
        Row: {
          chore_id: string
          completed_at: string
          family_id: string
          id: string
          user_id: string
        }
        Insert: {
          chore_id: string
          completed_at?: string
          family_id?: string
          id?: string
          user_id: string
        }
        Update: {
          chore_id?: string
          completed_at?: string
          family_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          archived: boolean
          category_id: string
          completed_at: string | null
          created_at: string
          family_id: string
          frequency: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          category_id: string
          completed_at?: string | null
          created_at?: string
          family_id?: string
          frequency: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          archived?: boolean
          category_id?: string
          completed_at?: string | null
          created_at?: string
          family_id?: string
          frequency?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "chore_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
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
          family_id: string
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
          family_id?: string
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
          family_id?: string
          id?: string
          is_recurring?: boolean
          owner_ids?: string[] | null
          recurrence_pattern?: string | null
          start_time?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_by: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_preferences: {
        Row: {
          confidence: number | null
          created_at: string | null
          evidence_count: number | null
          family_id: string
          id: string
          last_updated: string | null
          preference_type: string
          user_id: string
          value: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          evidence_count?: number | null
          family_id?: string
          id?: string
          last_updated?: string | null
          preference_type: string
          user_id: string
          value: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          evidence_count?: number | null
          family_id?: string
          id?: string
          last_updated?: string | null
          preference_type?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_preferences_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_advice_runs: {
        Row: {
          advice_markdown: string | null
          context_note: string | null
          created_at: string
          family_id: string
          id: string
          period_label: string
          summary_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          advice_markdown?: string | null
          context_note?: string | null
          created_at?: string
          family_id?: string
          id?: string
          period_label: string
          summary_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          advice_markdown?: string | null
          context_note?: string | null
          created_at?: string
          family_id?: string
          id?: string
          period_label?: string
          summary_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_advice_runs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      freezer_flags: {
        Row: {
          created_at: string
          family_id: string
          id: string
          meal_id: string
          reminder_sent: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string
          id?: string
          meal_id: string
          reminder_sent?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          meal_id?: string
          reminder_sent?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freezer_flags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freezer_flags_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          expiry_date: string | null
          family_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          expiry_date?: string | null
          family_id?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          expiry_date?: string | null
          family_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          approved_at: string | null
          created_at: string
          family_id: string
          id: string
          status: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          status?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          status?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ratings: {
        Row: {
          created_at: string
          family_id: string
          id: string
          meal_id: string
          notes: string | null
          rating: number
          recipe_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string
          id?: string
          meal_id: string
          notes?: string | null
          rating: number
          recipe_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          meal_id?: string
          notes?: string | null
          rating?: number
          recipe_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ratings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ratings_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          day_of_week: string
          description: string | null
          estimated_cook_minutes: number | null
          family_id: string
          id: string
          meal_name: string
          meal_plan_id: string
          meal_type: string
          recipe_id: string | null
          recipe_url: string | null
          rejection_reason: string | null
          servings: number
          sort_order: number
          source_type: string
          status: string
          sw_healthy_extra_amount: number | null
          sw_healthy_extra_type:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed: boolean | null
          sw_swips: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          description?: string | null
          estimated_cook_minutes?: number | null
          family_id?: string
          id?: string
          meal_name: string
          meal_plan_id: string
          meal_type?: string
          recipe_id?: string | null
          recipe_url?: string | null
          rejection_reason?: string | null
          servings?: number
          sort_order?: number
          source_type?: string
          status?: string
          sw_healthy_extra_amount?: number | null
          sw_healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed?: boolean | null
          sw_swips?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          description?: string | null
          estimated_cook_minutes?: number | null
          family_id?: string
          id?: string
          meal_name?: string
          meal_plan_id?: string
          meal_type?: string
          recipe_id?: string | null
          recipe_url?: string | null
          rejection_reason?: string | null
          servings?: number
          sort_order?: number
          source_type?: string
          status?: string
          sw_healthy_extra_amount?: number | null
          sw_healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed?: boolean | null
          sw_swips?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      point_entries: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          family_id: string
          id: string
          points: number
          timestamp: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          points: number
          timestamp?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          family_id?: string
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
          {
            foreignKeyName: "point_entries_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
      push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipe_cards: {
        Row: {
          base_servings: number
          created_at: string
          estimated_calories_per_serving: number | null
          family_id: string
          html_content: string | null
          id: string
          image_url: string | null
          ingredients: Json
          meal_id: string
          meal_name: string
          steps: Json
        }
        Insert: {
          base_servings?: number
          created_at?: string
          estimated_calories_per_serving?: number | null
          family_id?: string
          html_content?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          meal_id: string
          meal_name: string
          steps?: Json
        }
        Update: {
          base_servings?: number
          created_at?: string
          estimated_calories_per_serving?: number | null
          family_id?: string
          html_content?: string | null
          id?: string
          image_url?: string | null
          ingredients?: Json
          meal_id?: string
          meal_name?: string
          steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recipe_cards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_cards_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: true
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cookbook_title: string | null
          created_at: string
          description: string | null
          estimated_cook_minutes: number | null
          family_id: string
          id: string
          image_url: string | null
          ingredients: Json
          name: string
          recipe_url: string | null
          servings: number
          source_type: string
          steps: Json
          sw_healthy_extra_amount: number | null
          sw_healthy_extra_type:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed: boolean | null
          sw_swips: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cookbook_title?: string | null
          created_at?: string
          description?: string | null
          estimated_cook_minutes?: number | null
          family_id?: string
          id?: string
          image_url?: string | null
          ingredients?: Json
          name: string
          recipe_url?: string | null
          servings?: number
          source_type: string
          steps?: Json
          sw_healthy_extra_amount?: number | null
          sw_healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed?: boolean | null
          sw_swips?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cookbook_title?: string | null
          created_at?: string
          description?: string | null
          estimated_cook_minutes?: number | null
          family_id?: string
          id?: string
          image_url?: string | null
          ingredients?: Json
          name?: string
          recipe_url?: string | null
          servings?: number
          source_type?: string
          steps?: Json
          sw_healthy_extra_amount?: number | null
          sw_healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          sw_is_speed?: boolean | null
          sw_swips?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
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
          family_id: string
          id: string
          owner_id: string
          reminder_id: string
        }
        Insert: {
          created_at?: string | null
          family_id?: string
          id?: string
          owner_id: string
          reminder_id: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          owner_id?: string
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_owners_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
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
          family_id: string
          id: string
          time: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          days: string[]
          family_id?: string
          id?: string
          time: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          days?: string[]
          family_id?: string
          id?: string
          time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_categories: {
        Row: {
          created_at: string
          description: string | null
          family_id: string
          id: string
          name: string
          point_value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          name: string
          point_value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          family_id?: string
          id?: string
          name?: string
          point_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          family_id: string
          id: string
          items: Json
          meal_plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string
          id?: string
          items?: Json
          meal_plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          items?: Json
          meal_plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: true
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sw_foods: {
        Row: {
          created_at: string
          family_id: string
          healthy_extra_amount: number
          healthy_extra_type:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id: string
          is_free: boolean
          is_speed: boolean
          name: string
          swips: number
          updated_at: string
          user_id: string
          weight: string | null
        }
        Insert: {
          created_at?: string
          family_id?: string
          healthy_extra_amount?: number
          healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id?: string
          is_free?: boolean
          is_speed?: boolean
          name: string
          swips?: number
          updated_at?: string
          user_id: string
          weight?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string
          healthy_extra_amount?: number
          healthy_extra_type?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id?: string
          is_free?: boolean
          is_speed?: boolean
          name?: string
          swips?: number
          updated_at?: string
          user_id?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sw_foods_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      sw_log_entries: {
        Row: {
          created_at: string
          entry_type: string
          food_id: string | null
          healthy_extra_amount_snapshot: number
          healthy_extra_type_snapshot:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id: string
          is_speed_snapshot: boolean
          log_date: string
          meal_id: string | null
          name_snapshot: string
          quantity: number
          recipe_id: string | null
          swips_snapshot: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_type: string
          food_id?: string | null
          healthy_extra_amount_snapshot?: number
          healthy_extra_type_snapshot?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id?: string
          is_speed_snapshot?: boolean
          log_date?: string
          meal_id?: string | null
          name_snapshot: string
          quantity?: number
          recipe_id?: string | null
          swips_snapshot?: number
          user_id: string
        }
        Update: {
          created_at?: string
          entry_type?: string
          food_id?: string | null
          healthy_extra_amount_snapshot?: number
          healthy_extra_type_snapshot?:
            | Database["public"]["Enums"]["sw_healthy_extra_type"]
            | null
          id?: string
          is_speed_snapshot?: boolean
          log_date?: string
          meal_id?: string | null
          name_snapshot?: string
          quantity?: number
          recipe_id?: string | null
          swips_snapshot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sw_log_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "sw_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sw_log_entries_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "sw_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sw_log_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      sw_meal_items: {
        Row: {
          created_at: string
          family_id: string
          food_id: string
          id: string
          meal_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          family_id?: string
          food_id: string
          id?: string
          meal_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          family_id?: string
          food_id?: string
          id?: string
          meal_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "sw_meal_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sw_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "sw_foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sw_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "sw_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      sw_meals: {
        Row: {
          created_at: string
          family_id: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sw_meals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sections: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_sections_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          due_at: string | null
          family_id: string
          id: string
          is_private: boolean
          notes: string | null
          notified_at: string | null
          owner_id: string
          repeat: string
          repeat_day: number | null
          repeat_days: number[] | null
          repeat_interval: number
          repeat_month_days: number[] | null
          repeat_weekday: number | null
          section_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          family_id?: string
          id?: string
          is_private?: boolean
          notes?: string | null
          notified_at?: string | null
          owner_id?: string
          repeat?: string
          repeat_day?: number | null
          repeat_days?: number[] | null
          repeat_interval?: number
          repeat_month_days?: number[] | null
          repeat_weekday?: number | null
          section_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_at?: string | null
          family_id?: string
          id?: string
          is_private?: boolean
          notes?: string | null
          notified_at?: string | null
          owner_id?: string
          repeat?: string
          repeat_day?: number | null
          repeat_days?: number[] | null
          repeat_interval?: number
          repeat_month_days?: number[] | null
          repeat_weekday?: number | null
          section_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "task_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          color: string | null
          created_at: string
          email_notifications: boolean | null
          id: string
          name: string | null
          push_notifications: boolean | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          email_notifications?: boolean | null
          id: string
          name?: string | null
          push_notifications?: boolean | null
        }
        Update: {
          color?: string | null
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          name?: string | null
          push_notifications?: boolean | null
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
      accept_family_invite: { Args: { _token: string }; Returns: string }
      check_and_send_reminders: { Args: never; Returns: undefined }
      check_freezer_reminders: { Args: never; Returns: undefined }
      create_family_invite: { Args: { _email: string }; Returns: string }
      current_family_id: { Args: never; Returns: string }
      debug_test_push_notification: { Args: never; Returns: undefined }
      ensure_family: { Args: never; Returns: string }
      get_invite_info: {
        Args: { _token: string }
        Returns: {
          email: string
          expired: boolean
          family_name: string
        }[]
      }
      get_points_summary_html: {
        Args: { summary_date: string }
        Returns: string
      }
      is_family_master: { Args: { _family: string }; Returns: boolean }
      leave_family: { Args: never; Returns: undefined }
      remove_family_member: { Args: { _user: string }; Returns: undefined }
      roll_recurring_tasks: { Args: never; Returns: undefined }
      send_scheduled_emails: { Args: never; Returns: undefined }
      task_next_occurrence: {
        Args: {
          _after: string
          _day: number
          _due: string
          _repeat: string
          _weekday: number
        }
        Returns: string
      }
      task_next_occurrence_v2: {
        Args: {
          _after: string
          _days: number[]
          _due: string
          _interval: number
          _month_days: number[]
          _repeat: string
        }
        Returns: string
      }
    }
    Enums: {
      sw_healthy_extra_type: "calcium" | "fibre" | "healthy_fats"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      sw_healthy_extra_type: ["calcium", "fibre", "healthy_fats"],
    },
  },
} as const
