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
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_title: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_title: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_title?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          exact_amount: number | null
          id: string
          matched_payment_id: string | null
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          proof_submitted_at: string | null
          public_code: string | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string
          verification_attempted_at: string | null
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          exact_amount?: number | null
          id?: string
          matched_payment_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          proof_submitted_at?: string | null
          public_code?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at?: string
          user_id: string
          verification_attempted_at?: string | null
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          exact_amount?: number | null
          id?: string
          matched_payment_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          proof_submitted_at?: string | null
          public_code?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string
          verification_attempted_at?: string | null
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          whatsapp?: string | null
        }
        Relationships: []
      }
      product_keys: {
        Row: {
          content: string
          created_at: string
          delivered_at: string | null
          delivered_to_user_id: string | null
          id: string
          key_type: Database["public"]["Enums"]["key_type"]
          notes: string | null
          product_id: string
          reserved_for_order_id: string | null
          status: Database["public"]["Enums"]["key_status"]
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered_at?: string | null
          delivered_to_user_id?: string | null
          id?: string
          key_type?: Database["public"]["Enums"]["key_type"]
          notes?: string | null
          product_id: string
          reserved_for_order_id?: string | null
          status?: Database["public"]["Enums"]["key_status"]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered_at?: string | null
          delivered_to_user_id?: string | null
          id?: string
          key_type?: Database["public"]["Enums"]["key_type"]
          notes?: string | null
          product_id?: string
          reserved_for_order_id?: string | null
          status?: Database["public"]["Enums"]["key_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_reserved_for_order_id_fkey"
            columns: ["reserved_for_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          discount_price: number | null
          featured: boolean
          gallery: string[] | null
          genre: string | null
          id: string
          is_active: boolean
          platform: Database["public"]["Enums"]["platform"]
          price: number
          publisher: string | null
          release_year: number | null
          reseller_price: number | null
          slug: string
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          featured?: boolean
          gallery?: string[] | null
          genre?: string | null
          id?: string
          is_active?: boolean
          platform?: Database["public"]["Enums"]["platform"]
          price: number
          publisher?: string | null
          release_year?: number | null
          reseller_price?: number | null
          slug: string
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          featured?: boolean
          gallery?: string[] | null
          genre?: string | null
          id?: string
          is_active?: boolean
          platform?: Database["public"]["Enums"]["platform"]
          price?: number
          publisher?: string | null
          release_year?: number | null
          reseller_price?: number | null
          slug?: string
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          whatsapp?: string | null
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
      reseller_codes: {
        Row: {
          id: string
          code: string
          used_by: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
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
      app_role: "admin" | "user"
      key_status: "available" | "reserved" | "delivered"
      key_type: "code" | "account" | "link"
      order_status: "pending" | "paid" | "shipped" | "delivered" | "cancelled"
      platform: "PS5" | "PS4" | "PS3" | "PS2" | "PS1" | "PSP" | "PSVITA"
      verification_status:
        | "not_submitted"
        | "awaiting_verification"
        | "verified"
        | "rejected"
        | "manual_review"
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
      app_role: ["admin", "user"],
      key_status: ["available", "reserved", "delivered"],
      key_type: ["code", "account", "link"],
      order_status: ["pending", "paid", "shipped", "delivered", "cancelled"],
      platform: ["PS5", "PS4", "PS3", "PS2", "PS1", "PSP", "PSVITA"],
      verification_status: [
        "not_submitted",
        "awaiting_verification",
        "verified",
        "rejected",
        "manual_review",
      ],
    },
  },
} as const
