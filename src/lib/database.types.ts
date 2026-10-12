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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          lead_id: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          lead_id?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lead_id?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          ai_status: string
          ai_summary: string | null
          automation_paused: boolean
          brand_link: string | null
          brand_name: string | null
          budget_min_inr: number | null
          budget_range: string | null
          campaign_id: string | null
          campaign_name: string | null
          category: string | null
          created_at: string
          duplicate_of: string | null
          email: string | null
          first_response_at: string | null
          form_id: string | null
          full_name: string | null
          id: string
          last_reply_at: string | null
          leadgen_id: string | null
          meta_created_at: string | null
          notes: string | null
          phone_e164: string | null
          phone_valid: boolean
          raw_fields: Json
          score: Database["public"]["Enums"]["lead_score"] | null
          score_source: string | null
          sheet_row: number | null
          source: Database["public"]["Enums"]["lead_source"]
          start_timeline: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          videos_per_month: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          ai_status?: string
          ai_summary?: string | null
          automation_paused?: boolean
          brand_link?: string | null
          brand_name?: string | null
          budget_min_inr?: number | null
          budget_range?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          category?: string | null
          created_at?: string
          duplicate_of?: string | null
          email?: string | null
          first_response_at?: string | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          last_reply_at?: string | null
          leadgen_id?: string | null
          meta_created_at?: string | null
          notes?: string | null
          phone_e164?: string | null
          phone_valid?: boolean
          raw_fields?: Json
          score?: Database["public"]["Enums"]["lead_score"] | null
          score_source?: string | null
          sheet_row?: number | null
          source?: Database["public"]["Enums"]["lead_source"]
          start_timeline?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          videos_per_month?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          ai_status?: string
          ai_summary?: string | null
          automation_paused?: boolean
          brand_link?: string | null
          brand_name?: string | null
          budget_min_inr?: number | null
          budget_range?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          category?: string | null
          created_at?: string
          duplicate_of?: string | null
          email?: string | null
          first_response_at?: string | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          last_reply_at?: string | null
          leadgen_id?: string | null
          meta_created_at?: string | null
          notes?: string | null
          phone_e164?: string | null
          phone_valid?: boolean
          raw_fields?: Json
          score?: Database["public"]["Enums"]["lead_score"] | null
          score_source?: string | null
          sheet_row?: number | null
          source?: Database["public"]["Enums"]["lead_source"]
          start_timeline?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          videos_per_month?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["channel"]
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction"]
          error: string | null
          id: string
          job_id: string | null
          lead_id: string
          provider_message_id: string | null
          status: Database["public"]["Enums"]["msg_status"]
          template_name: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["channel"]
          created_at?: string
          direction: Database["public"]["Enums"]["msg_direction"]
          error?: string | null
          id?: string
          job_id?: string | null
          lead_id: string
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          error?: string | null
          id?: string
          job_id?: string | null
          lead_id?: string
          provider_message_id?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_reels: {
        Row: {
          category: string
          id: string
          sort: number
          thumbnail_url: string | null
          title: string | null
          url: string
        }
        Insert: {
          category: string
          id?: string
          sort?: number
          thumbnail_url?: string | null
          title?: string | null
          url: string
        }
        Update: {
          category?: string
          id?: string
          sort?: number
          thumbnail_url?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_jobs: {
        Args: { batch?: number; only_types?: string[] }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          lead_id: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_team_member: { Args: never; Returns: boolean }
    }
    Enums: {
      channel: "whatsapp" | "email"
      job_status:
        | "pending"
        | "running"
        | "done"
        | "failed"
        | "dead"
        | "cancelled"
      lead_score: "hot" | "warm" | "cold"
      lead_source: "meta_form" | "website" | "ctwa"
      lead_status:
        | "new"
        | "contacted"
        | "replied"
        | "meeting_booked"
        | "won"
        | "lost"
        | "opted_out"
      msg_direction: "out" | "in"
      msg_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "bounced"
        | "received"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      channel: ["whatsapp", "email"],
      job_status: ["pending", "running", "done", "failed", "dead", "cancelled"],
      lead_score: ["hot", "warm", "cold"],
      lead_source: ["meta_form", "website", "ctwa"],
      lead_status: [
        "new",
        "contacted",
        "replied",
        "meeting_booked",
        "won",
        "lost",
        "opted_out",
      ],
      msg_direction: ["out", "in"],
      msg_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "bounced",
        "received",
      ],
    },
  },
} as const

