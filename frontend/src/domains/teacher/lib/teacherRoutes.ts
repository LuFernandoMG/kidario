export const TEACHER_CONTROL_CENTER_PATH = "/inicio";
export const TEACHER_AGENDA_PATH = "/agenda";
export const TEACHER_STUDENTS_PATH = "/alunos";
export const TEACHER_PLANNING_PATH = "/planejamento";
export const TEACHER_FINANCE_PATH = "/financeiro";
export const TEACHER_LESSON_CLOSURE_PATH = "/aulas/:bookingId/cierre";

export function buildTeacherLessonClosurePath(bookingId: string) {
  return `/aulas/${bookingId}/cierre`;
}
