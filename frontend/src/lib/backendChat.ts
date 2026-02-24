import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";

export interface ChatThreadView {
  id: string;
  booking_id: string;
  parent_profile_id: string;
  teacher_profile_id: string;
  child_id: string;
  booking_status: "pendente" | "confirmada" | "cancelada" | "concluida";
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

async function backendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body } = params;
  const url = `${getBackendApiBaseUrl()}${path}`;
  const bearerToken = await resolveProtectedAccessToken(accessToken);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throwBackendError({
      status: response.status,
      payload,
      fallback: "Não foi possível processar a operação de chat.",
      authProtected: true,
    });
  }

  return payload as TResponse;
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
