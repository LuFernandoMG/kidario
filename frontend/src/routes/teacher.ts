export const TEACHER_CONTROL_CENTER_PATH = "/inicio";
export const TEACHER_AGENDA_PATH = "/agenda";
export const TEACHER_STUDENTS_PATH = "/alunos";
export const TEACHER_PLANNING_PATH = "/planejamento";
export const TEACHER_FINANCE_PATH = "/financeiro";
export const TEACHER_LESSON_CLOSURE_PATH = "/aulas/:bookingId/cierre";
export const TEACHER_PRIVATE_SIGNUP_PATH =
  "/convites/professoras/cadastro-privado-kidario-a8k3m2";

export function buildTeacherLessonClosurePath(bookingId: string) {
  return `/aulas/${bookingId}/cierre`;
}
