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
      action_log: {
        Row: {
          actions_json: Json
          command_text: string
          created_at: string
          error: string | null
          id: string
          project_id: string | null
          source: string
          status: string
          undo_data: Json | null
          undoable: boolean
          user_id: string
        }
        Insert: {
          actions_json?: Json
          command_text: string
          created_at?: string
          error?: string | null
          id?: string
          project_id?: string | null
          source: string
          status?: string
          undo_data?: Json | null
          undoable?: boolean
          user_id?: string
        }
        Update: {
          actions_json?: Json
          command_text?: string
          created_at?: string
          error?: string | null
          id?: string
          project_id?: string | null
          source?: string
          status?: string
          undo_data?: Json | null
          undoable?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          id: string
          key: string
          source: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
          value: Json
        }
        Insert: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          source?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
          value: Json
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          source?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
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
      blueprint_measurements: {
        Row: {
          coordinates_json: Json
          created_at: string
          id: string
          label: string | null
          measurement_type: string
          page_number: number | null
          plan_file_id: string
          project_id: string
          scale: number | null
          takeoff_item_id: string | null
          trade: string | null
          unit: string
          value: number | null
        }
        Insert: {
          coordinates_json: Json
          created_at?: string
          id?: string
          label?: string | null
          measurement_type: string
          page_number?: number | null
          plan_file_id: string
          project_id: string
          scale?: number | null
          takeoff_item_id?: string | null
          trade?: string | null
          unit?: string
          value?: number | null
        }
        Update: {
          coordinates_json?: Json
          created_at?: string
          id?: string
          label?: string | null
          measurement_type?: string
          page_number?: number | null
          plan_file_id?: string
          project_id?: string
          scale?: number | null
          takeoff_item_id?: string | null
          trade?: string | null
          unit?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_measurements_plan_file_id_fkey"
            columns: ["plan_file_id"]
            isOneToOne: false
            referencedRelation: "plan_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_measurements_takeoff_item_id_fkey"
            columns: ["takeoff_item_id"]
            isOneToOne: false
            referencedRelation: "takeoff_items"
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
      global_knowledge: {
        Row: {
          avg_value: number | null
          category: string | null
          confidence: number | null
          created_at: string
          id: string
          key: string
          knowledge_type: string
          last_updated_by_project: string | null
          max_value: number | null
          min_value: number | null
          project_type: string | null
          region: string | null
          sample_count: number
          std_dev: number | null
          trade: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          avg_value?: number | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          knowledge_type: string
          last_updated_by_project?: string | null
          max_value?: number | null
          min_value?: number | null
          project_type?: string | null
          region?: string | null
          sample_count?: number
          std_dev?: number | null
          trade?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          avg_value?: number | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          knowledge_type?: string
          last_updated_by_project?: string | null
          max_value?: number | null
          min_value?: number | null
          project_type?: string | null
          region?: string | null
          sample_count?: number
          std_dev?: number | null
          trade?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      price_cache: {
        Row: {
          expires_at: string
          id: string
          in_stock: boolean | null
          item_name: string
          location: string | null
          price: number | null
          product_url: string | null
          scraped_at: string
          search_term: string
          store: string
          unit: string | null
        }
        Insert: {
          expires_at?: string
          id?: string
          in_stock?: boolean | null
          item_name: string
          location?: string | null
          price?: number | null
          product_url?: string | null
          scraped_at?: string
          search_term: string
          store: string
          unit?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          in_stock?: boolean | null
          item_name?: string
          location?: string | null
          price?: number | null
          product_url?: string | null
          scraped_at?: string
          search_term?: string
          store?: string
          unit?: string | null
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
      project_actuals: {
        Row: {
          actual_amount: number | null
          actual_qty: number | null
          actual_unit: string | null
          category: string
          created_at: string
          description: string | null
          estimated_amount: number
          estimated_qty: number
          estimated_unit: string
          id: string
          labor_line_item_id: string | null
          notes: string | null
          paid_date: string | null
          paid_to: string | null
          project_id: string
          takeoff_item_id: string | null
          updated_at: string
          variance_amount: number | null
          variance_percent: number | null
          vendor: string | null
        }
        Insert: {
          actual_amount?: number | null
          actual_qty?: number | null
          actual_unit?: string | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_amount?: number
          estimated_qty?: number
          estimated_unit?: string
          id?: string
          labor_line_item_id?: string | null
          notes?: string | null
          paid_date?: string | null
          paid_to?: string | null
          project_id: string
          takeoff_item_id?: string | null
          updated_at?: string
          variance_amount?: number | null
          variance_percent?: number | null
          vendor?: string | null
        }
        Update: {
          actual_amount?: number | null
          actual_qty?: number | null
          actual_unit?: string | null
          category?: string
          created_at?: string
          description?: string | null
          estimated_amount?: number
          estimated_qty?: number
          estimated_unit?: string
          id?: string
          labor_line_item_id?: string | null
          notes?: string | null
          paid_date?: string | null
          paid_to?: string | null
          project_id?: string
          takeoff_item_id?: string | null
          updated_at?: string
          variance_amount?: number | null
          variance_percent?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_actuals_labor_line_item_id_fkey"
            columns: ["labor_line_item_id"]
            isOneToOne: false
            referencedRelation: "labor_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_actuals_takeoff_item_id_fkey"
            columns: ["takeoff_item_id"]
            isOneToOne: false
            referencedRelation: "takeoff_items"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reviews: {
        Row: {
          completed_at: string | null
          contribute_to_global: boolean | null
          created_at: string
          id: string
          labor_variances: Json | null
          learned_productivities: Json | null
          learned_rates: Json | null
          on_budget: boolean | null
          on_time: boolean | null
          overall_accuracy_rating: number | null
          pricing_variances: Json | null
          project_id: string
          recommendations: string | null
          scope_changes: Json | null
          status: string | null
          updated_at: string
          user_id: string
          what_didnt_work: string | null
          what_worked: string | null
        }
        Insert: {
          completed_at?: string | null
          contribute_to_global?: boolean | null
          created_at?: string
          id?: string
          labor_variances?: Json | null
          learned_productivities?: Json | null
          learned_rates?: Json | null
          on_budget?: boolean | null
          on_time?: boolean | null
          overall_accuracy_rating?: number | null
          pricing_variances?: Json | null
          project_id: string
          recommendations?: string | null
          scope_changes?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Update: {
          completed_at?: string | null
          contribute_to_global?: boolean | null
          created_at?: string
          id?: string
          labor_variances?: Json | null
          learned_productivities?: Json | null
          learned_rates?: Json | null
          on_budget?: boolean | null
          on_time?: boolean | null
          overall_accuracy_rating?: number | null
          pricing_variances?: Json | null
          project_id?: string
          recommendations?: string | null
          scope_changes?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          zip_code: string | null
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
          zip_code?: string | null
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
          zip_code?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          file_path: string
          file_type: string | null
          filename: string
          id: string
          line_items: Json | null
          linked_actual_id: string | null
          notes: string | null
          ocr_confidence: number | null
          ocr_raw_text: string | null
          ocr_status: string | null
          project_id: string
          receipt_date: string | null
          receipt_number: string | null
          subtotal: number | null
          tags: string[] | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_type?: string | null
          filename: string
          id?: string
          line_items?: Json | null
          linked_actual_id?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          ocr_status?: string | null
          project_id: string
          receipt_date?: string | null
          receipt_number?: string | null
          subtotal?: number | null
          tags?: string[] | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_type?: string | null
          filename?: string
          id?: string
          line_items?: Json | null
          linked_actual_id?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          ocr_status?: string | null
          project_id?: string
          receipt_date?: string | null
          receipt_number?: string | null
          subtotal?: number | null
          tags?: string[] | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_linked_actual_id_fkey"
            columns: ["linked_actual_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      owns_plan_file_path: { Args: { file_path: string }; Returns: boolean }
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
