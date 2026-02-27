import { Calendar, CheckCircle2, ClipboardList, MessageCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { KidarioButton } from "@/components/ui/KidarioButton";
import { type TeacherAgendaControlLesson } from "@/domains/teacher/api/backendTeacherControl";
import { buildTeacherLessonClosurePath } from "@/domains/teacher/lib/teacherRoutes";

const statusLabelByBooking = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
} as const;

const statusClassNameByBooking = {
  pendente: "bg-warning/10 text-warning",
  confirmada: "bg-success/10 text-success",
  cancelada: "bg-destructive/10 text-destructive",
  concluida: "bg-primary/10 text-primary",
} as const;

const modalityLabelByLesson = {
  online: "Online",
  presencial: "Presencial",
} as const;

interface TeacherAgendaLessonCardProps {
  lesson: TeacherAgendaControlLesson;
  isEditing: boolean;
  currentDate: string;
  currentTime: string;
  minDateIso: string;
  onOpenChat: (params: { bookingId: string; threadId?: string | null }) => void;
  onAccept: (bookingId: string) => void;
  onReject: (bookingId: string) => void;
  onToggleReschedule: (bookingId: string) => void;
  onRescheduleDateChange: (bookingId: string, dateIso: string) => void;
  onRescheduleTimeChange: (bookingId: string, time: string) => void;
  onSaveReschedule: (bookingId: string) => void;
  onCancelReschedule: () => void;
  onViewActivityPlan: (lessonId: string) => void;
}

export function TeacherAgendaLessonCard({
  lesson,
  isEditing,
  currentDate,
  currentTime,
  minDateIso,
  onOpenChat,
  onAccept,
  onReject,
  onToggleReschedule,
  onRescheduleDateChange,
  onRescheduleTimeChange,
  onSaveReschedule,
  onCancelReschedule,
  onViewActivityPlan,
}: TeacherAgendaLessonCardProps) {
  const isConcluded = lesson.status === "concluida";
  const canViewActivityPlan = lesson.status === "confirmada" || lesson.status === "concluida";

  return (
    <div className="card-kidario p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{lesson.child_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <Calendar className="inline w-3.5 h-3.5 mr-1" />
            {lesson.date_label} às {lesson.time}
          </p>
          <p className="text-xs text-muted-foreground">
            {modalityLabelByLesson[lesson.modality]} • {lesson.duration_minutes} minutos
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClassNameByBooking[lesson.status]}`}>
          {statusLabelByBooking[lesson.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {canViewActivityPlan ? (
          <KidarioButton size="sm" variant="outline" onClick={() => onViewActivityPlan(lesson.id)}>
            <ClipboardList className="w-4 h-4" />
            Ver plan
          </KidarioButton>
        ) : null}

        {lesson.actions.can_open_chat ? (
          <KidarioButton
            size="sm"
            variant="outline"
            onClick={() => onOpenChat({ bookingId: lesson.id, threadId: lesson.chat_thread_id })}
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </KidarioButton>
        ) : null}

        {isConcluded ? (
          <KidarioButton asChild size="sm" variant="outline">
            <Link to={buildTeacherLessonClosurePath(lesson.id)}>Editar revisão</Link>
          </KidarioButton>
        ) : (
          <>
            {lesson.actions.can_accept ? (
              <KidarioButton size="sm" variant="outline" onClick={() => onAccept(lesson.id)}>
                <CheckCircle2 className="w-4 h-4" />
                Aceitar
              </KidarioButton>
            ) : null}

            {lesson.actions.can_reject ? (
              <KidarioButton size="sm" variant="outline" onClick={() => onReject(lesson.id)}>
                <XCircle className="w-4 h-4" />
                Recusar
              </KidarioButton>
            ) : null}

            {lesson.actions.can_reschedule ? (
              <KidarioButton size="sm" variant="outline" onClick={() => onToggleReschedule(lesson.id)}>
                Reagendar
              </KidarioButton>
            ) : null}

            {lesson.actions.can_complete ? (
              <KidarioButton asChild size="sm" variant="outline">
                <Link to={buildTeacherLessonClosurePath(lesson.id)}>Cerrar clase</Link>
              </KidarioButton>
            ) : null}
          </>
        )}
      </div>

      {isEditing && !isConcluded ? (
        <div className="rounded-xl border border-border/70 p-3 space-y-3">
          <p className="text-xs text-muted-foreground">Novo horário da aula</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              value={currentDate}
              min={minDateIso}
              onChange={(event) => onRescheduleDateChange(lesson.id, event.target.value)}
            />
            <input
              type="time"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              value={currentTime}
              onChange={(event) => onRescheduleTimeChange(lesson.id, event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <KidarioButton size="sm" variant="hero" onClick={() => onSaveReschedule(lesson.id)}>
              Confirmar reagendamento
            </KidarioButton>
            <KidarioButton size="sm" variant="ghost" onClick={onCancelReschedule}>
              Cancelar
            </KidarioButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
