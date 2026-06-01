import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { TeacherAgendaLessonCard } from "./TeacherAgendaLessonCard";
import type { TeacherAgendaControlLesson } from "@/types/teacher";

const baseLesson: TeacherAgendaControlLesson = {
  id: "booking-1",
  child_id: "child-1",
  child_name: "Luca",
  parent_id: "parent-1",
  parent_profile_id: "parent-1",
  starts_at: "2026-06-01T12:00:00-03:00",
  date_iso: "2026-06-01",
  date_label: "Seg. 01/06",
  time: "12:00",
  duration_minutes: 60,
  modality: "online",
  status: "pendente",
  teacher_decision_status: "pending",
  payment_flow_status: "authorized",
  chat_thread_id: null,
  has_unread_messages: false,
  completed_lessons_with_child: 0,
  objectives: [],
  parent_focus_points: [],
  activity_plan_source: "fallback",
  activity_plan: [],
  actions: {
    can_accept: false,
    can_reject: false,
    can_reschedule: false,
    can_open_chat: false,
    can_complete: false,
  },
};

function renderCard(lesson: TeacherAgendaControlLesson) {
  render(
    <MemoryRouter>
      <TeacherAgendaLessonCard
        lesson={lesson}
        isEditing={false}
        currentDate="2026-06-01"
        currentTime="12:00"
        minDateIso="2026-06-01"
        onOpenChat={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onToggleReschedule={vi.fn()}
        onRescheduleDateChange={vi.fn()}
        onRescheduleTimeChange={vi.fn()}
        onSaveReschedule={vi.fn()}
        onCancelReschedule={vi.fn()}
        onViewActivityPlan={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("TeacherAgendaLessonCard", () => {
  it("shows rejected pending lessons as recusada", () => {
    renderCard({
      ...baseLesson,
      teacher_decision_status: "rejected",
      payment_flow_status: "failed",
    });

    expect(screen.getByText("Recusada")).toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
    expect(screen.getByText("Horário recusado")).toBeInTheDocument();
  });
});
