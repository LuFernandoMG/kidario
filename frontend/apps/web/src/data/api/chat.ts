import { backendJsonRequest } from "@/lib/backendApi";

export interface ChatThreadView {
  id: string;
  booking_id: string;
  parent_id: string;
  teacher_id: string;
  child_id: string;
  booking_status: "pendente" | "confirmada" | "cancelada" | "concluida";
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
  sender_user_id: string;
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

async function backendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body } = params;
  return backendJsonRequest<TResponse>({
    path,
    accessToken,
    method,
    body,
    fallback: "Não foi possível processar a operação de chat.",
    authProtected: true,
  });
}

export async function getOrCreateChatThreadFromBooking(
  accessToken: string,
  bookingId: string,
): Promise<ChatThreadGetOrCreateResponse> {
  return backendRequest<ChatThreadGetOrCreateResponse>({
    path: `/chat/threads/from-booking/${bookingId}`,
    accessToken,
    method: "POST",
  });
}

export async function getChatThread(
  accessToken: string,
  threadId: string,
): Promise<ChatThreadResponse> {
  return backendRequest<ChatThreadResponse>({
    path: `/chat/threads/${threadId}`,
    accessToken,
  });
}

export async function getChatMessages(
  accessToken: string,
  threadId: string,
  limit = 60,
): Promise<ChatMessagesResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));

  return backendRequest<ChatMessagesResponse>({
    path: `/chat/threads/${threadId}/messages?${query.toString()}`,
    accessToken,
  });
}

export async function sendChatMessage(
  accessToken: string,
  threadId: string,
  body: string,
): Promise<ChatMessageCreateResponse> {
  return backendRequest<ChatMessageCreateResponse>({
    path: `/chat/threads/${threadId}/messages`,
    accessToken,
    method: "POST",
    body: { body },
  });
}
