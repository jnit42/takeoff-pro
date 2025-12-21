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
      assemblies: {
        Row: {
          checklist_items: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean | null
          items: Json | null
          name: string
          project_type: string
          trade: string
        }
        Insert: {
          checklist_items?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          items?: Json | null
          name: string
          project_type: string
          trade: string
        }
        Update: {
          checklist_items?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          items?: Json | null
          name?: string
          project_type?: string
          trade?: string
        }
        Relationships: []
      }
      assumptions: {
        Row: {
          created_at: string
          id: string
          is_exclusion: boolean | null
          notes: string | null
          project_id: string
          statement: string
          status: string | null
          trade: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_exclusion?: boolean | null
          notes?: string | null
          project_id: string
          statement: string
          status?: string | null
          trade?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_exclusion?: boolean | null
          notes?: string | null
          project_id?: string
          statement?: string
          status?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          id: string
          item: string
          notes: string | null
          project_id: string
          status: string | null
          trade: string
        }
        Insert: {
          created_at?: string
          id?: string
          item: string
          notes?: string | null
          project_id: string
          status?: string | null
          trade: string
        }
        Update: {
          created_at?: string
          id?: string
          item?: string
          notes?: string | null
          project_id?: string
          status?: string | null
          trade?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_estimates: {
        Row: {
          assumptions: Json | null
          created_at: string
          id: string
          project_id: string
          status: string | null
          subcontractor_name: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json | null
          created_at?: string
          id?: string
          project_id: string
          status?: string | null
          subcontractor_name?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          status?: string | null
          subcontractor_name?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_line_items: {
        Row: {
          base_rate: number
          created_at: string
          extended: number | null
          final_rate: number | null
          id: string
          labor_estimate_id: string
          labor_task_id: string | null
          modifier_multiplier: number | null
          modifiers: Json | null
          notes: string | null
          quantity: number
          sort_order: number | null
          task_name: string
          unit: string
        }
        Insert: {
          base_rate?: number
          created_at?: string
          extended?: number | null
          final_rate?: number | null
          id?: string
          labor_estimate_id: string
          labor_task_id?: string | null
          modifier_multiplier?: number | null
          modifiers?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number | null
          task_name: string
          unit?: string
        }
        Update: {
          base_rate?: number
          created_at?: string
          extended?: number | null
          final_rate?: number | null
          id?: string
          labor_estimate_id?: string
          labor_task_id?: string | null
          modifier_multiplier?: number | null
          modifiers?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number | null
          task_name?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_line_items_labor_estimate_id_fkey"
            columns: ["labor_estimate_id"]
            isOneToOne: false
            referencedRelation: "labor_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_line_items_labor_task_id_fkey"
            columns: ["labor_task_id"]
            isOneToOne: false
            referencedRelation: "labor_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_tasks: {
        Row: {
          base_rate: number
          created_at: string
          created_by: string | null
          default_modifiers: Json | null
          id: string
          is_system: boolean | null
          max_rate: number | null
          min_rate: number | null
          name: string
          notes: string | null
          trade: string
          unit: string
        }
        Insert: {
          base_rate?: number
          created_at?: string
          created_by?: string | null
          default_modifiers?: Json | null
          id?: string
          is_system?: boolean | null
          max_rate?: number | null
          min_rate?: number | null
          name: string
          notes?: string | null
          trade: string
          unit?: string
        }
        Update: {
          base_rate?: number
          created_at?: string
          created_by?: string | null
          default_modifiers?: Json | null
          id?: string
          is_system?: boolean | null
          max_rate?: number | null
          min_rate?: number | null
          name?: string
          notes?: string | null
          trade?: string
          unit?: string
        }
        Relationships: []
      }
      plan_files: {
        Row: {
          file_path: string
          filename: string
          id: string
          notes: string | null
          project_id: string
          scale: string | null
          sheet_label: string | null
          sheet_title: string | null
          uploaded_at: string
        }
        Insert: {
          file_path: string
          filename: string
          id?: string
          notes?: string | null
          project_id: string
          scale?: string | null
          sheet_label?: string | null
          sheet_title?: string | null
          uploaded_at?: string
        }
        Update: {
          file_path?: string
          filename?: string
          id?: string
          notes?: string | null
          project_id?: string
          scale?: string | null
          sheet_label?: string | null
          sheet_title?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      price_book: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean | null
          item_name: string
          notes: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          item_name: string
          notes?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean | null
          item_name?: string
          notes?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          currency: string | null
          id: string
          labor_burden_percent: number | null
          markup_percent: number | null
          name: string
          region: string | null
          status: string | null
          tax_percent: number | null
          updated_at: string
          user_id: string
          waste_percent: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          labor_burden_percent?: number | null
          markup_percent?: number | null
          name: string
          region?: string | null
          status?: string | null
          tax_percent?: number | null
          updated_at?: string
          user_id: string
          waste_percent?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          labor_burden_percent?: number | null
          markup_percent?: number | null
          name?: string
          region?: string | null
          status?: string | null
          tax_percent?: number | null
          updated_at?: string
          user_id?: string
          waste_percent?: number | null
        }
        Relationships: []
      }
      rfis: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          notes: string | null
          project_id: string
          question: string
          resolved_at: string | null
          status: string | null
          trade: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          question: string
          resolved_at?: string | null
          status?: string | null
          trade?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          question?: string
          resolved_at?: string | null
          status?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_items: {
        Row: {
          adjusted_qty: number | null
          category: string
          created_at: string
          description: string
          draft: boolean | null
          extended_cost: number | null
          id: string
          notes: string | null
          package_size: number | null
          packages: number | null
          phase: string | null
          plan_file_id: string | null
          project_id: string
          quantity: number
          sort_order: number | null
          spec: string | null
          unit: string
          unit_cost: number | null
          vendor: string | null
          waste_percent: number | null
        }
        Insert: {
          adjusted_qty?: number | null
          category: string
          created_at?: string
          description: string
          draft?: boolean | null
          extended_cost?: number | null
          id?: string
          notes?: string | null
          package_size?: number | null
          packages?: number | null
          phase?: string | null
          plan_file_id?: string | null
          project_id: string
          quantity?: number
          sort_order?: number | null
          spec?: string | null
          unit?: string
          unit_cost?: number | null
          vendor?: string | null
          waste_percent?: number | null
        }
        Update: {
          adjusted_qty?: number | null
          category?: string
          created_at?: string
          description?: string
          draft?: boolean | null
          extended_cost?: number | null
          id?: string
          notes?: string | null
          package_size?: number | null
          packages?: number | null
          phase?: string | null
          plan_file_id?: string | null
          project_id?: string
          quantity?: number
          sort_order?: number | null
          spec?: string | null
          unit?: string
          unit_cost?: number | null
          vendor?: string | null
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_items_plan_file_id_fkey"
            columns: ["plan_file_id"]
            isOneToOne: false
            referencedRelation: "plan_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          sort_order: number | null
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          sort_order?: number | null
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          sort_order?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          type?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wizard_runs: {
        Row: {
          answers: Json | null
          created_at: string
          id: string
          project_id: string
          project_type: string
          status: string | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          id?: string
          project_id: string
          project_type: string
          status?: string | null
        }
        Update: {
          answers?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          project_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wizard_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "estimator"
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
      app_role: ["owner", "estimator"],
    },
  },
} as const
