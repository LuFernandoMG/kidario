import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface NotificationItem {
  id: string;
  user_id: string;
  notification_type: string;
  channel: "push" | "email" | "sms";
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  status: "queued" | "sent" | "failed" | "read";
  created_at: string;
  sent_at?: string | null;
  read_at?: string | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  channel: "push" | "email" | "sms";
  notification_type: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

async function notificationRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST" | "PUT";
  body?: Record<string, unknown>;
}) {
  const { path, accessToken, method = "GET", body } = params;
  const bearerToken = await resolveProtectedAccessToken(accessToken);
  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
      ...buildRequestIdHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throwBackendError({
      status: response.status,
      payload,
      fallback: "Não foi possível processar notificações.",
      authProtected: true,
    });
  }
  return payload as TResponse;
}

export async function listNotifications(accessToken: string) {
  return notificationRequest<{ notifications: NotificationItem[] }>({
    path: "/notifications",
    accessToken,
  });
}

export async function markNotificationRead(accessToken: string, notificationId: string) {
  return notificationRequest<{ status: "ok"; notification: NotificationItem }>({
    path: `/notifications/${notificationId}/read`,
    accessToken,
    method: "POST",
  });
}

export async function listNotificationPreferences(accessToken: string) {
  return notificationRequest<{ preferences: NotificationPreference[] }>({
    path: "/notifications/preferences",
    accessToken,
  });
}

export async function updateNotificationPreferences(
  accessToken: string,
  preferences: Array<Pick<NotificationPreference, "channel" | "notification_type" | "is_enabled">>,
) {
  return notificationRequest<{ preferences: NotificationPreference[] }>({
    path: "/notifications/preferences",
    accessToken,
    method: "PUT",
    body: { preferences },
  });
}
