import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseAccessToken } from "@/lib/authSession";
import {
  completeBooking,
  getBookingDetail,
  getTeacherFollowUpContext,
  type BookingDetailResponse,
  type LessonObjectiveItem,
  type TeacherFollowUpContextResponse,
} from "@/lib/backendBookings";
import { TEACHER_AGENDA_PATH } from "@/domains/teacher/lib/teacherRoutes";

export default function TeacherLessonClosurePage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [context, setContext] = useState<TeacherFollowUpContextResponse | null>(null);
  const [detail, setDetail] = useState<BookingDetailResponse | null>(null);
  const [objectiveReviews, setObjectiveReviews] = useState<LessonObjectiveItem[]>([]);
  const [nextObjectives, setNextObjectives] = useState<string[]>([""]);
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [attentionPoints, setAttentionPoints] = useState<string[]>([]);
  const [attentionInput, setAttentionInput] = useState("");

  useEffect(() => {
    if (!bookingId) {
      setError("Aula não encontrada.");
      setIsLoading(false);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate(`/login?returnTo=${encodeURIComponent(`/aulas/${bookingId}/cierre`)}`);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError("");

    Promise.all([getTeacherFollowUpContext(accessToken, bookingId), getBookingDetail(accessToken, bookingId)])
      .then(([followUpContext, bookingDetail]) => {
        if (!isMounted) return;
        setContext(followUpContext);
        setDetail(bookingDetail);

        const existingFollowUp = bookingDetail.latest_follow_up;
        const isEditingExisting = bookingDetail.status === "concluida" && !!existingFollowUp;

        setObjectiveReviews(
          isEditingExisting ? existingFollowUp.objectives : followUpContext.class_objectives,
        );
        const savedNextObjectives = isEditingExisting
          ? existingFollowUp.next_objectives.map((item) => item.objective).filter(Boolean)
          : [];
        setNextObjectives(savedNextObjectives.length > 0 ? savedNextObjectives : [""]);
        setSummary(isEditingExisting ? existingFollowUp.summary : "");
        setNextSteps(isEditingExisting ? existingFollowUp.next_steps : "");
        setTags(isEditingExisting ? existingFollowUp.tags : []);
        setAttentionPoints(isEditingExisting ? existingFollowUp.attention_points : []);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o fechamento da aula.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [bookingId, navigate]);

  const isFirstLesson = useMemo(
    () => (context?.completed_lessons_with_child ?? 0) === 0,
    [context?.completed_lessons_with_child],
  );

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags((current) => [...current, value]);
    setTagInput("");
  };

  const addAttentionPoint = () => {
    const value = attentionInput.trim();
    if (!value) return;
    setAttentionPoints((current) => [...current, value]);
    setAttentionInput("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bookingId) return;
    if (!context) return;

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      toast({
        title: "Sessão inválida",
        description: "Faça login novamente para salvar a revisão.",
      });
      return;
    }

    const normalizedSummary = summary.trim();
    const normalizedNextSteps = nextSteps.trim();
    const normalizedNextObjectives = nextObjectives
      .map((objective) => objective.trim())
      .filter(Boolean)
      .map((objective) => ({
        objective,
        achieved: false,
        fullfilment_level: 0 as const,
      }));
    const normalizedObjectiveReviews = objectiveReviews
      .map((objective) => ({
        objective: objective.objective.trim(),
        achieved: objective.achieved,
        fullfilment_level: objective.fullfilment_level,
      }))
      .filter((objective) => objective.objective.length > 0);

    if (!normalizedSummary || !normalizedNextSteps) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o resumo da evolução e os próximos passos.",
      });
      return;
    }
    if (normalizedNextObjectives.length === 0) {
      toast({
        title: "Próximos objetivos obrigatórios",
        description: "Defina ao menos um objetivo para a próxima aula.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await completeBooking(accessToken, bookingId, {
        follow_up: {
          summary: normalizedSummary,
          next_steps: normalizedNextSteps,
          objectives: normalizedObjectiveReviews,
          next_objectives: normalizedNextObjectives,
          tags,
          attention_points: attentionPoints,
        },
      });

      toast({
        title: "Revisão salva",
        description: "O fechamento da aula foi registrado com sucesso.",
      });
      navigate(TEACHER_AGENDA_PATH);
    } catch (submitError) {
      toast({
        title: "Não foi possível salvar",
        description: submitError instanceof Error ? submitError.message : "Tente novamente em instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell hideNav>
        <TopBar title="Cierre de clase" showBack />
        <div className="px-4 pt-6">
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando formulário...</div>
        </div>
      </AppShell>
    );
  }

  if (error || !context) {
    return (
      <AppShell hideNav>
        <TopBar title="Cierre de clase" showBack />
        <div className="px-4 pt-6 space-y-3">
          <div className="card-kidario p-4 text-sm text-destructive">{error || "Não foi possível carregar."}</div>
          <KidarioButton asChild variant="outline">
            <Link to={TEACHER_AGENDA_PATH}>Voltar para agenda</Link>
          </KidarioButton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <TopBar title={detail?.status === "concluida" ? "Editar revisión" : "Cierre de clase"} showBack />
      <form className="px-4 pt-4 pb-8 space-y-4" onSubmit={onSubmit}>
        <section className="card-kidario p-4 space-y-1">
          <p className="text-sm font-medium text-foreground">{context.child_name}</p>
          <p className="text-xs text-muted-foreground">
            {context.date_label} às {context.time} • {context.modality}
          </p>
          <p className="text-xs text-muted-foreground">
            {context.completed_lessons_with_child} aula(s) concluída(s) antes desta sessão com este aluno
          </p>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Objetivos trabajados en esta clase</p>
          {objectiveReviews.map((objective, index) => (
            <div key={`review-${index}`} className="rounded-xl border border-border/70 p-3 space-y-2">
              <p className="text-sm text-foreground">{objective.objective}</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={objective.achieved}
                  onCheckedChange={(checked) =>
                    setObjectiveReviews((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, achieved: Boolean(checked) } : item,
                      ),
                    )
                  }
                />
                Objetivo alcanzado
              </label>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Nivel de cumplimiento: {objective.fullfilment_level}
                </p>
                <Slider
                  className="py-1"
                  min={0}
                  max={5}
                  step={1}
                  value={[objective.fullfilment_level]}
                  onValueChange={(value) =>
                    setObjectiveReviews((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              fullfilment_level: (
                                typeof value[0] === "number" ? value[0] : 0
                              ) as 0 | 1 | 2 | 3 | 4 | 5,
                            }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
          {isFirstLesson && context.parent_focus_points.length > 0 && (
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs font-medium text-foreground">Pontos de melhoria do responsável (diagnóstico)</p>
              <ul className="space-y-1 mt-1">
                {context.parent_focus_points.map((point, index) => (
                  <li key={`focus-${index}`} className="text-xs text-muted-foreground">
                    • {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Plan sugerido para la clase</p>
          <p className="text-xs text-muted-foreground">
            {context.activity_plan_source === "llm" ? "Generado por IA" : "Generado automaticamente"}
          </p>
          <ul className="space-y-1">
            {context.activity_plan.map((item, index) => (
              <li key={`activity-${index}`} className="text-sm text-foreground">
                • {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Focos de la sesión (tags)</p>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Matemática"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
            />
            <KidarioButton type="button" variant="outline" onClick={addTag}>
              Adicionar
            </KidarioButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground"
                onClick={() => setTags((current) => current.filter((item) => item !== tag))}
              >
                {tag} ×
              </button>
            ))}
          </div>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Próximos objetivos para evaluar</p>
          {nextObjectives.map((objective, index) => (
            <div key={`next-objective-${index}`} className="flex gap-2">
              <Input
                value={objective}
                placeholder="Ex.: Resolver problemas com frações"
                onChange={(event) =>
                  setNextObjectives((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                  )
                }
              />
              <KidarioButton
                type="button"
                variant="outline"
                onClick={() =>
                  setNextObjectives((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                disabled={nextObjectives.length === 1}
              >
                Remover
              </KidarioButton>
            </div>
          ))}
          <KidarioButton
            type="button"
            variant="outline"
            onClick={() => setNextObjectives((current) => [...current, ""])}
          >
            Adicionar objetivo
          </KidarioButton>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Resumen de evolución</p>
          <Textarea
            placeholder="Describe brevemente cómo fue la evolución del niño durante la sesión."
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={5}
          />
          <p className="text-sm font-medium text-foreground">Próximos pasos</p>
          <Textarea
            placeholder="Describe próximos pasos pedagógicos."
            value={nextSteps}
            onChange={(event) => setNextSteps(event.target.value)}
            rows={4}
          />
        </section>

        <section className="card-kidario p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Attention points para la familia</p>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Sinais de cansaço na segunda metade da aula"
              value={attentionInput}
              onChange={(event) => setAttentionInput(event.target.value)}
            />
            <KidarioButton type="button" variant="outline" onClick={addAttentionPoint}>
              Adicionar
            </KidarioButton>
          </div>
          <ul className="space-y-1">
            {attentionPoints.map((point, index) => (
              <li key={`${point}-${index}`} className="text-sm text-foreground flex items-center justify-between gap-2">
                <span>• {point}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setAttentionPoints((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <KidarioButton type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </KidarioButton>
          <KidarioButton type="submit" variant="hero" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Guardar revisión"}
          </KidarioButton>
        </div>
      </form>
    </AppShell>
  );
}
