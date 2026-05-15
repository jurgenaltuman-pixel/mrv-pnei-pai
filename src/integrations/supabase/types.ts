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
      base_personas: {
        Row: {
          created_at: string
          distrito: string | null
          documento: string
          documento_madre: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          nombre_madre: string | null
          region_sanitaria: string | null
          servicio_salud: string | null
          sexo: string | null
          tipo_documento: string
        }
        Insert: {
          created_at?: string
          distrito?: string | null
          documento: string
          documento_madre?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          nombre_madre?: string | null
          region_sanitaria?: string | null
          servicio_salud?: string | null
          sexo?: string | null
          tipo_documento?: string
        }
        Update: {
          created_at?: string
          distrito?: string | null
          documento?: string
          documento_madre?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          nombre_madre?: string | null
          region_sanitaria?: string | null
          servicio_salud?: string | null
          sexo?: string | null
          tipo_documento?: string
        }
        Relationships: []
      }
      barrios: {
        Row: {
          created_at: string
          distrito_id: number
          id: number
          nombre: string
        }
        Insert: {
          created_at?: string
          distrito_id: number
          id?: number
          nombre: string
        }
        Update: {
          created_at?: string
          distrito_id?: number
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "barrios_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "distritos"
            referencedColumns: ["id"]
          },
        ]
      }
      distritos: {
        Row: {
          created_at: string
          id: number
          nombre: string
          region_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          nombre: string
          region_id: number
        }
        Update: {
          created_at?: string
          id?: number
          nombre?: string
          region_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "distritos_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regiones_sanitarias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_barrio: string | null
          assigned_distrito: string | null
          assigned_region: string | null
          assigned_servicio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          must_change_password: boolean
          approved_at: string | null
          approved_by: string | null
          scope_locked: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          assigned_barrio?: string | null
          assigned_distrito?: string | null
          assigned_region?: string | null
          assigned_servicio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          must_change_password?: boolean
          approved_at?: string | null
          approved_by?: string | null
          scope_locked?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          assigned_barrio?: string | null
          assigned_distrito?: string | null
          assigned_region?: string | null
          assigned_servicio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          must_change_password?: boolean
          approved_at?: string | null
          approved_by?: string | null
          scope_locked?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      regiones_sanitarias: {
        Row: {
          codigo: string | null
          created_at: string
          id: number
          nombre: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          id?: number
          nombre: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      registros_vacunacion: {
        Row: {
          barrio: string | null
          created_at: string
          distrito: string
          documento: string
          edad: string | null
          estado_vacuna: string
          fecha_hora: string
          fecha_nacimiento: string
          id: string
          latitud: number | null
          libreta: boolean
          longitud: number | null
          motivo: string | null
          nombre: string
          region: string
          responsable: string | null
          servicio: string | null
          sexo: string
          tipo_vivienda: string | null
          user_id: string
        }
        Insert: {
          barrio?: string | null
          created_at?: string
          distrito: string
          documento: string
          edad?: string | null
          estado_vacuna: string
          fecha_hora?: string
          fecha_nacimiento: string
          id?: string
          latitud?: number | null
          libreta?: boolean
          longitud?: number | null
          motivo?: string | null
          nombre: string
          region: string
          responsable?: string | null
          servicio?: string | null
          sexo: string
          tipo_vivienda?: string | null
          user_id: string
        }
        Update: {
          barrio?: string | null
          created_at?: string
          distrito?: string
          documento?: string
          edad?: string | null
          estado_vacuna?: string
          fecha_hora?: string
          fecha_nacimiento?: string
          id?: string
          latitud?: number | null
          libreta?: boolean
          longitud?: number | null
          motivo?: string | null
          nombre?: string
          region?: string
          responsable?: string | null
          servicio?: string | null
          sexo?: string
          tipo_vivienda?: string | null
          user_id?: string
        }
        Relationships: []
      }
      servicios_salud: {
        Row: {
          created_at: string
          distrito_id: number
          id: number
          nombre: string
        }
        Insert: {
          created_at?: string
          distrito_id: number
          id?: number
          nombre: string
        }
        Update: {
          created_at?: string
          distrito_id?: number
          id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_salud_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "distritos"
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
      resolve_email_by_username: {
        Args: { p_username: string }
        Returns: string
      },
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "moderator" | "user"
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
      app_role: ["super_admin", "admin", "moderator", "user"],
    },
  },
} as const
