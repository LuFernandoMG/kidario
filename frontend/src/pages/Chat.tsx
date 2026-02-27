import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MessageCircle, SendHorizonal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Textarea } from "@/components/ui/textarea";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import {
  ChatMessageView,
  ChatThreadView,
  getChatMessages,
  getChatThread,
  sendChatMessage,
} from "@/lib/backendChat";
import { useToast } from "@/hooks/use-toast";
import { TEACHER_AGENDA_PATH } from "@/domains/teacher/lib/teacherRoutes";

const POLLING_INTERVAL_MS = 5000;

export default function Chat() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const authSession = getAuthSession();
  const accessToken = getSupabaseAccessToken();
  const agendaPath = authSession.role === "teacher" ? TEACHER_AGENDA_PATH : "/agenda";

  const [thread, setThread] = useState<ChatThreadView | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const currentProfileId = useMemo(() => {
    if (!accessToken) return "";
    return decodeJwtSub(accessToken);
  }, [accessToken]);
  const isReadOnly = Boolean(
    thread ? (thread.is_read_only ?? thread.booking_status === "cancelada") : false,
  );

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!authSession.isAuthenticated || !accessToken || !threadId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadInitial = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [threadResponse, messagesResponse] = await Promise.all([
          getChatThread(accessToken, threadId),
          getChatMessages(accessToken, threadId),
        ]);

        if (!isMounted) return;
        setThread(threadResponse.thread);
        setMessages(messagesResponse.messages);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o chat.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitial();

    return () => {
      isMounted = false;
    };
  }, [accessToken, authSession.isAuthenticated, threadId]);

  useEffect(() => {
    if (!authSession.isAuthenticated || !accessToken || !threadId) return;

    const intervalId = window.setInterval(() => {
      getChatMessages(accessToken, threadId)
        .then((response) => setMessages(response.messages))
        .catch(() => {});
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, authSession.isAuthenticated, threadId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!threadId || !accessToken || isSending || isReadOnly) return;
    const normalized = draft.trim();
    if (!normalized) return;

    setIsSending(true);
    try {
      const response = await sendChatMessage(accessToken, threadId, normalized);
      setMessages((previous) => [...previous, response.message]);
      setDraft("");
    } catch (sendError) {
      toast({
        title: "Não foi possível enviar",
        description:
          sendError instanceof Error ? sendError.message : "Tente novamente em alguns instantes.",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!authSession.isAuthenticated || !accessToken) {
    return (
      <AppShell hideNav>
        <TopBar title="Chat da aula" showBack />
        <div className="px-4 pt-8">
          <div className="card-kidario p-6 text-center space-y-3">
            <MessageCircle className="w-10 h-10 text-muted-foreground/60 mx-auto" />
            <p className="text-foreground font-medium">Faça login para acessar o chat.</p>
            <KidarioButton
              variant="hero"
              onClick={() => navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`)}
            >
              Ir para login
            </KidarioButton>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <TopBar title="Chat da aula" showBack />

      <div className="px-4 pt-6 pb-8 space-y-4">
        {isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando conversa...</div>
        ) : error ? (
          <div className="card-kidario p-6 text-center space-y-3">
            <p className="text-foreground font-medium">{error}</p>
            <Link to={agendaPath} className="text-primary text-sm font-medium hover:underline">
              Voltar para agenda
            </Link>
          </div>
        ) : (
          <>
            <section className="card-kidario p-4">
              <p className="text-sm text-muted-foreground">Professora</p>
              <p className="text-foreground font-medium">{thread?.teacher_name || "-"}</p>
              <p className="text-sm text-muted-foreground mt-2">Criança</p>
              <p className="text-foreground font-medium">{thread?.child_name || "-"}</p>
              {isReadOnly && (
                <p className="text-xs text-warning mt-3">
                  Este chat está em modo somente leitura porque a reserva foi cancelada.
                </p>
              )}
            </section>

            <section className="card-kidario p-3 h-[52vh] overflow-y-auto space-y-2">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  Nenhuma mensagem ainda. Comece a conversa com a professora.
                </p>
              ) : (
                messages.map((message) => {
                  const isMine = Boolean(currentProfileId) && message.sender_profile_id === currentProfileId;
                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className={`mt-1 text-[11px] ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomAnchorRef} />
            </section>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem..."
                rows={3}
                maxLength={1000}
                disabled={isReadOnly || isSending}
              />
              <KidarioButton
                type="submit"
                variant="hero"
                fullWidth
                disabled={isSending || !draft.trim() || isReadOnly}
              >
                <SendHorizonal className="w-4 h-4" />
                {isReadOnly ? "Chat em somente leitura" : isSending ? "Enviando..." : "Enviar mensagem"}
              </KidarioButton>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}

function formatMessageTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decodeJwtSub(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) return "";

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}
