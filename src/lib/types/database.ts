/**
 * Database type definitions for Supabase.
 * Maps directly to the PostgreSQL schema defined in the design document.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: 'admin' | 'customer';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string;
          email: string;
          role?: 'admin' | 'customer';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          role?: 'admin' | 'customer';
          created_at?: string;
          updated_at?: string;
        };
      };
      service_categories: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string;
          name: string;
          description: string;
          duration_minutes: number;
          price: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          category_id: string;
          name: string;
          description: string;
          duration_minutes: number;
          price: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category_id?: string;
          name?: string;
          description?: string;
          duration_minutes?: number;
          price?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      availability_schedules: {
        Row: {
          id: string;
          tenant_id: string;
          service_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          service_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          service_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          service_id: string;
          confirmation_id: string;
          start_time: string;
          end_time: string;
          price: number;
          status: 'confirmed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string;
          customer_id: string;
          service_id: string;
          confirmation_id?: string;
          start_time: string;
          end_time: string;
          price: number;
          status?: 'confirmed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          service_id?: string;
          confirmation_id?: string;
          start_time?: string;
          end_time?: string;
          price?: number;
          status?: 'confirmed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'admin' | 'customer';
      booking_status: 'confirmed' | 'cancelled';
      service_category: 'Recovery' | 'Treatments' | 'Coaching' | 'Events';
    };
  };
}
