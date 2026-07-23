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
      contact_conversation_reads: {
        Row: {
          conversation_key: string
          created_at: string
          id: string
          last_read_at: string | null
          marked_unread_at: string | null
          platform: string
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_key: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          marked_unread_at?: string | null
          platform: string
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_key?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          marked_unread_at?: string | null
          platform?: string
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_conversation_reads_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          email_normalized: string
          id: string
          is_primary: boolean
          label: string | null
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          contact_id: string
          created_at?: string
          email: string
          email_normalized: string
          id?: string
          is_primary?: boolean
          label?: string | null
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          email_normalized?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_emails_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_guest_auth_attempts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          ip_hash: string
          success: boolean
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          ip_hash: string
          success?: boolean
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          ip_hash?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_guest_auth_attempts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_guest_login_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          contact_id: string
          created_at: string
          expires_at: string
          id: string
          restaurant_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          contact_id: string
          created_at?: string
          expires_at: string
          id?: string
          restaurant_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          contact_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_guest_login_codes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_guest_login_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_guest_sessions: {
        Row: {
          contact_id: string
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          restaurant_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          restaurant_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          restaurant_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_guest_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_guest_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lexoffice_links: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          lexoffice_contact_id: string
          lexoffice_version: number | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          lexoffice_contact_id: string
          lexoffice_version?: number | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          lexoffice_contact_id?: string
          lexoffice_version?: number | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lexoffice_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lexoffice_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_message_attachments: {
        Row: {
          byte_size: number | null
          created_at: string
          file_name: string
          id: string
          kind: string
          message_id: string
          mime_type: string
          restaurant_id: string
          storage_path: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          file_name: string
          id?: string
          kind: string
          message_id: string
          mime_type: string
          restaurant_id: string
          storage_path: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          message_id?: string
          mime_type?: string
          restaurant_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_message_attachments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          delivery_status: string
          direction: string
          external_source_id: string | null
          id: string
          platform: string
          reservation_id: string | null
          restaurant_id: string
          send_batch_id: string | null
          sent_by: string | null
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          delivery_status?: string
          direction: string
          external_source_id?: string | null
          id?: string
          platform: string
          reservation_id?: string | null
          restaurant_id: string
          send_batch_id?: string | null
          sent_by?: string | null
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          external_source_id?: string | null
          id?: string
          platform?: string
          reservation_id?: string | null
          restaurant_id?: string
          send_batch_id?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          country_iso2: string | null
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          phone_display: string
          phone_normalized: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          contact_id: string
          country_iso2?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_display: string
          phone_normalized: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          contact_id?: string
          country_iso2?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          phone_display?: string
          phone_normalized?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_phones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_street: string | null
          company: string | null
          created_at: string
          first_name: string
          guest_pin: string
          guest_pin_hash: string | null
          id: string
          last_interaction_at: string | null
          last_name: string
          notes: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          company?: string | null
          created_at?: string
          first_name?: string
          guest_pin: string
          guest_pin_hash?: string | null
          id?: string
          last_interaction_at?: string | null
          last_name?: string
          notes?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          company?: string | null
          created_at?: string
          first_name?: string
          guest_pin?: string
          guest_pin_hash?: string | null
          id?: string
          last_interaction_at?: string | null
          last_name?: string
          notes?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          active: boolean
          dial_code: string
          flag_emoji: string
          iso2: string
          name_de: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          dial_code: string
          flag_emoji?: string
          iso2: string
          name_de: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          dial_code?: string
          flag_emoji?: string
          iso2?: string
          name_de?: string
          sort_order?: number
        }
        Relationships: []
      }
      dining_areas: {
        Row: {
          color_hex: string
          created_at: string
          display_number: number
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_hex?: string
          created_at?: string
          display_number: number
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          display_number?: number
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_areas_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_tables: {
        Row: {
          area_id: string
          capacity: number
          color_hex: string
          created_at: string
          floor: string | null
          id: string
          is_active: boolean
          plan_h_pct: number
          plan_w_pct: number
          plan_x_pct: number
          plan_y_pct: number
          restaurant_id: string
          sort_order: number
          table_name: string | null
          table_number: number
          updated_at: string
        }
        Insert: {
          area_id: string
          capacity?: number
          color_hex?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          plan_h_pct?: number
          plan_w_pct?: number
          plan_x_pct?: number
          plan_y_pct?: number
          restaurant_id: string
          sort_order?: number
          table_name?: string | null
          table_number: number
          updated_at?: string
        }
        Update: {
          area_id?: string
          capacity?: number
          color_hex?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          plan_h_pct?: number
          plan_w_pct?: number
          plan_x_pct?: number
          plan_y_pct?: number
          restaurant_id?: string
          sort_order?: number
          table_name?: string | null
          table_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "dining_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      gwada_review_invitations: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          link_sent_at: string | null
          link_sent_by: string | null
          link_sent_channels: string[] | null
          reservation_id: string | null
          restaurant_id: string
          token: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          link_sent_at?: string | null
          link_sent_by?: string | null
          link_sent_channels?: string[] | null
          reservation_id?: string | null
          restaurant_id: string
          token: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          link_sent_at?: string | null
          link_sent_by?: string | null
          link_sent_channels?: string[] | null
          reservation_id?: string | null
          restaurant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwada_review_invitations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwada_review_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      gwada_reviews: {
        Row: {
          comment: string | null
          created_at: string
          guest_display_name: string | null
          id: string
          invitation_id: string
          rating: number
          reservation_id: string | null
          restaurant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guest_display_name?: string | null
          id?: string
          invitation_id: string
          rating: number
          reservation_id?: string | null
          restaurant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guest_display_name?: string | null
          id?: string
          invitation_id?: string
          rating?: number
          reservation_id?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gwada_reviews_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "gwada_review_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwada_reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwada_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_brands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredient_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ingredient_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredients: {
        Row: {
          brand_id: string
          category_id: string
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          production_site_id: string
          purchase_unit_price: number | null
          restaurant_id: string
          supplier_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          category_id: string
          created_at?: string
          current_stock?: number
          id: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          production_site_id: string
          purchase_unit_price?: number | null
          restaurant_id: string
          supplier_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category_id?: string
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          production_site_id?: string
          purchase_unit_price?: number | null
          restaurant_id?: string
          supplier_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ingredients_fk_brand"
            columns: ["restaurant_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "inventory_brands"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredients_fk_category"
            columns: ["restaurant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredient_categories"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredients_fk_site"
            columns: ["restaurant_id", "production_site_id"]
            isOneToOne: false
            referencedRelation: "inventory_production_sites"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredients_fk_supplier"
            columns: ["restaurant_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredients_fk_unit"
            columns: ["restaurant_id", "unit"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_production_sites: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_production_sites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_order_lines: {
        Row: {
          brand_label: string | null
          delivered_at: string | null
          id: string
          ingredient_id: string
          ingredient_name: string
          order_id: string
          quantity: number
          restaurant_id: string
          unit_id: string
          unit_label: string
        }
        Insert: {
          brand_label?: string | null
          delivered_at?: string | null
          id: string
          ingredient_id: string
          ingredient_name: string
          order_id: string
          quantity: number
          restaurant_id: string
          unit_id: string
          unit_label: string
        }
        Update: {
          brand_label?: string | null
          delivered_at?: string | null
          id?: string
          ingredient_id?: string
          ingredient_name?: string
          order_id?: string
          quantity?: number
          restaurant_id?: string
          unit_id?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_pol_fk_order"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_orders"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_order_log_entries: {
        Row: {
          entry: Json
          id: string
          order_id: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          entry: Json
          id?: string
          order_id: string
          restaurant_id: string
          sort_order: number
        }
        Update: {
          entry?: Json
          id?: string
          order_id?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_polog_fk_order"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_orders"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_orders: {
        Row: {
          created_at: string
          created_by: string
          created_by_user_source: string | null
          delivery_date: string | null
          id: string
          restaurant_id: string
          status: string
          supplier_id: string
          supplier_name: string
        }
        Insert: {
          created_at: string
          created_by?: string
          created_by_user_source?: string | null
          delivery_date?: string | null
          id: string
          restaurant_id: string
          status: string
          supplier_id: string
          supplier_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_user_source?: string | null
          delivery_date?: string | null
          id?: string
          restaurant_id?: string
          status?: string
          supplier_id?: string
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_po_fk_supplier"
            columns: ["restaurant_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_purchase_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredient_price_entries: {
        Row: {
          created_at: string
          effective_at: string
          id: string
          ingredient_id: string
          purchase_order_id: string | null
          purchase_order_line_id: string | null
          restaurant_id: string
          source: string
          supplier_id: string | null
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          effective_at?: string
          id?: string
          ingredient_id: string
          purchase_order_id?: string | null
          purchase_order_line_id?: string | null
          restaurant_id: string
          source?: string
          supplier_id?: string | null
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          effective_at?: string
          id?: string
          ingredient_id?: string
          purchase_order_id?: string | null
          purchase_order_line_id?: string | null
          restaurant_id?: string
          source?: string
          supplier_id?: string | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ipe_fk_ingredient"
            columns: ["restaurant_id", "ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ipe_fk_supplier"
            columns: ["restaurant_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "inventory_ingredient_price_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_log_entries: {
        Row: {
          entry: Json
          id: string
          ingredient_id: string
          restaurant_id: string
          seq: number
        }
        Insert: {
          entry: Json
          id?: string
          ingredient_id: string
          restaurant_id: string
          seq: number
        }
        Update: {
          entry?: Json
          id?: string
          ingredient_id?: string
          restaurant_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_log_fk_ingredient"
            columns: ["restaurant_id", "ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_ingredients"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      inventory_suppliers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_allergens: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_allergens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_allergens: {
        Row: {
          allergen_id: string
          menu_item_id: string
        }
        Insert: {
          allergen_id: string
          menu_item_id: string
        }
        Update: {
          allergen_id?: string
          menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_allergens_allergen_id_fkey"
            columns: ["allergen_id"]
            isOneToOne: false
            referencedRelation: "menu_allergens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_allergens_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_recipe_lines: {
        Row: {
          amount: number
          id: string
          ingredient_id: string
          menu_item_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          id?: string
          ingredient_id: string
          menu_item_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_recipe_lines_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_tags: {
        Row: {
          menu_item_id: string
          tag_id: string
        }
        Insert: {
          menu_item_id: string
          tag_id: string
        }
        Update: {
          menu_item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_tags_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "menu_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available_from: string | null
          available_to: string | null
          category_id: string
          created_at: string
          description: string
          id: string
          image_url: string
          is_active: boolean
          list_number: number | null
          name: string
          price: number
          restaurant_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          category_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          list_number?: number | null
          name: string
          price?: number
          restaurant_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_active?: boolean
          list_number?: number | null
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_tags: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_integration_pending: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payload: Json
          provider: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          payload: Json
          provider: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          provider?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_integration_pending_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          closed: boolean
          closes_at: string | null
          created_at: string
          exception_date: string | null
          id: string
          kind: string
          note: string | null
          opens_at: string | null
          restaurant_id: string
          schedule_role: string
          updated_at: string
          weekday: string | null
        }
        Insert: {
          closed?: boolean
          closes_at?: string | null
          created_at?: string
          exception_date?: string | null
          id?: string
          kind: string
          note?: string | null
          opens_at?: string | null
          restaurant_id: string
          schedule_role?: string
          updated_at?: string
          weekday?: string | null
        }
        Update: {
          closed?: boolean
          closes_at?: string | null
          created_at?: string
          exception_date?: string | null
          id?: string
          kind?: string
          note?: string | null
          opens_at?: string | null
          restaurant_id?: string
          schedule_role?: string
          updated_at?: string
          weekday?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_app_settings: {
        Row: {
          app_name: string
          created_at: string
          favicon_path: string | null
          id: string
          logo_dark_path: string | null
          logo_path: string | null
          sidebar_module_order: Json | null
          updated_at: string
        }
        Insert: {
          app_name?: string
          created_at?: string
          favicon_path?: string | null
          id: string
          logo_dark_path?: string | null
          logo_path?: string | null
          sidebar_module_order?: Json | null
          updated_at?: string
        }
        Update: {
          app_name?: string
          created_at?: string
          favicon_path?: string | null
          id?: string
          logo_dark_path?: string | null
          logo_path?: string | null
          sidebar_module_order?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_changelog_entries: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string
          source_git_sha: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          source_git_sha?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          source_git_sha?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      platform_integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_superadmins: {
        Row: {
          created_at: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_superadmins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_fiscal_transactions: {
        Row: {
          client_id: string
          created_at: string
          custom_receipt_url: string | null
          fiskaly_receipt_id: string | null
          id: string
          is_retroactive: boolean
          order_id: string
          receipt_public_url: string | null
          restaurant_id: string
          signature: string
          signature_counter: number
          signed_at: string | null
          split_group: string | null
          state: string
          tss_id: string
          tx_id: string
          tx_revision: number
        }
        Insert: {
          client_id: string
          created_at?: string
          custom_receipt_url?: string | null
          fiskaly_receipt_id?: string | null
          id?: string
          is_retroactive?: boolean
          order_id: string
          receipt_public_url?: string | null
          restaurant_id: string
          signature: string
          signature_counter: number
          signed_at?: string | null
          split_group?: string | null
          state: string
          tss_id: string
          tx_id: string
          tx_revision?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          custom_receipt_url?: string | null
          fiskaly_receipt_id?: string | null
          id?: string
          is_retroactive?: boolean
          order_id?: string
          receipt_public_url?: string | null
          restaurant_id?: string
          signature?: string
          signature_counter?: number
          signed_at?: string | null
          split_group?: string | null
          state?: string
          tss_id?: string
          tx_id?: string
          tx_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_fiscal_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_fiscal_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_counters: {
        Row: {
          last_number: number
          restaurant_id: string
        }
        Insert: {
          last_number?: number
          restaurant_id: string
        }
        Update: {
          last_number?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_counters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_lines: {
        Row: {
          created_at: string
          id: string
          line_total_cents: number
          menu_item_id: string | null
          metadata: Json
          name: string
          notes: string | null
          order_id: string
          paid_quantity: number
          position: number
          quantity: number
          unit_price_cents: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_cents?: number
          menu_item_id?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          order_id: string
          paid_quantity?: number
          position?: number
          quantity?: number
          unit_price_cents?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_cents?: number
          menu_item_id?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          order_id?: string
          paid_quantity?: number
          position?: number
          quantity?: number
          unit_price_cents?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_lines_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by_profile_id: string | null
          currency: string
          discount_cents: number
          fiskaly_failed_at: string | null
          id: string
          notes: string | null
          order_number: number
          receipt_url: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["pos_order_status"]
          subtotal_cents: number
          table_session_id: string
          tip_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          currency?: string
          discount_cents?: number
          fiskaly_failed_at?: string | null
          id?: string
          notes?: string | null
          order_number: number
          receipt_url?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["pos_order_status"]
          subtotal_cents?: number
          table_session_id: string
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          currency?: string
          discount_cents?: number
          fiskaly_failed_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          receipt_url?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["pos_order_status"]
          subtotal_cents?: number
          table_session_id?: string
          tip_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "pos_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payment_line_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          order_line_id: string
          payment_id: string
          quantity: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          order_line_id: string
          payment_id: string
          quantity: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          order_line_id?: string
          payment_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_payment_line_allocations_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "pos_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_line_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pos_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["pos_payment_method"]
          mollie_payment_id: string | null
          order_id: string
          paid_at: string | null
          received_amount_cents: number | null
          refunded_at: string | null
          restaurant_id: string
          split_group: string | null
          status: Database["public"]["Enums"]["pos_payment_status"]
          tip_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method: Database["public"]["Enums"]["pos_payment_method"]
          mollie_payment_id?: string | null
          order_id: string
          paid_at?: string | null
          received_amount_cents?: number | null
          refunded_at?: string | null
          restaurant_id: string
          split_group?: string | null
          status?: Database["public"]["Enums"]["pos_payment_status"]
          tip_cents?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["pos_payment_method"]
          mollie_payment_id?: string | null
          order_id?: string
          paid_at?: string | null
          received_amount_cents?: number | null
          refunded_at?: string | null
          restaurant_id?: string
          split_group?: string | null
          status?: Database["public"]["Enums"]["pos_payment_status"]
          tip_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_register_sessions: {
        Row: {
          cash_difference_cents: number | null
          cash_point_closing_id: string | null
          closed_at: string | null
          closed_by_profile_id: string | null
          closing_cash_cents: number | null
          created_at: string
          dsfinvk_business_date: string | null
          dsfinvk_export_id: string | null
          dsfinvk_export_storage_path: string | null
          expected_cash_cents: number | null
          id: string
          opened_at: string
          opened_by_profile_id: string | null
          opening_cash_cents: number
          restaurant_id: string
          updated_at: string
          z_nr: number | null
        }
        Insert: {
          cash_difference_cents?: number | null
          cash_point_closing_id?: string | null
          closed_at?: string | null
          closed_by_profile_id?: string | null
          closing_cash_cents?: number | null
          created_at?: string
          dsfinvk_business_date?: string | null
          dsfinvk_export_id?: string | null
          dsfinvk_export_storage_path?: string | null
          expected_cash_cents?: number | null
          id?: string
          opened_at?: string
          opened_by_profile_id?: string | null
          opening_cash_cents?: number
          restaurant_id: string
          updated_at?: string
          z_nr?: number | null
        }
        Update: {
          cash_difference_cents?: number | null
          cash_point_closing_id?: string | null
          closed_at?: string | null
          closed_by_profile_id?: string | null
          closing_cash_cents?: number | null
          created_at?: string
          dsfinvk_business_date?: string | null
          dsfinvk_export_id?: string | null
          dsfinvk_export_storage_path?: string | null
          expected_cash_cents?: number | null
          id?: string
          opened_at?: string
          opened_by_profile_id?: string | null
          opening_cash_cents?: number
          restaurant_id?: string
          updated_at?: string
          z_nr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_register_sessions_closed_by_profile_id_fkey"
            columns: ["closed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_register_sessions_opened_by_profile_id_fkey"
            columns: ["opened_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_register_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_restaurant_fiscal_config: {
        Row: {
          cash_point_closing_counter: number
          created_at: string
          current_register_session_id: string | null
          dsfinvk_cash_register_ready: boolean
          fiskaly_client_id: string | null
          fiskaly_client_serial: string | null
          fiskaly_enabled: boolean
          fiskaly_provision_error: string | null
          fiskaly_provision_status: string | null
          fiskaly_provisioned_at: string | null
          fiskaly_tss_id: string | null
          last_cash_point_closing_id: string | null
          last_closing_at: string | null
          last_closing_z_nr: number | null
          register_opened_at: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          cash_point_closing_counter?: number
          created_at?: string
          current_register_session_id?: string | null
          dsfinvk_cash_register_ready?: boolean
          fiskaly_client_id?: string | null
          fiskaly_client_serial?: string | null
          fiskaly_enabled?: boolean
          fiskaly_provision_error?: string | null
          fiskaly_provision_status?: string | null
          fiskaly_provisioned_at?: string | null
          fiskaly_tss_id?: string | null
          last_cash_point_closing_id?: string | null
          last_closing_at?: string | null
          last_closing_z_nr?: number | null
          register_opened_at?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          cash_point_closing_counter?: number
          created_at?: string
          current_register_session_id?: string | null
          dsfinvk_cash_register_ready?: boolean
          fiskaly_client_id?: string | null
          fiskaly_client_serial?: string | null
          fiskaly_enabled?: boolean
          fiskaly_provision_error?: string | null
          fiskaly_provision_status?: string | null
          fiskaly_provisioned_at?: string | null
          fiskaly_tss_id?: string | null
          last_cash_point_closing_id?: string | null
          last_closing_at?: string | null
          last_closing_z_nr?: number | null
          register_opened_at?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_restaurant_fiscal_config_current_register_session_id_fkey"
            columns: ["current_register_session_id"]
            isOneToOne: false
            referencedRelation: "pos_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_restaurant_fiscal_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_table_sessions: {
        Row: {
          closed_at: string | null
          cover_count: number
          created_at: string
          dining_table_id: string
          id: string
          is_fully_paid: boolean
          opened_at: string
          opened_by_profile_id: string | null
          reservation_id: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["pos_table_session_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          cover_count?: number
          created_at?: string
          dining_table_id: string
          id?: string
          is_fully_paid?: boolean
          opened_at?: string
          opened_by_profile_id?: string | null
          reservation_id?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["pos_table_session_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          cover_count?: number
          created_at?: string
          dining_table_id?: string
          id?: string
          is_fully_paid?: boolean
          opened_at?: string
          opened_by_profile_id?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["pos_table_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_table_sessions_dining_table_id_fkey"
            columns: ["dining_table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_table_sessions_opened_by_profile_id_fkey"
            columns: ["opened_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_table_sessions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_restaurant_id: string | null
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postal_code: string | null
          avatar_storage_path: string | null
          birth_date: string | null
          cover_storage_path: string | null
          created_at: string
          display_name: string | null
          family_name: string | null
          given_name: string | null
          id: string
          last_seen_at: string | null
          locale: string | null
          nickname: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_restaurant_id?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postal_code?: string | null
          avatar_storage_path?: string | null
          birth_date?: string | null
          cover_storage_path?: string | null
          created_at?: string
          display_name?: string | null
          family_name?: string | null
          given_name?: string | null
          id: string
          last_seen_at?: string | null
          locale?: string | null
          nickname?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_restaurant_id?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postal_code?: string | null
          avatar_storage_path?: string | null
          birth_date?: string | null
          cover_storage_path?: string | null
          created_at?: string
          display_name?: string | null
          family_name?: string | null
          given_name?: string | null
          id?: string
          last_seen_at?: string | null
          locale?: string | null
          nickname?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_restaurant_id_fkey"
            columns: ["active_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_email_outbox: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          last_error: string | null
          message_kind: string
          reservation_id: string
          restaurant_id: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_kind: string
          reservation_id: string
          restaurant_id: string
          send_at: string
          sent_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_kind?: string
          reservation_id?: string
          restaurant_id?: string
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_email_outbox_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_email_outbox_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_statuses: {
        Row: {
          code: string
          color_hex: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          color_hex: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          color_hex?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      reservation_whatsapp_outbox: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          last_error: string | null
          message_kind: string
          reservation_id: string
          restaurant_id: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_kind: string
          reservation_id: string
          restaurant_id: string
          send_at: string
          sent_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_kind?: string
          reservation_id?: string
          restaurant_id?: string
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_whatsapp_outbox_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_whatsapp_outbox_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by_profile_id: string | null
          dining_table_id: string | null
          dwell_minutes: number | null
          ends_at: string
          guest_email: string | null
          guest_first_name: string
          guest_last_name: string
          guest_name: string | null
          guest_phone: string | null
          guest_pin: string
          guest_pin_hash: string | null
          guest_profile_id: string | null
          id: string
          is_walk_in: boolean
          notes: string | null
          notify_email: boolean
          notify_whatsapp: boolean
          party_size: number
          pending_change: Json | null
          reservation_number: number
          restaurant_id: string
          starts_at: string
          status_before_change_id: string | null
          status_id: string
          terms_accepted: boolean
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          dining_table_id?: string | null
          dwell_minutes?: number | null
          ends_at: string
          guest_email?: string | null
          guest_first_name: string
          guest_last_name: string
          guest_name?: string | null
          guest_phone?: string | null
          guest_pin: string
          guest_pin_hash?: string | null
          guest_profile_id?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          party_size?: number
          pending_change?: Json | null
          reservation_number: number
          restaurant_id: string
          starts_at: string
          status_before_change_id?: string | null
          status_id: string
          terms_accepted?: boolean
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          dining_table_id?: string | null
          dwell_minutes?: number | null
          ends_at?: string
          guest_email?: string | null
          guest_first_name?: string
          guest_last_name?: string
          guest_name?: string | null
          guest_phone?: string | null
          guest_pin?: string
          guest_pin_hash?: string | null
          guest_profile_id?: string | null
          id?: string
          is_walk_in?: boolean
          notes?: string | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          party_size?: number
          pending_change?: Json | null
          reservation_number?: number
          restaurant_id?: string
          starts_at?: string
          status_before_change_id?: string | null
          status_id?: string
          terms_accepted?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_dining_table_id_fkey"
            columns: ["dining_table_id"]
            isOneToOne: false
            referencedRelation: "dining_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_profile_id_fkey"
            columns: ["guest_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_status_before_change_id_fkey"
            columns: ["status_before_change_id"]
            isOneToOne: false
            referencedRelation: "reservation_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "reservation_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_contact_settings: {
        Row: {
          auto_create_from_messages: boolean
          auto_create_from_reservations: boolean
          auto_create_from_reviews: boolean
          auto_link_enabled: boolean
          guest_chat_code_valid_hours: number
          guest_chat_session_hours: number
          guest_chat_url_template: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          auto_create_from_messages?: boolean
          auto_create_from_reservations?: boolean
          auto_create_from_reviews?: boolean
          auto_link_enabled?: boolean
          guest_chat_code_valid_hours?: number
          guest_chat_session_hours?: number
          guest_chat_url_template?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          auto_create_from_messages?: boolean
          auto_create_from_reservations?: boolean
          auto_create_from_reviews?: boolean
          auto_link_enabled?: boolean
          guest_chat_code_valid_hours?: number
          guest_chat_session_hours?: number
          guest_chat_url_template?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_contact_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_display_installations: {
        Row: {
          created_at: string
          device_secret_hash: string
          display_id: string
          id: string
          installation_id: string
          last_seen_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_secret_hash: string
          display_id: string
          id?: string
          installation_id: string
          last_seen_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_secret_hash?: string
          display_id?: string
          id?: string
          installation_id?: string
          last_seen_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_display_installations_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "restaurant_displays"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_display_pairing_codes: {
        Row: {
          code: string
          created_at: string
          display_id: string
          expires_at: string
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          display_id: string
          expires_at: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_id?: string
          expires_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_display_pairing_codes_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "restaurant_displays"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_display_sessions: {
        Row: {
          display_id: string
          ended_at: string | null
          id: string
          last_activity_at: string
          restaurant_id: string
          session_token_hash: string
          staff_id: string
          started_at: string
        }
        Insert: {
          display_id: string
          ended_at?: string | null
          id?: string
          last_activity_at?: string
          restaurant_id: string
          session_token_hash: string
          staff_id: string
          started_at?: string
        }
        Update: {
          display_id?: string
          ended_at?: string | null
          id?: string
          last_activity_at?: string
          restaurant_id?: string
          session_token_hash?: string
          staff_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_display_sessions_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "restaurant_displays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_display_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_display_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_displays: {
        Row: {
          allowed_modules: Database["public"]["Enums"]["display_module"][]
          auto_lock_seconds: number
          created_at: string
          device_secret_hash: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          allowed_modules?: Database["public"]["Enums"]["display_module"][]
          auto_lock_seconds?: number
          created_at?: string
          device_secret_hash?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          allowed_modules?: Database["public"]["Enums"]["display_module"][]
          auto_lock_seconds?: number
          created_at?: string
          device_secret_hash?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_displays_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_document_log_entries: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          document_id: string | null
          document_title: string
          employee_id: string | null
          file_name: string | null
          id: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          document_id?: string | null
          document_title: string
          employee_id?: string | null
          file_name?: string | null
          id?: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          document_id?: string | null
          document_title?: string
          employee_id?: string | null
          file_name?: string | null
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_document_log_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "restaurant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_document_log_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "restaurant_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_document_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_document_note_entries: {
        Row: {
          actor_user_id: string | null
          body: string
          created_at: string
          document_id: string
          employee_id: string | null
          id: string
          restaurant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          created_at?: string
          document_id: string
          employee_id?: string | null
          id?: string
          restaurant_id: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          created_at?: string
          document_id?: string
          employee_id?: string | null
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_document_note_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "restaurant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_document_note_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "restaurant_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_document_note_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_document_tags: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_document_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_documents: {
        Row: {
          created_at: string
          employee_id: string | null
          file_name: string
          id: string
          mime_type: string
          restaurant_id: string
          size_bytes: number
          storage_path: string
          tag_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          file_name: string
          id?: string
          mime_type: string
          restaurant_id: string
          size_bytes: number
          storage_path: string
          tag_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          restaurant_id?: string
          size_bytes?: number
          storage_path?: string
          tag_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "restaurant_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_documents_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "restaurant_document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_employees: {
        Row: {
          created_at: string
          hired_at: string | null
          id: string
          is_active: boolean
          position_id: string | null
          profile_id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["employee_role"]
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hired_at?: string | null
          id?: string
          is_active?: boolean
          position_id?: string | null
          profile_id: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["employee_role"]
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hired_at?: string | null
          id?: string
          is_active?: boolean
          position_id?: string | null
          profile_id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["employee_role"]
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "restaurant_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_employees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_inbox_signals: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_inbox_signals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_integrations: {
        Row: {
          config: Json
          connected_at: string | null
          created_at: string
          display_name: string | null
          integration_key: string
          last_error: string | null
          phone_number: string | null
          restaurant_id: string
          status: string
          updated_at: string
          waha_session_name: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          integration_key: string
          last_error?: string | null
          phone_number?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
          waha_session_name: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          integration_key?: string
          last_error?: string | null
          phone_number?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          waha_session_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_settings: {
        Row: {
          currency_code: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          currency_code?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          currency_code?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_position_permissions: {
        Row: {
          permission_key: string
          position_id: string
        }
        Insert: {
          permission_key: string
          position_id: string
        }
        Update: {
          permission_key?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_position_permissions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "restaurant_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_positions: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_positions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reservation_counters: {
        Row: {
          next_number: number
          restaurant_id: string
        }
        Insert: {
          next_number?: number
          restaurant_id: string
        }
        Update: {
          next_number?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reservation_counters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reservation_settings: {
        Row: {
          booking_lead_time_hours: number
          booking_time_step_minutes: number
          default_dwell_minutes: number
          email_cancelled_enabled: boolean
          email_cancelled_subject: string | null
          email_cancelled_template: string | null
          email_confirmed_enabled: boolean
          email_confirmed_subject: string | null
          email_confirmed_template: string | null
          email_declined_enabled: boolean
          email_declined_subject: string | null
          email_declined_template: string | null
          email_no_show_enabled: boolean
          email_no_show_subject: string | null
          email_no_show_template: string | null
          email_received_enabled: boolean
          email_received_subject: string | null
          email_received_template: string | null
          email_reminder_enabled: boolean
          email_reminder_hours_before: number
          email_reminder_subject: string | null
          email_reminder_template: string | null
          email_review_include_facebook: boolean
          email_review_include_google: boolean
          email_review_include_gwada: boolean
          email_sender_name: string | null
          email_thanks_enabled: boolean
          email_thanks_hours_after: number
          email_thanks_subject: string | null
          email_thanks_template: string | null
          embed_form_footer_text: string | null
          guest_manage_url_template: string | null
          min_minutes_before_closing: number
          restaurant_id: string
          review_facebook_url: string | null
          review_google_url: string | null
          review_request_enabled: boolean
          review_request_include_facebook: boolean
          review_request_include_google: boolean
          review_request_include_gwada: boolean
          updated_at: string
          whatsapp_cancelled_enabled: boolean
          whatsapp_cancelled_template: string | null
          whatsapp_confirmed_enabled: boolean
          whatsapp_confirmed_template: string | null
          whatsapp_declined_enabled: boolean
          whatsapp_declined_template: string | null
          whatsapp_no_show_enabled: boolean
          whatsapp_no_show_template: string | null
          whatsapp_received_enabled: boolean
          whatsapp_received_template: string | null
          whatsapp_reminder_enabled: boolean
          whatsapp_reminder_hours_before: number
          whatsapp_reminder_template: string | null
          whatsapp_review_include_facebook: boolean
          whatsapp_review_include_google: boolean
          whatsapp_review_include_gwada: boolean
          whatsapp_thanks_enabled: boolean
          whatsapp_thanks_hours_after: number
          whatsapp_thanks_template: string | null
          walk_in_enabled: boolean
        }
        Insert: {
          booking_lead_time_hours?: number
          booking_time_step_minutes?: number
          default_dwell_minutes?: number
          email_cancelled_enabled?: boolean
          email_cancelled_subject?: string | null
          email_cancelled_template?: string | null
          email_confirmed_enabled?: boolean
          email_confirmed_subject?: string | null
          email_confirmed_template?: string | null
          email_declined_enabled?: boolean
          email_declined_subject?: string | null
          email_declined_template?: string | null
          email_no_show_enabled?: boolean
          email_no_show_subject?: string | null
          email_no_show_template?: string | null
          email_received_enabled?: boolean
          email_received_subject?: string | null
          email_received_template?: string | null
          email_reminder_enabled?: boolean
          email_reminder_hours_before?: number
          email_reminder_subject?: string | null
          email_reminder_template?: string | null
          email_review_include_facebook?: boolean
          email_review_include_google?: boolean
          email_review_include_gwada?: boolean
          email_sender_name?: string | null
          email_thanks_enabled?: boolean
          email_thanks_hours_after?: number
          email_thanks_subject?: string | null
          email_thanks_template?: string | null
          embed_form_footer_text?: string | null
          guest_manage_url_template?: string | null
          min_minutes_before_closing?: number
          restaurant_id: string
          review_facebook_url?: string | null
          review_google_url?: string | null
          review_request_enabled?: boolean
          review_request_include_facebook?: boolean
          review_request_include_google?: boolean
          review_request_include_gwada?: boolean
          updated_at?: string
          whatsapp_cancelled_enabled?: boolean
          whatsapp_cancelled_template?: string | null
          whatsapp_confirmed_enabled?: boolean
          whatsapp_confirmed_template?: string | null
          whatsapp_declined_enabled?: boolean
          whatsapp_declined_template?: string | null
          whatsapp_no_show_enabled?: boolean
          whatsapp_no_show_template?: string | null
          whatsapp_received_enabled?: boolean
          whatsapp_received_template?: string | null
          whatsapp_reminder_enabled?: boolean
          whatsapp_reminder_hours_before?: number
          whatsapp_reminder_template?: string | null
          whatsapp_review_include_facebook?: boolean
          whatsapp_review_include_google?: boolean
          whatsapp_review_include_gwada?: boolean
          whatsapp_thanks_enabled?: boolean
          whatsapp_thanks_hours_after?: number
          whatsapp_thanks_template?: string | null
          walk_in_enabled?: boolean
        }
        Update: {
          booking_lead_time_hours?: number
          booking_time_step_minutes?: number
          default_dwell_minutes?: number
          email_cancelled_enabled?: boolean
          email_cancelled_subject?: string | null
          email_cancelled_template?: string | null
          email_confirmed_enabled?: boolean
          email_confirmed_subject?: string | null
          email_confirmed_template?: string | null
          email_declined_enabled?: boolean
          email_declined_subject?: string | null
          email_declined_template?: string | null
          email_no_show_enabled?: boolean
          email_no_show_subject?: string | null
          email_no_show_template?: string | null
          email_received_enabled?: boolean
          email_received_subject?: string | null
          email_received_template?: string | null
          email_reminder_enabled?: boolean
          email_reminder_hours_before?: number
          email_reminder_subject?: string | null
          email_reminder_template?: string | null
          email_review_include_facebook?: boolean
          email_review_include_google?: boolean
          email_review_include_gwada?: boolean
          email_sender_name?: string | null
          email_thanks_enabled?: boolean
          email_thanks_hours_after?: number
          email_thanks_subject?: string | null
          email_thanks_template?: string | null
          embed_form_footer_text?: string | null
          guest_manage_url_template?: string | null
          min_minutes_before_closing?: number
          restaurant_id?: string
          review_facebook_url?: string | null
          review_google_url?: string | null
          review_request_enabled?: boolean
          review_request_include_facebook?: boolean
          review_request_include_google?: boolean
          review_request_include_gwada?: boolean
          updated_at?: string
          whatsapp_cancelled_enabled?: boolean
          whatsapp_cancelled_template?: string | null
          whatsapp_confirmed_enabled?: boolean
          whatsapp_confirmed_template?: string | null
          whatsapp_declined_enabled?: boolean
          whatsapp_declined_template?: string | null
          whatsapp_no_show_enabled?: boolean
          whatsapp_no_show_template?: string | null
          whatsapp_received_enabled?: boolean
          whatsapp_received_template?: string | null
          whatsapp_reminder_enabled?: boolean
          whatsapp_reminder_hours_before?: number
          whatsapp_reminder_template?: string | null
          whatsapp_review_include_facebook?: boolean
          whatsapp_review_include_google?: boolean
          whatsapp_review_include_gwada?: boolean
          whatsapp_thanks_enabled?: boolean
          whatsapp_thanks_hours_after?: number
          whatsapp_thanks_template?: string | null
          walk_in_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reservation_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_review_reads: {
        Row: {
          created_at: string
          id: string
          marked_unread_at: string | null
          platform: string
          read_at: string | null
          restaurant_id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_unread_at?: string | null
          platform: string
          read_at?: string | null
          restaurant_id: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_unread_at?: string | null
          platform?: string
          read_at?: string | null
          restaurant_id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_review_reads_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_shift_schedule_settings: {
        Row: {
          created_at: string
          requires_acceptance: boolean
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          requires_acceptance?: boolean
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          requires_acceptance?: boolean
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_shift_schedule_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_shift_templates: {
        Row: {
          color: string
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_shift_templates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_storage_path: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          display_pin_hash: string | null
          display_pin_set_at: string | null
          email: string | null
          employee_id: string | null
          family_name: string
          given_name: string
          id: string
          is_active: boolean
          nationality: string | null
          phone: string | null
          position_tag_id: string | null
          postal_code: string | null
          profile_id: string | null
          restaurant_id: string
          restaurant_position_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_storage_path?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_pin_hash?: string | null
          display_pin_set_at?: string | null
          email?: string | null
          employee_id?: string | null
          family_name: string
          given_name: string
          id?: string
          is_active?: boolean
          nationality?: string | null
          phone?: string | null
          position_tag_id?: string | null
          postal_code?: string | null
          profile_id?: string | null
          restaurant_id: string
          restaurant_position_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_storage_path?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_pin_hash?: string | null
          display_pin_set_at?: string | null
          email?: string | null
          employee_id?: string | null
          family_name?: string
          given_name?: string
          id?: string
          is_active?: boolean
          nationality?: string | null
          phone?: string | null
          position_tag_id?: string | null
          postal_code?: string | null
          profile_id?: string | null
          restaurant_id?: string
          restaurant_position_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "restaurant_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_position_tag_id_fkey"
            columns: ["position_tag_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff_position_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_position_id_fkey"
            columns: ["restaurant_position_id"]
            isOneToOne: false
            referencedRelation: "restaurant_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_contract_log_entries: {
        Row: {
          action: string
          actor_user_id: string | null
          contract_id: string
          created_at: string
          details: Json
          id: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          contract_id: string
          created_at?: string
          details?: Json
          id?: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          contract_id?: string
          created_at?: string
          details?: Json
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_contract_log_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_contract_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_contracts: {
        Row: {
          created_at: string
          currency: string
          employment_type:
            | Database["public"]["Enums"]["staff_employment_type"]
            | null
          fixed_salary_cents: number | null
          hourly_rate_cents: number | null
          id: string
          note: string | null
          pay_type: Database["public"]["Enums"]["staff_contract_pay_type"]
          restaurant_id: string
          staff_id: string
          target_weekly_minutes: number | null
          updated_at: string
          vacation_days_per_year: number | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          employment_type?:
            | Database["public"]["Enums"]["staff_employment_type"]
            | null
          fixed_salary_cents?: number | null
          hourly_rate_cents?: number | null
          id?: string
          note?: string | null
          pay_type: Database["public"]["Enums"]["staff_contract_pay_type"]
          restaurant_id: string
          staff_id: string
          target_weekly_minutes?: number | null
          updated_at?: string
          vacation_days_per_year?: number | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          employment_type?:
            | Database["public"]["Enums"]["staff_employment_type"]
            | null
          fixed_salary_cents?: number | null
          hourly_rate_cents?: number | null
          id?: string
          note?: string | null
          pay_type?: Database["public"]["Enums"]["staff_contract_pay_type"]
          restaurant_id?: string
          staff_id?: string
          target_weekly_minutes?: number | null
          updated_at?: string
          vacation_days_per_year?: number | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_contracts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_contracts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          channel: Database["public"]["Enums"]["staff_invite_channel"]
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          invite_token: string | null
          restaurant_id: string
          restaurant_position_id: string
          staff_id: string
          status: Database["public"]["Enums"]["staff_invite_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel: Database["public"]["Enums"]["staff_invite_channel"]
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          invite_token?: string | null
          restaurant_id: string
          restaurant_position_id: string
          staff_id: string
          status?: Database["public"]["Enums"]["staff_invite_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel?: Database["public"]["Enums"]["staff_invite_channel"]
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invite_token?: string | null
          restaurant_id?: string
          restaurant_position_id?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["staff_invite_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_invites_restaurant_position_id_fkey"
            columns: ["restaurant_position_id"]
            isOneToOne: false
            referencedRelation: "restaurant_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_log_entries: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          restaurant_id: string
          staff_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          restaurant_id: string
          staff_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          restaurant_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_log_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_position_tags: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_position_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_availability_slots: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          note: string | null
          restaurant_id: string
          service_date: string | null
          staff_id: string
          start_time: string
          updated_at: string
          weekday: Database["public"]["Enums"]["staff_availability_weekday"] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          note?: string | null
          restaurant_id: string
          service_date?: string | null
          staff_id: string
          start_time: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["staff_availability_weekday"] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          note?: string | null
          restaurant_id?: string
          service_date?: string | null
          staff_id?: string
          start_time?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["staff_availability_weekday"] | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_availability_slots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_availability_slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_scheduled_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          label: string | null
          note: string | null
          position_tag_id: string | null
          responded_at: string | null
          restaurant_id: string
          series_id: string | null
          staff_id: string
          starts_at: string
          status: Database["public"]["Enums"]["staff_scheduled_shift_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          label?: string | null
          note?: string | null
          position_tag_id?: string | null
          responded_at?: string | null
          restaurant_id: string
          series_id?: string | null
          staff_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["staff_scheduled_shift_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          label?: string | null
          note?: string | null
          position_tag_id?: string | null
          responded_at?: string | null
          restaurant_id?: string
          series_id?: string | null
          staff_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["staff_scheduled_shift_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_scheduled_shifts_position_tag_id_fkey"
            columns: ["position_tag_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff_position_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_scheduled_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_scheduled_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_scheduled_shifts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "restaurant_shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_wage_advances: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_on: string
          restaurant_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on: string
          restaurant_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_on?: string
          restaurant_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_wage_advances_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_wage_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_work_entries: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          entry_type: Database["public"]["Enums"]["staff_work_entry_type"]
          id: string
          is_open: boolean
          note: string | null
          restaurant_id: string
          shift_id: string | null
          staff_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          entry_type?: Database["public"]["Enums"]["staff_work_entry_type"]
          id?: string
          is_open?: boolean
          note?: string | null
          restaurant_id: string
          shift_id?: string | null
          staff_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          entry_type?: Database["public"]["Enums"]["staff_work_entry_type"]
          id?: string
          is_open?: boolean
          note?: string | null
          restaurant_id?: string
          shift_id?: string | null
          staff_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_work_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_work_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff_work_entry_log_entries: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          restaurant_id: string
          work_entry_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          restaurant_id: string
          work_entry_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          restaurant_id?: string
          work_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_work_entry_log_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_work_entry_log_entries_work_entry_id_fkey"
            columns: ["work_entry_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff_work_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_storage_path: string | null
          brand_accent_hex: string | null
          city: string | null
          country: string | null
          cover_storage_path: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_published: boolean
          name: string
          owner_profile_id: string | null
          phone: string | null
          postal_code: string | null
          receipt_footer: string | null
          slug: string
          social_handle: string | null
          timezone: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_storage_path?: string | null
          brand_accent_hex?: string | null
          city?: string | null
          country?: string | null
          cover_storage_path?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          name: string
          owner_profile_id?: string | null
          phone?: string | null
          postal_code?: string | null
          receipt_footer?: string | null
          slug: string
          social_handle?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_storage_path?: string | null
          brand_accent_hex?: string | null
          city?: string | null
          country?: string | null
          cover_storage_path?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_published?: boolean
          name?: string
          owner_profile_id?: string | null
          phone?: string | null
          postal_code?: string | null
          receipt_footer?: string | null
          slug?: string
          social_handle?: string | null
          timezone?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_restaurant_dashboard_widgets: {
        Row: {
          created_at: string
          profile_id: string
          restaurant_id: string
          shortcut_order: string[]
          shortcut_visibility: Json
          updated_at: string
          widget_order: string[]
          widget_visibility: Json
        }
        Insert: {
          created_at?: string
          profile_id: string
          restaurant_id: string
          shortcut_order?: string[]
          shortcut_visibility?: Json
          updated_at?: string
          widget_order: string[]
          widget_visibility?: Json
        }
        Update: {
          created_at?: string
          profile_id?: string
          restaurant_id?: string
          shortcut_order?: string[]
          shortcut_visibility?: Json
          updated_at?: string
          widget_order?: string[]
          widget_visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_restaurant_dashboard_widgets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_restaurant_dashboard_widgets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invite: {
        Args: {
          p_family_name?: string
          p_given_name?: string
          p_profile_id?: string
          p_token: string
        }
        Returns: Json
      }
      sync_own_profile_names: {
        Args: { p_family_name: string; p_given_name: string }
        Returns: Json
      }
      auth_has_restaurant_permission: {
        Args: { p_permission: string; p_restaurant_id: string }
        Returns: boolean
      }
      auth_is_restaurant_staff: {
        Args: {
          p_restaurant_id: string
          p_roles?: Database["public"]["Enums"]["employee_role"][]
        }
        Returns: boolean
      }
      auth_is_superadmin: { Args: never; Returns: boolean }
      auth_user_restaurant_permission_keys: {
        Args: { p_restaurant_id: string }
        Returns: string[]
      }
      clear_restaurant_staff_display_pin: {
        Args: { p_staff_id: string }
        Returns: undefined
      }
      explain_staff_invite_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      inventory_replace_ingredients: {
        Args: { p_ingredients: Json; p_restaurant_id: string }
        Returns: undefined
      }
      inventory_replace_purchase_orders: {
        Args: { p_orders: Json; p_restaurant_id: string }
        Returns: undefined
      }
      normalize_contact_email: { Args: { p_email: string }; Returns: string }
      normalize_contact_phone: { Args: { p_phone: string }; Returns: string }
      platform_integrations_superadmin_list: {
        Args: never
        Returns: {
          config: Json
          enabled: boolean
          key: string
          updated_at: string
        }[]
      }
      platform_messaging_flags: {
        Args: never
        Returns: {
          email_enabled: boolean
          facebook_enabled: boolean
          google_business_enabled: boolean
          instagram_enabled: boolean
          lexoffice_enabled: boolean
          whatsapp_enabled: boolean
        }[]
      }
      pos_restaurant_today_bounds: {
        Args: { p_restaurant_id: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      resolve_restaurant_staff_by_display_pin: {
        Args: { p_pin: string; p_restaurant_id: string }
        Returns: string
      }
      resolve_staff_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          invite_id: string
          position_name: string
          restaurant_id: string
          restaurant_name: string
          staff_email: string
          staff_family_name: string
          staff_given_name: string
          staff_id: string
        }[]
      }
      restaurant_documents_quota_bytes: { Args: never; Returns: number }
      restaurant_documents_used_bytes: {
        Args: { p_restaurant_id: string }
        Returns: number
      }
      restaurant_email_integration_ui: {
        Args: { p_restaurant_id: string }
        Returns: {
          config: Json
          integration_key: string
          last_error: string
          restaurant_id: string
          status: string
          updated_at: string
        }[]
      }
      restaurant_lexoffice_integration_ui: {
        Args: { p_restaurant_id: string }
        Returns: {
          config: Json
          connected_at: string
          display_name: string
          integration_key: string
          last_error: string
          restaurant_id: string
          status: string
          updated_at: string
        }[]
      }
      restaurant_slug_available: {
        Args: { p_exclude_restaurant_id?: string; p_slug: string }
        Returns: boolean
      }
      restaurant_timezone_from_address: {
        Args: {
          p_city: string
          p_country: string
          p_postal: string
          p_street: string
        }
        Returns: string
      }
      seed_restaurant_default_positions: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      set_restaurant_staff_display_pin: {
        Args: { p_pin: string; p_staff_id: string }
        Returns: boolean
      }
      staff_display_permission_keys: {
        Args: { p_staff_id: string }
        Returns: string[]
      }
      storage_restaurant_id_from_object_path: {
        Args: { object_name: string }
        Returns: string
      }
      superadmin_list_restaurants: {
        Args: never
        Returns: {
          brand_accent_hex: string
          created_at: string
          email: string
          employee_count: number
          id: string
          is_published: boolean
          name: string
          owner_display_name: string
          owner_email: string
          phone: string
          slug: string
          timezone: string
        }[]
      }
      superadmin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          family_name: string
          given_name: string
          is_online: boolean
          last_seen_at: string
          last_sign_in_at: string
          locale: string
          phone: string
          profile_id: string
          restaurant_count: number
        }[]
      }
      touch_profile_last_seen: { Args: never; Returns: undefined }
      verify_contact_guest_pin: {
        Args: { p_contact_id: string; p_pin: string }
        Returns: string
      }
      verify_reservation_guest_pin: {
        Args: {
          p_pin: string
          p_reservation_number: number
          p_restaurant_id: string
        }
        Returns: string
      }
      verify_restaurant_staff_display_pin: {
        Args: { p_pin: string; p_restaurant_id: string; p_staff_id: string }
        Returns: boolean
      }
    }
    Enums: {
      display_module: "time" | "reservations" | "recipes" | "kds" | "inventory"
      employee_role:
        | "owner"
        | "manager"
        | "host"
        | "server"
        | "kitchen"
        | "other"
      order_status:
        | "draft"
        | "open"
        | "in_kitchen"
        | "ready"
        | "served"
        | "paid"
        | "cancelled"
      pos_order_status:
        | "pending_payment"
        | "received"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
      pos_payment_method: "cash" | "card" | "paypal" | "terminal"
      pos_payment_status: "open" | "paid" | "failed" | "refunded"
      pos_table_session_status: "open" | "closed"
      staff_contract_pay_type: "hourly" | "fixed" | "fixed_weekly"
      staff_employment_type:
        | "full_time"
        | "part_time"
        | "mini_job"
        | "fixed_term"
        | "internship"
        | "student"
        | "other"
      staff_invite_channel: "email" | "whatsapp"
      staff_invite_status: "pending" | "accepted" | "expired" | "revoked"
      staff_availability_weekday:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      staff_scheduled_shift_status: "confirmed" | "pending" | "declined"
      staff_work_entry_type: "work" | "break" | "vacation" | "sick" | "other"
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
      display_module: ["time", "reservations", "recipes", "kds", "inventory"],
      employee_role: ["owner", "manager", "host", "server", "kitchen", "other"],
      order_status: [
        "draft",
        "open",
        "in_kitchen",
        "ready",
        "served",
        "paid",
        "cancelled",
      ],
      pos_order_status: [
        "pending_payment",
        "received",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ],
      pos_payment_method: ["cash", "card", "paypal", "terminal"],
      pos_payment_status: ["open", "paid", "failed", "refunded"],
      pos_table_session_status: ["open", "closed"],
      staff_contract_pay_type: ["hourly", "fixed", "fixed_weekly"],
      staff_employment_type: [
        "full_time",
        "part_time",
        "mini_job",
        "fixed_term",
        "internship",
        "student",
        "other",
      ],
      staff_invite_channel: ["email", "whatsapp"],
      staff_invite_status: ["pending", "accepted", "expired", "revoked"],
      staff_availability_weekday: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      staff_scheduled_shift_status: ["confirmed", "pending", "declined"],
      staff_work_entry_type: ["work", "break", "vacation", "sick", "other"],
    },
  },
} as const

