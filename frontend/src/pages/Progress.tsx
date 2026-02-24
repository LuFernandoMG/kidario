import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, FileText, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { getParentProfile, type BackendParentChildView } from "@/lib/backendProfiles";
import { getBookingDetail, getParentAgenda } from "@/lib/backendBookings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProgressEntry {
  id: string;
  childId: string;
  childName: string;
  teacherName: string;
  dateLabel: string;
  dateIso: string;
  summary: string;
  nextSteps: string;
  tags: string[];
  attentionPoints: string[];
  followUpUpdatedAt: string;
}

const ALL_CHILDREN_ID = "__all_children__";

function formatFollowUpDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Atualização recente";
  return `Atualizado em ${date.toLocaleDateString("pt-BR")}`;
}

export default function Progress() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<BackendParentChildView[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(ALL_CHILDREN_ID);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [error, setError] = useState("");

  const childrenRequestRef = useRef(0);
  const progressRequestRef = useRef(0);

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fprogresso");
      return;
    }

    const requestId = ++childrenRequestRef.current;
    setIsLoadingChildren(true);
    setError("");

    getParentProfile(accessToken)
      .then((payload) => {
        if (requestId !== childrenRequestRef.current) return;

        const fetchedChildren = payload.children || [];
        setChildren(fetchedChildren);
        setSelectedChildId((current) => {
          if (current !== ALL_CHILDREN_ID && fetchedChildren.some((child) => child.id === current)) {
            return current;
          }
          if (fetchedChildren.length === 1) return fetchedChildren[0].id;
          return ALL_CHILDREN_ID;
        });
      })
      .catch((loadError) => {
        if (requestId !== childrenRequestRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os dados de progresso.",
        );
      })
      .finally(() => {
        if (requestId !== childrenRequestRef.current) return;
        setIsLoadingChildren(false);
      });
  }, [navigate]);

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken || isLoadingChildren) return;

    if (children.length === 0) {
      setProgressEntries([]);
      setIsLoadingProgress(false);
      return;
    }

    const requestId = ++progressRequestRef.current;
    setIsLoadingProgress(true);
    setError("");

    const childIdFilter = selectedChildId === ALL_CHILDREN_ID ? undefined : selectedChildId;
    getParentAgenda(accessToken, { tab: "past", childId: childIdFilter })
      .then(async (agendaResponse) => {
        if (requestId !== progressRequestRef.current) return;

        const concludedLessons = agendaResponse.lessons
          .filter((lesson) => lesson.status === "concluida")
          .slice(0, 12);

        if (concludedLessons.length === 0) {
          setProgressEntries([]);
          return;
        }

        const details = await Promise.allSettled(
          concludedLessons.map((lesson) => getBookingDetail(accessToken, lesson.id)),
        );
        if (requestId !== progressRequestRef.current) return;

        const entries: ProgressEntry[] = details.flatMap((detailResult, index) => {
          if (detailResult.status !== "fulfilled") return [];

          const detail = detailResult.value;
          if (!detail.latest_follow_up) return [];

          return [
            {
              id: detail.id,
              childId: detail.child_id,
              childName: detail.child_name,
              teacherName: detail.teacher_name,
              dateLabel: detail.date_label,
              dateIso: detail.date_iso,
              summary: detail.latest_follow_up.summary,
              nextSteps: detail.latest_follow_up.next_steps,
              tags: detail.latest_follow_up.tags || [],
              attentionPoints: detail.latest_follow_up.attention_points || [],
              followUpUpdatedAt: detail.latest_follow_up.updated_at,
            },
          ];
        });

        entries.sort((a, b) => b.followUpUpdatedAt.localeCompare(a.followUpUpdatedAt));
        setProgressEntries(entries);
      })
      .catch((loadError) => {
        if (requestId !== progressRequestRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o progresso das crianças.",
        );
      })
      .finally(() => {
        if (requestId !== progressRequestRef.current) return;
        setIsLoadingProgress(false);
      });
  }, [children, isLoadingChildren, selectedChildId]);

  const selectedChildName = useMemo(() => {
    if (selectedChildId === ALL_CHILDREN_ID) return "Todos os filhos";
    return children.find((child) => child.id === selectedChildId)?.name || "Filho";
  }, [children, selectedChildId]);

  const latestFollowUpDate = progressEntries[0]?.followUpUpdatedAt;
  const totalAttentionPoints = progressEntries.reduce(
    (total, entry) => total + entry.attentionPoints.length,
    0,
  );

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Progresso</h1>
              <p className="text-muted-foreground mt-1">Acompanhe a evolução nas aulas.</p>
            </div>
            <div className="w-[200px] shrink-0">
              <Select
                value={selectedChildId}
                onValueChange={setSelectedChildId}
                disabled={isLoadingChildren || children.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar filho" />
                </SelectTrigger>
                <SelectContent>
                  {children.length > 1 && (
                    <SelectItem value={ALL_CHILDREN_ID}>Todos os filhos</SelectItem>
                  )}
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 card-kidario-elevated p-5 bg-gradient-to-br from-primary/5 to-kidario-mint-light"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{selectedChildName}</h2>
              <p className="text-muted-foreground text-sm">
                {progressEntries.length} devolutiva(s) registrada(s)
              </p>
              {latestFollowUpDate && (
                <p className="text-muted-foreground text-xs mt-1">{formatFollowUpDate(latestFollowUpDate)}</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="section-title mb-0">Registros de acompanhamento</h2>
            <span className="text-xs text-muted-foreground">
              {totalAttentionPoints} ponto(s) de atenção
            </span>
          </div>

          {isLoadingChildren || isLoadingProgress ? (
            <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando progresso...</div>
          ) : error ? (
            <div className="card-kidario p-4 text-sm text-destructive">{error}</div>
          ) : children.length === 0 ? (
            <div className="card-kidario p-4 text-sm text-muted-foreground">
              Cadastre pelo menos um filho para acompanhar o progresso.
            </div>
          ) : progressEntries.length === 0 ? (
            <div className="card-kidario p-4 text-sm text-muted-foreground">
              Ainda não há devolutivas concluídas para este filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {progressEntries.map((entry, index) => (
                <ProgressEntryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  showChildName={selectedChildId === ALL_CHILDREN_ID}
                />
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </AppShell>
  );
}

function ProgressEntryCard({
  entry,
  index,
  showChildName,
}: {
  entry: ProgressEntry;
  index: number;
  showChildName: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.05 }}
      className="card-kidario p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-primary mt-1" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{entry.dateLabel}</span>
            <span>•</span>
            <span>{entry.teacherName}</span>
            {showChildName && (
              <>
                <span>•</span>
                <span>{entry.childName}</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{formatFollowUpDate(entry.followUpUpdatedAt)}</p>
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed">{entry.summary}</p>
      <p className="text-sm text-foreground leading-relaxed">
        <span className="font-medium">Próximos passos:</span> {entry.nextSteps}
      </p>

      <div className="flex flex-wrap gap-2">
        {entry.tags.map((tag) => (
          <span key={tag} className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      {entry.attentionPoints.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="text-sm font-medium text-foreground">Pontos de atenção</p>
          <ul className="space-y-1">
            {entry.attentionPoints.map((point, pointIndex) => (
              <li key={`${point}-${pointIndex}`} className="text-sm text-muted-foreground">
                • {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
