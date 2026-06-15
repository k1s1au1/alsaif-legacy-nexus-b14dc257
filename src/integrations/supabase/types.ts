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
      account_requests: {
        Row: {
          created_at: string
          desired_password: string | null
          email: string
          father_name: string
          first_name: string
          grandfather_name: string
          id: string
          note: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["account_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          desired_password?: string | null
          email: string
          father_name: string
          first_name: string
          grandfather_name: string
          id?: string
          note?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          desired_password?: string | null
          email?: string
          father_name?: string
          first_name?: string
          grandfather_name?: string
          id?: string
          note?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["account_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      archive_items: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string | null
          id: string
          media_type: Database["public"]["Enums"]["archive_media_type"]
          pinned: boolean
          section: Database["public"]["Enums"]["archive_section"]
          storage_path: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          media_type: Database["public"]["Enums"]["archive_media_type"]
          pinned?: boolean
          section?: Database["public"]["Enums"]["archive_section"]
          storage_path: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          media_type?: Database["public"]["Enums"]["archive_media_type"]
          pinned?: boolean
          section?: Database["public"]["Enums"]["archive_section"]
          storage_path?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: []
      }
      bank_transfers: {
        Row: {
          amount: number
          created_at: string
          fund_transaction_id: string | null
          id: string
          note: string | null
          receipt_url: string | null
          reference_number: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_name: string
          status: Database["public"]["Enums"]["bank_transfer_status"]
          submitted_by: string
          transferred_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          fund_transaction_id?: string | null
          id?: string
          note?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name: string
          status?: Database["public"]["Enums"]["bank_transfer_status"]
          submitted_by: string
          transferred_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          fund_transaction_id?: string | null
          id?: string
          note?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string
          status?: Database["public"]["Enums"]["bank_transfer_status"]
          submitted_by?: string
          transferred_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_fund_transaction_id_fkey"
            columns: ["fund_transaction_id"]
            isOneToOne: false
            referencedRelation: "fund_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived_at: string | null
          can_send: boolean
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: Database["public"]["Enums"]["conv_role"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          can_send?: boolean
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["conv_role"]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          can_send?: boolean
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["conv_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at: string
          send_permission: Database["public"]["Enums"]["group_send_permission"]
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string
          send_permission?: Database["public"]["Enums"]["group_send_permission"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string
          send_permission?: Database["public"]["Enums"]["group_send_permission"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          rsvp: Database["public"]["Enums"]["event_rsvp"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          rsvp?: Database["public"]["Enums"]["event_rsvp"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          rsvp?: Database["public"]["Enums"]["event_rsvp"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          location: string | null
          location_url: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          location_url?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          location_url?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fund_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string
          id: string
          occurred_at: string
          type: Database["public"]["Enums"]["fund_tx_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description: string
          id?: string
          occurred_at?: string
          type: Database["public"]["Enums"]["fund_tx_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          occurred_at?: string
          type?: Database["public"]["Enums"]["fund_tx_type"]
          updated_at?: string
        }
        Relationships: []
      }
      majlis_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "majlis_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "majlis_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      majlis_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["majlis_post_kind"]
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["majlis_post_kind"]
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["majlis_post_kind"]
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_attendees: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          rsvp: Database["public"]["Enums"]["meeting_rsvp"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          rsvp?: Database["public"]["Enums"]["meeting_rsvp"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          rsvp?: Database["public"]["Enums"]["meeting_rsvp"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          location_url: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          location_url?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          location_url?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_deliveries: {
        Row: {
          conversation_id: string
          delivered_at: string | null
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          delivered_at?: string | null
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          delivered_at?: string | null
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_duration_ms: number | null
          attachment_mime: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_duration_ms?: number | null
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_duration_ms?: number | null
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arabic_name: string | null
          avatar_url: string | null
          created_at: string
          father_name: string | null
          first_name: string | null
          full_name: string | null
          grandfather_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          arabic_name?: string | null
          avatar_url?: string | null
          created_at?: string
          father_name?: string | null
          first_name?: string | null
          full_name?: string | null
          grandfather_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          arabic_name?: string | null
          avatar_url?: string | null
          created_at?: string
          father_name?: string | null
          first_name?: string | null
          full_name?: string | null
          grandfather_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_attendees: {
        Row: {
          created_at: string
          id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_attendees_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          badge: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          location: string | null
          location_url: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_url?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          location_url?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string
          status: Database["public"]["Enums"]["presence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          status?: Database["public"]["Enums"]["presence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          status?: Database["public"]["Enums"]["presence_status"]
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_cleanup_expired: { Args: never; Returns: undefined }
      can_user_send: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      find_or_create_direct: { Args: { _other: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_request_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "manager" | "member"
      archive_media_type: "image" | "video"
      archive_section: "family" | "meetings" | "events" | "trips"
      bank_transfer_status: "pending" | "approved" | "rejected"
      conv_role: "owner" | "admin" | "member"
      conversation_kind: "direct" | "group"
      event_rsvp: "going" | "not_going" | "maybe"
      event_status: "scheduled" | "cancelled" | "completed"
      event_type:
        | "wedding"
        | "birthday"
        | "graduation"
        | "religious"
        | "social"
        | "other"
      fund_tx_type: "contribution" | "expense"
      group_send_permission: "all" | "admins" | "selected"
      majlis_post_kind: "announcement" | "discussion"
      meeting_rsvp: "going" | "not_going" | "maybe"
      meeting_status: "scheduled" | "cancelled" | "completed"
      message_kind: "text" | "image" | "video" | "audio" | "file"
      presence_status: "online" | "offline"
      task_priority: "low" | "medium" | "high"
      task_status: "todo" | "in_progress" | "done"
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
      account_request_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "manager", "member"],
      archive_media_type: ["image", "video"],
      archive_section: ["family", "meetings", "events", "trips"],
      bank_transfer_status: ["pending", "approved", "rejected"],
      conv_role: ["owner", "admin", "member"],
      conversation_kind: ["direct", "group"],
      event_rsvp: ["going", "not_going", "maybe"],
      event_status: ["scheduled", "cancelled", "completed"],
      event_type: [
        "wedding",
        "birthday",
        "graduation",
        "religious",
        "social",
        "other",
      ],
      fund_tx_type: ["contribution", "expense"],
      group_send_permission: ["all", "admins", "selected"],
      majlis_post_kind: ["announcement", "discussion"],
      meeting_rsvp: ["going", "not_going", "maybe"],
      meeting_status: ["scheduled", "cancelled", "completed"],
      message_kind: ["text", "image", "video", "audio", "file"],
      presence_status: ["online", "offline"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
