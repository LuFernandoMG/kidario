import type { BookingStatus } from "@/types/common";

export interface ChatThreadView {
  id: string;
  booking_id: string;
  parent_profile_id: string;
  teacher_profile_id: string;
  child_id: string;
  booking_status: BookingStatus;
  is_read_only: boolean;
  parent_name: string;
  teacher_name: string;
  child_name: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
}

export interface ChatMessageView {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
}

export interface ChatThreadGetOrCreateResponse {
  status: "ok";
  thread: ChatThreadView;
}

export interface ChatThreadResponse {
  thread: ChatThreadView;
}

export interface ChatMessagesResponse {
  messages: ChatMessageView[];
}

export interface ChatMessageCreateResponse {
  status: "ok";
  message: ChatMessageView;
}
