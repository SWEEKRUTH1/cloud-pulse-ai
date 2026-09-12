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
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          severity: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          resource_id: string | null
          resource_type: string | null
          status: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cloud_connections: {
        Row: {
          account_ref: string | null
          auth_method: string
          created_at: string
          created_by: string | null
          credential_ref: string | null
          display_name: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          organization_id: string
          provider: string
          region: string
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          account_ref?: string | null
          auth_method?: string
          created_at?: string
          created_by?: string | null
          credential_ref?: string | null
          display_name: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id: string
          provider: string
          region: string
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          account_ref?: string | null
          auth_method?: string
          created_at?: string
          created_by?: string | null
          credential_ref?: string | null
          display_name?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id?: string
          provider?: string
          region?: string
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_settings: {
        Row: {
          id: string
          mode: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          mode?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          mode?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cloud_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_records: {
        Row: {
          daily_cost: number
          hourly_cost: number
          id: string
          monthly_estimate: number
          resource_id: string
          timestamp: string
        }
        Insert: {
          daily_cost: number
          hourly_cost: number
          id?: string
          monthly_estimate: number
          resource_id: string
          timestamp?: string
        }
        Update: {
          daily_cost?: number
          hourly_cost?: number
          id?: string
          monthly_estimate?: number
          resource_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_records_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          connections: number
          cpu: number
          disk: number
          error_rate: number
          id: number
          instance_count: number
          latency: number
          memory: number
          network_in: number
          network_out: number
          requests: number
          resource_id: string
          timestamp: string
        }
        Insert: {
          connections?: number
          cpu: number
          disk?: number
          error_rate?: number
          id?: number
          instance_count?: number
          latency?: number
          memory: number
          network_in?: number
          network_out?: number
          requests?: number
          resource_id: string
          timestamp?: string
        }
        Update: {
          connections?: number
          cpu?: number
          disk?: number
          error_rate?: number
          id?: number
          instance_count?: number
          latency?: number
          memory?: number
          network_in?: number
          network_out?: number
          requests?: number
          resource_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          confidence: number
          horizon_minutes: number
          id: string
          predicted_load: number
          reasoning: string | null
          recommended_instances: number
          resource_id: string
          risk_level: string
          timestamp: string
        }
        Insert: {
          confidence: number
          horizon_minutes?: number
          id?: string
          predicted_load: number
          reasoning?: string | null
          recommended_instances: number
          resource_id: string
          risk_level: string
          timestamp?: string
        }
        Update: {
          confidence?: number
          horizon_minutes?: number
          id?: string
          predicted_load?: number
          reasoning?: string | null
          recommended_instances?: number
          resource_id?: string
          risk_level?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          enabled: boolean
          environment_id: string
          hourly_rate: number
          id: string
          instance_count: number
          max_instances: number
          min_instances: number
          name: string
          provider: string
          region: string
          resource_type: string
          status: string
          target_cpu: number
          target_memory: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment_id: string
          hourly_rate?: number
          id?: string
          instance_count?: number
          max_instances?: number
          min_instances?: number
          name: string
          provider?: string
          region?: string
          resource_type: string
          status?: string
          target_cpu?: number
          target_memory?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment_id?: string
          hourly_rate?: number
          id?: string
          instance_count?: number
          max_instances?: number
          min_instances?: number
          name?: string
          provider?: string
          region?: string
          resource_type?: string
          status?: string
          target_cpu?: number
          target_memory?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      scaling_events: {
        Row: {
          action: string
          id: string
          new_instances: number
          previous_instances: number
          reason: string | null
          resource_id: string
          status: string
          timestamp: string
          trigger: string
        }
        Insert: {
          action: string
          id?: string
          new_instances: number
          previous_instances: number
          reason?: string | null
          resource_id: string
          status?: string
          timestamp?: string
          trigger?: string
        }
        Update: {
          action?: string
          id?: string
          new_instances?: number
          previous_instances?: number
          reason?: string | null
          resource_id?: string
          status?: string
          timestamp?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "scaling_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      scaling_policies: {
        Row: {
          enabled: boolean
          id: string
          max_instances: number
          min_instances: number
          resource_id: string
          scale_down_cooldown: number
          scale_up_cooldown: number
          target_cpu: number
          target_memory: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          max_instances?: number
          min_instances?: number
          resource_id: string
          scale_down_cooldown?: number
          scale_up_cooldown?: number
          target_cpu?: number
          target_memory?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          max_instances?: number
          min_instances?: number
          resource_id?: string
          scale_down_cooldown?: number
          scale_up_cooldown?: number
          target_cpu?: number
          target_memory?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scaling_policies_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
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
      app_role: ["admin", "operator", "viewer"],
    },
  },
} as const
