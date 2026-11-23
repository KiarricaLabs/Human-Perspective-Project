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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      active_consent_version: {
        Row: {
          activated_at: string
          activated_by: string | null
          consent_version_id: string
          id: boolean
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          consent_version_id: string
          id?: boolean
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          consent_version_id?: string
          id?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "active_consent_version_consent_version_id_fkey"
            columns: ["consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          ai_evaluation: boolean
          ai_training: boolean
          audio: boolean
          consent_version_id: string
          id: string
          public_excerpts: boolean
          recorded_at: string
          research_analysis: boolean
          seq: number
          source: string
          submission_id: string
          supersedes_id: string | null
          transcription: boolean
        }
        Insert: {
          ai_evaluation: boolean
          ai_training: boolean
          audio: boolean
          consent_version_id: string
          id?: string
          public_excerpts: boolean
          recorded_at?: string
          research_analysis: boolean
          seq?: never
          source?: string
          submission_id: string
          supersedes_id?: string | null
          transcription: boolean
        }
        Update: {
          ai_evaluation?: boolean
          ai_training?: boolean
          audio?: boolean
          consent_version_id?: string
          id?: string
          public_excerpts?: boolean
          recorded_at?: string
          research_analysis?: boolean
          seq?: never
          source?: string
          submission_id?: string
          supersedes_id?: string | null
          transcription?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_consent_version_id_fkey"
            columns: ["consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "current_consent"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_versions: {
        Row: {
          ai_evaluation_text: string
          ai_training_text: string
          audio_text: string
          created_at: string
          eligibility_text: string
          id: string
          public_excerpts_text: string
          research_analysis_text: string
          transcription_text: string
          version_label: string
        }
        Insert: {
          ai_evaluation_text: string
          ai_training_text: string
          audio_text: string
          created_at?: string
          eligibility_text: string
          id?: string
          public_excerpts_text: string
          research_analysis_text: string
          transcription_text: string
          version_label: string
        }
        Update: {
          ai_evaluation_text?: string
          ai_training_text?: string
          audio_text?: string
          created_at?: string
          eligibility_text?: string
          id?: string
          public_excerpts_text?: string
          research_analysis_text?: string
          transcription_text?: string
          version_label?: string
        }
        Relationships: []
      }
      eligibility_attestations: {
        Row: {
          attested_at: string
          consent_version_id: string
          identifies_as_black: boolean
          is_adult: boolean
          submission_id: string
        }
        Insert: {
          attested_at?: string
          consent_version_id: string
          identifies_as_black: boolean
          is_adult: boolean
          submission_id: string
        }
        Update: {
          attested_at?: string
          consent_version_id?: string
          identifies_as_black?: boolean
          is_adult?: boolean
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_attestations_consent_version_id_fkey"
            columns: ["consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_attestations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_request_limits: {
        Row: {
          attempts: number
          key_hash: string
          window_start: string
        }
        Insert: {
          attempts?: number
          key_hash: string
          window_start?: string
        }
        Update: {
          attempts?: number
          key_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      purpose_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          id: string
          justification: string
          purpose: Database["public"]["Enums"]["research_purpose"]
          revoked_at: string | null
          submission_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string
          id?: string
          justification: string
          purpose: Database["public"]["Enums"]["research_purpose"]
          revoked_at?: string | null
          submission_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          id?: string
          justification?: string
          purpose?: Database["public"]["Enums"]["research_purpose"]
          revoked_at?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purpose_approvals_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_training_authorizations: {
        Row: {
          documented_basis: string
          id: string
          includes_audio: boolean
          reviewed_at: string
          reviewed_by: string
          submission_id: string
        }
        Insert: {
          documented_basis: string
          id?: string
          includes_audio?: boolean
          reviewed_at?: string
          reviewed_by?: string
          submission_id: string
        }
        Update: {
          documented_basis?: string
          id?: string
          includes_audio?: boolean
          reviewed_at?: string
          reviewed_by?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_training_authorizations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_annotations: {
        Row: {
          admin_id: string
          contains_pii: boolean
          created_at: string
          deidentified_at: string | null
          deidentified_text: string | null
          id: string
          note: string | null
          reviewed_at: string | null
          submission_id: string
        }
        Insert: {
          admin_id?: string
          contains_pii?: boolean
          created_at?: string
          deidentified_at?: string | null
          deidentified_text?: string | null
          id?: string
          note?: string | null
          reviewed_at?: string | null
          submission_id: string
        }
        Update: {
          admin_id?: string
          contains_pii?: boolean
          created_at?: string
          deidentified_at?: string | null
          deidentified_text?: string | null
          id?: string
          note?: string | null
          reviewed_at?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_annotations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_export_items: {
        Row: {
          annotation_id: string
          consent_record_id: string
          content_kind: Database["public"]["Enums"]["export_content_kind"]
          created_at: string
          export_id: string
          id: string
          purpose: Database["public"]["Enums"]["research_purpose"]
          raw_authorization_id: string | null
          submission_id: string
        }
        Insert: {
          annotation_id: string
          consent_record_id: string
          content_kind?: Database["public"]["Enums"]["export_content_kind"]
          created_at?: string
          export_id: string
          id?: string
          purpose: Database["public"]["Enums"]["research_purpose"]
          raw_authorization_id?: string | null
          submission_id: string
        }
        Update: {
          annotation_id?: string
          consent_record_id?: string
          content_kind?: Database["public"]["Enums"]["export_content_kind"]
          created_at?: string
          export_id?: string
          id?: string
          purpose?: Database["public"]["Enums"]["research_purpose"]
          raw_authorization_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_export_items_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "research_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_export_items_consent_record_id_fkey"
            columns: ["consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_export_items_consent_record_id_fkey"
            columns: ["consent_record_id"]
            isOneToOne: false
            referencedRelation: "current_consent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_export_items_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "research_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_export_items_raw_authorization_id_fkey"
            columns: ["raw_authorization_id"]
            isOneToOne: false
            referencedRelation: "raw_training_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_export_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_exports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          purpose: Database["public"]["Enums"]["research_purpose"]
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          purpose: Database["public"]["Enums"]["research_purpose"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          purpose?: Database["public"]["Enums"]["research_purpose"]
        }
        Relationships: []
      }
      submissions: {
        Row: {
          age_range: string | null
          audio_bytes: number | null
          audio_mime: string | null
          audio_path: string | null
          created_at: string
          id: string
          is_test: boolean
          origin: Database["public"]["Enums"]["submission_origin"]
          payload: Json
          region: string | null
          status: Database["public"]["Enums"]["submission_status"]
          type: Database["public"]["Enums"]["submission_type"]
          withdrawal_ref_hash: string
        }
        Insert: {
          age_range?: string | null
          audio_bytes?: number | null
          audio_mime?: string | null
          audio_path?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          origin?: Database["public"]["Enums"]["submission_origin"]
          payload: Json
          region?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          type: Database["public"]["Enums"]["submission_type"]
          withdrawal_ref_hash: string
        }
        Update: {
          age_range?: string | null
          audio_bytes?: number | null
          audio_mime?: string | null
          audio_path?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          origin?: Database["public"]["Enums"]["submission_origin"]
          payload?: Json
          region?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          type?: Database["public"]["Enums"]["submission_type"]
          withdrawal_ref_hash?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          id: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          submission_id: string
        }
        Insert: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          submission_id: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_consent: {
        Row: {
          ai_evaluation: boolean | null
          ai_training: boolean | null
          audio: boolean | null
          consent_version_id: string | null
          id: string | null
          public_excerpts: boolean | null
          recorded_at: string | null
          research_analysis: boolean | null
          seq: number | null
          source: string | null
          submission_id: string | null
          supersedes_id: string | null
          transcription: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_consent_version_id_fkey"
            columns: ["consent_version_id"]
            isOneToOne: false
            referencedRelation: "consent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "current_consent"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      audit_export_download: { Args: { p_export: string }; Returns: undefined }
      can_listen_audio: { Args: { p_path: string }; Returns: boolean }
      consent_allows: {
        Args: {
          _c: Database["public"]["Tables"]["consent_records"]["Row"]
          _purpose: string
        }
        Returns: boolean
      }
      create_research_export: {
        Args: {
          p_notes: string
          p_purpose: Database["public"]["Enums"]["research_purpose"]
          p_submission_ids: string[]
        }
        Returns: string
      }
      download_research_export: { Args: { p_export: string }; Returns: Json }
      governing_consent: {
        Args: { _submission_id: string }
        Returns: {
          ai_evaluation: boolean
          ai_training: boolean
          audio: boolean
          consent_version_id: string
          id: string
          public_excerpts: boolean
          recorded_at: string
          research_analysis: boolean
          seq: number
          source: string
          submission_id: string
          supersedes_id: string | null
          transcription: boolean
        }
        SetofOptions: {
          from: "*"
          to: "consent_records"
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
      manage_participation: {
        Args: {
          p_action: string
          p_consent: Json
          p_hash: string
          p_version: string
        }
        Returns: Json
      }
      research_current_consent: {
        Args: { p_submission: string }
        Returns: {
          ai_evaluation: boolean
          ai_training: boolean
          audio: boolean
          consent_version_id: string
          id: string
          public_excerpts: boolean
          recorded_at: string
          research_analysis: boolean
          seq: number
          source: string
          submission_id: string
          supersedes_id: string | null
          transcription: boolean
        }
        SetofOptions: {
          from: "*"
          to: "consent_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_human_review: {
        Args: {
          p_deidentified: boolean
          p_note: string
          p_submission: string
          p_text: string
        }
        Returns: string
      }
      submit_contribution: {
        Args: {
          p_admin_id: string
          p_age_range: string
          p_ai_evaluation: boolean
          p_ai_training: boolean
          p_audio: boolean
          p_audio_bytes: number
          p_audio_mime: string
          p_audio_path: string
          p_consent_version_id: string
          p_identifies_as_black: boolean
          p_is_adult: boolean
          p_payload: Json
          p_public_excerpts: boolean
          p_region: string
          p_research_analysis: boolean
          p_transcription: boolean
          p_type: Database["public"]["Enums"]["submission_type"]
          p_withdrawal_ref_hash: string
        }
        Returns: string
      }
      take_participant_request: {
        Args: { p_key_hash: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      export_content_kind: "deidentified" | "raw_text" | "raw_audio"
      research_purpose: "evaluation" | "training" | "public"
      submission_origin: "public" | "admin_test"
      submission_status: "pending" | "reviewed" | "withdrawn"
      submission_type: "words" | "voice" | "language" | "ai_society"
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
      app_role: ["admin"],
      export_content_kind: ["deidentified", "raw_text", "raw_audio"],
      research_purpose: ["evaluation", "training", "public"],
      submission_origin: ["public", "admin_test"],
      submission_status: ["pending", "reviewed", "withdrawn"],
      submission_type: ["words", "voice", "language", "ai_society"],
    },
  },
} as const
