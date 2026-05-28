import { useEffect, useState } from "react";
import { Bell, Check, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Switch } from "@/components/ui/switch";
import { getSupabaseAccessToken } from "@/lib/authSession";
import {
  listNotificationPreferences,
  listNotifications,
  markNotificationRead,
  updateNotificationPreferences,
  type NotificationItem,
  type NotificationPreference,
} from "@/data/api/notifications";
import { useToast } from "@/hooks/use-toast";

const fallbackPreferences: Array<Pick<NotificationPreference, "channel" | "notification_type" | "is_enabled">> = [
  { channel: "push", notification_type: "booking_confirmed", is_enabled: true },
  { channel: "push", notification_type: "booking_reminder", is_enabled: true },
  { channel: "push", notification_type: "payment_paid", is_enabled: true },
  { channel: "email", notification_type: "payment_failed", is_enabled: true },
];

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [activeTab, setActiveTab] = useState<"inbox" | "preferences">("inbox");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setError("Faça login para ver suas notificações.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [notificationsResponse, preferencesResponse] = await Promise.all([
        listNotifications(accessToken),
        listNotificationPreferences(accessToken),
      ]);
      setNotifications(notificationsResponse.notifications);
      setPreferences(preferencesResponse.preferences);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar notificações.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const onMarkRead = async (notificationId: string) => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) return;
    try {
      const response = await markNotificationRead(accessToken, notificationId);
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? response.notification : item)),
      );
    } catch (markError) {
      toast({
        title: "Não foi possível atualizar",
        description: markError instanceof Error ? markError.message : "Tente novamente.",
      });
    }
  };

  const togglePreference = async (preference: Pick<NotificationPreference, "channel" | "notification_type" | "is_enabled">) => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) return;
    const nextPreferences = [...fallbackPreferences, ...preferences].map((item) =>
      item.channel === preference.channel && item.notification_type === preference.notification_type
        ? { ...item, is_enabled: !preference.is_enabled }
        : item,
    );
    try {
      const response = await updateNotificationPreferences(accessToken, nextPreferences);
      setPreferences(response.preferences);
    } catch (updateError) {
      toast({
        title: "Não foi possível salvar preferências",
        description: updateError instanceof Error ? updateError.message : "Tente novamente.",
      });
    }
  };

  const preferenceRows = preferences.length > 0 ? preferences : fallbackPreferences;

  return (
    <AppShell>
      <TopBar title="Notificações" />
      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${activeTab === "inbox" ? "bg-card text-foreground" : "text-muted-foreground"}`}
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preferences")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${activeTab === "preferences" ? "bg-card text-foreground" : "text-muted-foreground"}`}
          >
            Preferências
          </button>
        </div>

        {isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando notificações...</div>
        ) : error ? (
          <div className="card-kidario p-4 text-sm text-destructive">{error}</div>
        ) : activeTab === "inbox" ? (
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="card-kidario p-6 text-center text-sm text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              notifications.map((notification) => (
                <article key={notification.id} className="card-kidario p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium text-foreground">{notification.title || "Notificação"}</h2>
                      {notification.body && (
                        <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                      )}
                    </div>
                    {notification.status !== "read" && (
                      <KidarioButton size="sm" variant="outline" onClick={() => void onMarkRead(notification.id)}>
                        <Check className="w-4 h-4" />
                        Lida
                      </KidarioButton>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString("pt-BR")}
                  </p>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {preferenceRows.map((preference) => (
              <article key={`${preference.channel}-${preference.notification_type}`} className="card-kidario p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <SlidersHorizontal className="w-4 h-4 text-primary mt-1" />
                  <div>
                    <h2 className="font-medium text-foreground">{preference.notification_type.replace(/_/g, " ")}</h2>
                    <p className="text-sm text-muted-foreground">{preference.channel}</p>
                  </div>
                </div>
                <Switch
                  checked={preference.is_enabled}
                  onCheckedChange={() => void togglePreference(preference)}
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
