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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          last_used_at: string | null
          organization_id: string
          scopes: string[] | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          last_used_at?: string | null
          organization_id: string
          scopes?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          last_used_at?: string | null
          organization_id?: string
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          created_by: string | null
          group_key: string
          id: string
          is_system_default: boolean
          organization_id: string
          setting_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_key: string
          id?: string
          is_system_default?: boolean
          organization_id: string
          setting_key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_key?: string
          id?: string
          is_system_default?: boolean
          organization_id?: string
          setting_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          reminder_type: string
          send_hours_before: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          reminder_type: string
          send_hours_before: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          reminder_type?: string
          send_hours_before?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          assigned_dentist_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_status: string
          created_at: string
          deleted_at: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          room_id: string | null
          service_id: string | null
          start_time: string
          status: string
          treatment_notes: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          assigned_dentist_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_status?: string
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          room_id?: string | null
          service_id?: string | null
          start_time: string
          status?: string
          treatment_notes?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          assigned_dentist_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_status?: string
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          room_id?: string | null
          service_id?: string | null
          start_time?: string
          status?: string
          treatment_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_assigned_dentist_id_fkey"
            columns: ["assigned_dentist_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "treatment_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_adjustments: {
        Row: {
          adjusted_value: string | null
          adjustment_type: string
          approved_by: string | null
          attendance_id: string | null
          created_at: string
          deleted_at: string | null
          employee_id: string
          id: string
          organization_id: string
          reason: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          adjusted_value?: string | null
          adjustment_type: string
          approved_by?: string | null
          attendance_id?: string | null
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          id?: string
          organization_id: string
          reason: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjusted_value?: string | null
          adjustment_type?: string
          approved_by?: string | null
          attendance_id?: string | null
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_adjustments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          approval_notes: string | null
          attendance_status: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          deleted_at: string | null
          device_check_in_time: string | null
          device_check_out_time: string | null
          early_leave_minutes: number | null
          employee_id: string
          id: string
          is_approved: boolean
          late_minutes: number | null
          organization_id: string
          overtime_minutes: number | null
          paid_break_minutes: number | null
          shift_id: string | null
          unpaid_break_minutes: number | null
          updated_at: string
          work_date: string
          worked_minutes: number | null
        }
        Insert: {
          approval_notes?: string | null
          attendance_status?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          deleted_at?: string | null
          device_check_in_time?: string | null
          device_check_out_time?: string | null
          early_leave_minutes?: number | null
          employee_id: string
          id?: string
          is_approved?: boolean
          late_minutes?: number | null
          organization_id: string
          overtime_minutes?: number | null
          paid_break_minutes?: number | null
          shift_id?: string | null
          unpaid_break_minutes?: number | null
          updated_at?: string
          work_date: string
          worked_minutes?: number | null
        }
        Update: {
          approval_notes?: string | null
          attendance_status?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          deleted_at?: string | null
          device_check_in_time?: string | null
          device_check_out_time?: string | null
          early_leave_minutes?: number | null
          employee_id?: string
          id?: string
          is_approved?: boolean
          late_minutes?: number | null
          organization_id?: string
          overtime_minutes?: number | null
          paid_break_minutes?: number | null
          shift_id?: string | null
          unpaid_break_minutes?: number | null
          updated_at?: string
          work_date?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_summaries: {
        Row: {
          absent_days: number
          created_at: string
          date: string
          early_leave_days: number
          employee_code: string
          employee_id: string
          full_name: string
          id: string
          late_days: number
          organization_id: string
          overtime_hours: number
          present_days: number
          total_days: number
        }
        Insert: {
          absent_days?: number
          created_at?: string
          date: string
          early_leave_days?: number
          employee_code: string
          employee_id: string
          full_name: string
          id?: string
          late_days?: number
          organization_id?: string
          overtime_hours?: number
          present_days?: number
          total_days?: number
        }
        Update: {
          absent_days?: number
          created_at?: string
          date?: string
          early_leave_days?: number
          employee_code?: string
          employee_id?: string
          full_name?: string
          id?: string
          late_days?: number
          organization_id?: string
          overtime_hours?: number
          present_days?: number
          total_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_summaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_summary: {
        Row: {
          absent_days: number
          computed_at: string
          early_leave_count: number
          employee_id: string
          holiday_days: number
          id: string
          late_count: number
          leave_days: number
          month: number
          organization_id: string
          present_days: number
          sick_days: number
          total_overtime_minutes: number
          total_worked_minutes: number
          total_working_days: number
          updated_at: string
          year: number
        }
        Insert: {
          absent_days?: number
          computed_at?: string
          early_leave_count?: number
          employee_id: string
          holiday_days?: number
          id?: string
          late_count?: number
          leave_days?: number
          month: number
          organization_id: string
          present_days?: number
          sick_days?: number
          total_overtime_minutes?: number
          total_worked_minutes?: number
          total_working_days?: number
          updated_at?: string
          year: number
        }
        Update: {
          absent_days?: number
          computed_at?: string
          early_leave_count?: number
          employee_id?: string
          holiday_days?: number
          id?: string
          late_count?: number
          leave_days?: number
          month?: number
          organization_id?: string
          present_days?: number
          sick_days?: number
          total_overtime_minutes?: number
          total_worked_minutes?: number
          total_working_days?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          organization_id: string
          previous_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          organization_id: string
          previous_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          organization_id?: string
          previous_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_profiles: {
        Row: {
          address: string | null
          appointment_phone: string | null
          attendance_policy: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          date_format: string
          description: string | null
          district: string | null
          email: string | null
          facebook: string | null
          favicon_url: string | null
          footer_info: string | null
          grace_period_minutes: number
          hotline: string | null
          id: string
          language: string
          legal_name: string | null
          logo_url: string | null
          lunch_break: string | null
          manager_name: string | null
          maps_url: string | null
          name: string
          organization_id: string
          overtime_policy: string | null
          phone: string | null
          reminder_policy: string | null
          representative_name: string | null
          short_name: string | null
          tax_code: string | null
          time_format: string
          timezone: string
          updated_at: string
          ward: string | null
          website: string | null
          weekly_days_off: string | null
          working_hours: string | null
          zalo: string | null
        }
        Insert: {
          address?: string | null
          appointment_phone?: string | null
          attendance_policy?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          date_format?: string
          description?: string | null
          district?: string | null
          email?: string | null
          facebook?: string | null
          favicon_url?: string | null
          footer_info?: string | null
          grace_period_minutes?: number
          hotline?: string | null
          id?: string
          language?: string
          legal_name?: string | null
          logo_url?: string | null
          lunch_break?: string | null
          manager_name?: string | null
          maps_url?: string | null
          name: string
          organization_id: string
          overtime_policy?: string | null
          phone?: string | null
          reminder_policy?: string | null
          representative_name?: string | null
          short_name?: string | null
          tax_code?: string | null
          time_format?: string
          timezone?: string
          updated_at?: string
          ward?: string | null
          website?: string | null
          weekly_days_off?: string | null
          working_hours?: string | null
          zalo?: string | null
        }
        Update: {
          address?: string | null
          appointment_phone?: string | null
          attendance_policy?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          date_format?: string
          description?: string | null
          district?: string | null
          email?: string | null
          facebook?: string | null
          favicon_url?: string | null
          footer_info?: string | null
          grace_period_minutes?: number
          hotline?: string | null
          id?: string
          language?: string
          legal_name?: string | null
          logo_url?: string | null
          lunch_break?: string | null
          manager_name?: string | null
          maps_url?: string | null
          name?: string
          organization_id?: string
          overtime_policy?: string | null
          phone?: string | null
          reminder_policy?: string | null
          representative_name?: string | null
          short_name?: string | null
          tax_code?: string | null
          time_format?: string
          timezone?: string
          updated_at?: string
          ward?: string | null
          website?: string | null
          weekly_days_off?: string | null
          working_hours?: string | null
          zalo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_configs: {
        Row: {
          auto_sync_enabled: boolean
          connection_method: string
          created_at: string
          device_ip_address: string | null
          device_password_encrypted: string | null
          device_port: number | null
          device_type: string
          device_username: string | null
          id: string
          is_connected: boolean
          last_sync_time: string | null
          last_test_time: string | null
          organization_id: string
          sync_interval_minutes: number
          test_result: string | null
          updated_at: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          connection_method?: string
          created_at?: string
          device_ip_address?: string | null
          device_password_encrypted?: string | null
          device_port?: number | null
          device_type?: string
          device_username?: string | null
          id?: string
          is_connected?: boolean
          last_sync_time?: string | null
          last_test_time?: string | null
          organization_id: string
          sync_interval_minutes?: number
          test_result?: string | null
          updated_at?: string
        }
        Update: {
          auto_sync_enabled?: boolean
          connection_method?: string
          created_at?: string
          device_ip_address?: string | null
          device_password_encrypted?: string | null
          device_port?: number | null
          device_type?: string
          device_username?: string | null
          id?: string
          is_connected?: boolean
          last_sync_time?: string | null
          last_test_time?: string | null
          organization_id?: string
          sync_interval_minutes?: number
          test_result?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_logs: {
        Row: {
          created_at: string
          device_id: string | null
          device_user_id: string | null
          event_time: string
          event_type: string
          id: string
          mask_detected: boolean | null
          organization_id: string
          process_note: string | null
          processed: boolean
          raw_data: Json
          temperature: number | null
          user_id: string | null
          verify_mode: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_user_id?: string | null
          event_time?: string
          event_type: string
          id?: string
          mask_detected?: boolean | null
          organization_id?: string
          process_note?: string | null
          processed?: boolean
          raw_data?: Json
          temperature?: number | null
          user_id?: string | null
          verify_mode?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_user_id?: string | null
          event_time?: string
          event_type?: string
          id?: string
          mask_detected?: boolean | null
          organization_id?: string
          process_note?: string | null
          processed?: boolean
          raw_data?: Json
          temperature?: number | null
          user_id?: string | null
          verify_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          organization_id: string
          records_failed: number
          records_found: number
          records_imported: number
          records_skipped: number
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          organization_id: string
          records_failed?: number
          records_found?: number
          records_imported?: number
          records_skipped?: number
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          organization_id?: string
          records_failed?: number
          records_found?: number
          records_imported?: number
          records_skipped?: number
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sync_mappings: {
        Row: {
          created_at: string
          device_user_id: string
          employee_id: string | null
          id: string
          is_active: boolean
          last_sync_time: string | null
          organization_id: string
          sync_error: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_user_id: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          last_sync_time?: string | null
          organization_id: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_user_id?: string
          employee_id?: string | null
          id?: string
          is_active?: boolean
          last_sync_time?: string | null
          organization_id?: string
          sync_error?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sync_mappings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_name: string
          device_type: string
          employee_count: number
          id: string
          ip_address: string | null
          is_active: boolean
          last_sync: string | null
          last_sync_time: string | null
          location: string | null
          organization_id: string
          serial_number: string
          status: string
          sync_count: number
          users_synced: number
        }
        Insert: {
          created_at?: string
          device_name: string
          device_type: string
          employee_count?: number
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_sync?: string | null
          last_sync_time?: string | null
          location?: string | null
          organization_id?: string
          serial_number: string
          status?: string
          sync_count?: number
          users_synced?: number
        }
        Update: {
          created_at?: string
          device_name?: string
          device_type?: string
          employee_count?: number
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_sync?: string | null
          last_sync_time?: string | null
          location?: string | null
          organization_id?: string
          serial_number?: string
          status?: string
          sync_count?: number
          users_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          appointment_display_name: string | null
          avatar_url: string | null
          can_receive_appointments: boolean
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          date_of_birth: string | null
          default_shift_id: string | null
          deleted_at: string | null
          department_id: string | null
          device_user_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_code: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender: string | null
          id: string
          internal_notes: string | null
          license_expiry_date: string | null
          license_issue_date: string | null
          license_number: string | null
          manager_id: string | null
          organization_id: string
          phone: string | null
          position_id: string | null
          preferred_name: string | null
          probation_end_date: string | null
          professional_title: string | null
          qualifications: string | null
          specialization: string | null
          start_date: string | null
          treatment_room: string | null
          updated_at: string
          user_id: string | null
          work_location: string | null
          years_of_experience: number | null
        }
        Insert: {
          address?: string | null
          appointment_display_name?: string | null
          avatar_url?: string | null
          can_receive_appointments?: boolean
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          default_shift_id?: string | null
          deleted_at?: string | null
          department_id?: string | null
          device_user_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          gender?: string | null
          id?: string
          internal_notes?: string | null
          license_expiry_date?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          manager_id?: string | null
          organization_id: string
          phone?: string | null
          position_id?: string | null
          preferred_name?: string | null
          probation_end_date?: string | null
          professional_title?: string | null
          qualifications?: string | null
          specialization?: string | null
          start_date?: string | null
          treatment_room?: string | null
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
          years_of_experience?: number | null
        }
        Update: {
          address?: string | null
          appointment_display_name?: string | null
          avatar_url?: string | null
          can_receive_appointments?: boolean
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          default_shift_id?: string | null
          deleted_at?: string | null
          department_id?: string | null
          device_user_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          gender?: string | null
          id?: string
          internal_notes?: string | null
          license_expiry_date?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          manager_id?: string | null
          organization_id?: string
          phone?: string | null
          position_id?: string | null
          preferred_name?: string | null
          probation_end_date?: string | null
          professional_title?: string | null
          qualifications?: string | null
          specialization?: string | null
          start_date?: string | null
          treatment_room?: string | null
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_default_shift_id_fkey"
            columns: ["default_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          organization_id: string
          priority: string
          status: string
          steps_to_reproduce: string | null
          title: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      export_logs: {
        Row: {
          created_at: string
          errors: number
          export_date_range: Json | null
          export_format: string
          export_type: string
          exported_by: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string | null
          id: string
          organization_id: string
          rows_exported: number
        }
        Insert: {
          created_at?: string
          errors?: number
          export_date_range?: Json | null
          export_format: string
          export_type: string
          exported_by?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          organization_id: string
          rows_exported?: number
        }
        Update: {
          created_at?: string
          errors?: number
          export_date_range?: Json | null
          export_format?: string
          export_type?: string
          exported_by?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          organization_id?: string
          rows_exported?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          created_at: string
          data_rows: number
          deleted_at: string | null
          file_format: string | null
          file_url: string | null
          filters_applied: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          organization_id: string
          report_config_id: string | null
          report_name: string
          report_type: string
        }
        Insert: {
          created_at?: string
          data_rows?: number
          deleted_at?: string | null
          file_format?: string | null
          file_url?: string | null
          filters_applied?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          organization_id: string
          report_config_id?: string | null
          report_name: string
          report_type: string
        }
        Update: {
          created_at?: string
          data_rows?: number
          deleted_at?: string | null
          file_format?: string | null
          file_url?: string | null
          filters_applied?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          organization_id?: string
          report_config_id?: string | null
          report_name?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_report_config_id_fkey"
            columns: ["report_config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          integration_name: string
          integration_type: string
          organization_id: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          integration_name: string
          integration_type: string
          organization_id: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          integration_name?: string
          integration_type?: string
          organization_id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_metrics: {
        Row: {
          created_at: string
          department_id: string | null
          employee_id: string | null
          id: string
          metric_date: string
          metric_type: string
          metric_value: number | null
          organization_id: string
          target_value: number | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          metric_date: string
          metric_type: string
          metric_value?: number | null
          organization_id: string
          target_value?: number | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          metric_date?: string
          metric_type?: string
          metric_value?: number | null
          organization_id?: string
          target_value?: number | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_metrics_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_metrics_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          subject: string | null
          template_name: string
          template_type: string
          trigger_event: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          subject?: string | null
          template_name: string
          template_type: string
          trigger_event: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          subject?: string | null
          template_name?: string
          template_type?: string
          trigger_event?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_text: string | null
          action_url: string | null
          created_at: string
          data: Json | null
          deleted_at: string | null
          id: string
          is_read: boolean
          message: string
          notification_type: string
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      overtime_records: {
        Row: {
          created_at: string
          duration_hours: number
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          overtime_date: string
          rate_multiplier: number
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          employee_id: string
          id?: string
          notes?: string | null
          organization_id?: string
          overtime_date: string
          rate_multiplier?: number
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          overtime_date?: string
          rate_multiplier?: number
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_visit_date: string | null
          full_name: string
          gender: string | null
          id: string
          insurance_number: string | null
          insurance_provider: string | null
          is_active: boolean
          last_visit_date: string | null
          medical_notes: string | null
          organization_id: string
          patient_code: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          full_name: string
          gender?: string | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          last_visit_date?: string | null
          medical_notes?: string | null
          organization_id: string
          patient_code: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          last_visit_date?: string | null
          medical_notes?: string | null
          organization_id?: string
          patient_code?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          absence_deduction: number
          absent_days: number
          approved_at: string | null
          base_salary: number
          created_at: string
          employee_id: string
          id: string
          insurance: number
          late_days: number
          late_deduction: number
          month: number
          net_salary: number
          organization_id: string
          status: string
          worked_days: number
          year: number
        }
        Insert: {
          absence_deduction?: number
          absent_days?: number
          approved_at?: string | null
          base_salary?: number
          created_at?: string
          employee_id: string
          id?: string
          insurance?: number
          late_days?: number
          late_deduction?: number
          month: number
          net_salary?: number
          organization_id?: string
          status?: string
          worked_days?: number
          year: number
        }
        Update: {
          absence_deduction?: number
          absent_days?: number
          approved_at?: string | null
          base_salary?: number
          created_at?: string
          employee_id?: string
          id?: string
          insurance?: number
          late_days?: number
          late_deduction?: number
          month?: number
          net_salary?: number
          organization_id?: string
          status?: string
          worked_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          can_receive_appointments: boolean
          created_at: string
          deleted_at: string | null
          department_id: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          can_receive_appointments?: boolean
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          can_receive_appointments?: boolean
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_configs: {
        Row: {
          columns: Json
          created_at: string
          deleted_at: string | null
          description: string | null
          email_recipients: string[] | null
          filter_settings: Json
          id: string
          is_active: boolean
          organization_id: string
          report_name: string
          report_type: string
          schedule_day_of_month: number | null
          schedule_day_of_week: number | null
          schedule_enabled: boolean
          schedule_frequency: string | null
          schedule_hour: number | null
          schedule_minute: number | null
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email_recipients?: string[] | null
          filter_settings?: Json
          id?: string
          is_active?: boolean
          organization_id: string
          report_name: string
          report_type: string
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_enabled?: boolean
          schedule_frequency?: string | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email_recipients?: string[] | null
          filter_settings?: Json
          id?: string
          is_active?: boolean
          organization_id?: string
          report_name?: string
          report_type?: string
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_enabled?: boolean
          schedule_frequency?: string | null
          schedule_hour?: number | null
          schedule_minute?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          file_format: string
          file_size: number
          file_url: string | null
          generated_by: string | null
          generated_date: string
          id: string
          organization_id: string
          report_category: string
          report_name: string
          report_type: string
          status: string
        }
        Insert: {
          created_at?: string
          file_format?: string
          file_size?: number
          file_url?: string | null
          generated_by?: string | null
          generated_date?: string
          id?: string
          organization_id?: string
          report_category?: string
          report_name: string
          report_type: string
          status?: string
        }
        Update: {
          created_at?: string
          file_format?: string
          file_size?: number
          file_url?: string | null
          generated_by?: string | null
          generated_date?: string
          id?: string
          organization_id?: string
          report_category?: string
          report_name?: string
          report_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_time_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          max_parallel: number
          organization_id: string
          room_id: string
          slot_minutes: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          max_parallel?: number
          organization_id: string
          room_id: string
          slot_minutes?: number
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          max_parallel?: number
          organization_id?: string
          room_id?: string
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_time_slots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_time_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "treatment_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_config: {
        Row: {
          absence_deduction: number
          allowance: number
          base_salary: number
          bonus: number
          created_at: string
          employee_id: string
          id: string
          insurance_deduction: number
          late_deduction: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          absence_deduction?: number
          allowance?: number
          base_salary?: number
          bonus?: number
          created_at?: string
          employee_id: string
          id?: string
          insurance_deduction?: number
          late_deduction?: number
          organization_id?: string
          updated_at?: string
        }
        Update: {
          absence_deduction?: number
          allowance?: number
          base_salary?: number
          bonus?: number
          created_at?: string
          employee_id?: string
          id?: string
          insurance_deduction?: number
          late_deduction?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_config_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          can_reserve_slot: boolean
          category: string | null
          code: string | null
          created_at: string
          default_duration_minutes: number
          deleted_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          requires_professional: boolean
          updated_at: string
        }
        Insert: {
          can_reserve_slot?: boolean
          category?: string | null
          code?: string | null
          created_at?: string
          default_duration_minutes?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          requires_professional?: boolean
          updated_at?: string
        }
        Update: {
          can_reserve_slot?: boolean
          category?: string | null
          code?: string | null
          created_at?: string
          default_duration_minutes?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          requires_professional?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_end: string | null
          break_start: string | null
          code: string
          created_at: string
          crosses_midnight: boolean
          deleted_at: string | null
          early_checkin_window_minutes: number
          early_leave_threshold_minutes: number
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          late_threshold_minutes: number
          min_overtime_minutes: number
          name: string
          notes: string | null
          organization_id: string
          overtime_threshold_minutes: number
          paid_break: boolean
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          code: string
          created_at?: string
          crosses_midnight?: boolean
          deleted_at?: string | null
          early_checkin_window_minutes?: number
          early_leave_threshold_minutes?: number
          end_time: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          late_threshold_minutes?: number
          min_overtime_minutes?: number
          name: string
          notes?: string | null
          organization_id: string
          overtime_threshold_minutes?: number
          paid_break?: boolean
          start_time: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          code?: string
          created_at?: string
          crosses_midnight?: boolean
          deleted_at?: string | null
          early_checkin_window_minutes?: number
          early_leave_threshold_minutes?: number
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          late_threshold_minutes?: number
          min_overtime_minutes?: number
          name?: string
          notes?: string | null
          organization_id?: string
          overtime_threshold_minutes?: number
          paid_break?: boolean
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_backups: {
        Row: {
          backup_date: string
          backup_scope: string | null
          backup_status: string
          backup_type: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          next_backup_date: string | null
          organization_id: string
          triggered_by: string | null
        }
        Insert: {
          backup_date: string
          backup_scope?: string | null
          backup_status?: string
          backup_type: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          next_backup_date?: string | null
          organization_id: string
          triggered_by?: string | null
        }
        Update: {
          backup_date?: string
          backup_scope?: string | null
          backup_status?: string
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          next_backup_date?: string | null
          organization_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_backups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          affected_records: Json | null
          changes: Json | null
          created_at: string
          description: string | null
          event_category: string | null
          event_type: string
          id: string
          organization_id: string
          severity: string
          source_ip: string | null
          subject: string
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          affected_records?: Json | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          event_category?: string | null
          event_type: string
          id?: string
          organization_id: string
          severity?: string
          source_ip?: string | null
          subject: string
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          affected_records?: Json | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          event_category?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          severity?: string
          source_ip?: string | null
          subject?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_rooms: {
        Row: {
          capacity: number
          code: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_order: number
          equipment: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          room_type: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          code?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          equipment?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          room_type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          code?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          equipment?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          room_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_user: {
        Args: {
          decision: string
          new_role?: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_active: {
        Args: { active: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      current_org_id: { Args: never; Returns: string }
      ensure_user_profile: {
        Args: never
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_manager: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "administrator"
        | "manager"
        | "receptionist"
        | "employee"
        | "doctor"
        | "patient"
      employment_status:
        | "probation"
        | "active"
        | "on_leave"
        | "suspended"
        | "terminated"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
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
      app_role: [
        "administrator",
        "manager",
        "receptionist",
        "employee",
        "doctor",
        "patient",
      ],
      employment_status: [
        "probation",
        "active",
        "on_leave",
        "suspended",
        "terminated",
      ],
      employment_type: ["full_time", "part_time", "contract", "intern"],
    },
  },
} as const
