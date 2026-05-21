export const ROOT_PATH = "/";
export const LOGIN_PATH = "/login";
export const RECOVER_PASSWORD_PATH = "/recuperar-senha";
export const RESET_PASSWORD_PATH = "/redefinir-senha";
export const SIGNUP_PATH = "/cadastro";
export const EXPLORE_PATH = "/explorar";
export const TEACHER_PROFILE_PATH = "/professora/:id";
export const BOOKING_SCHEDULER_PATH = "/agendar/:id";
export const CHECKOUT_PATH = "/checkout/:id";
export const BOOKING_CONFIRMATION_PATH = "/confirmacao-reserva/:bookingId";
export const BOOKING_DETAIL_PATH = "/aula/:bookingId";
export const CHAT_PATH = "/chat/:threadId";
export const AGENDA_PATH = "/agenda";
export const PROGRESS_PATH = "/progresso";
export const PROFILE_PATH = "/perfil";
export const PARENT_PROFILE_SETTINGS_PATH = "/perfil/responsavel";
export const TEACHER_PROFILE_SETTINGS_PATH = "/perfil/professora";
export const TEACHER_CONTROL_CENTER_PATH = "/inicio";
export const TEACHER_AGENDA_PATH = "/agenda";
export const TEACHER_STUDENTS_PATH = "/alunos";
export const TEACHER_PLANNING_PATH = "/planejamento";
export const TEACHER_FINANCE_PATH = "/financeiro";
export const TEACHER_LESSON_CLOSURE_PATH = "/aulas/:bookingId/cierre";
export const TEACHER_PRIVATE_SIGNUP_PATH =
  "/convites/professoras/cadastro-privado-kidario-a8k3m2";
export const TEACHER_PRIVATE_SIGNUP_LEGACY_PATH = "/escolher-professora";
export const TEACHER_CONTROL_CENTER_LEGACY_PATHS = [
  "/professora/centro",
  "/professora/inicio",
] as const;
export const TEACHER_AGENDA_LEGACY_PATH = "/professora/agenda";
export const TEACHER_STUDENTS_LEGACY_PATH = "/professora/alunos";
export const TEACHER_PLANNING_LEGACY_PATH = "/professora/planejamento";
export const TEACHER_FINANCE_LEGACY_PATH = "/professora/financeiro";

const BLOCKED_MOBILE_PATHS = new Set(["/interno/admin/painel-registros-kidario-r9t2"]);

export const frontendRoutes = {
  canonical: {
    root: ROOT_PATH,
    login: LOGIN_PATH,
    recoverPassword: RECOVER_PASSWORD_PATH,
    resetPassword: RESET_PASSWORD_PATH,
    signup: SIGNUP_PATH,
    explore: EXPLORE_PATH,
    teacherProfileTemplate: TEACHER_PROFILE_PATH,
    bookingSchedulerTemplate: BOOKING_SCHEDULER_PATH,
    checkoutTemplate: CHECKOUT_PATH,
    bookingConfirmationTemplate: BOOKING_CONFIRMATION_PATH,
    bookingDetailTemplate: BOOKING_DETAIL_PATH,
    chatTemplate: CHAT_PATH,
    agenda: AGENDA_PATH,
    progress: PROGRESS_PATH,
    profile: PROFILE_PATH,
    parentProfileSettings: PARENT_PROFILE_SETTINGS_PATH,
    teacherProfileSettings: TEACHER_PROFILE_SETTINGS_PATH,
    teacherControlCenter: TEACHER_CONTROL_CENTER_PATH,
    teacherStudents: TEACHER_STUDENTS_PATH,
    teacherPlanning: TEACHER_PLANNING_PATH,
    teacherFinance: TEACHER_FINANCE_PATH,
    teacherLessonClosureTemplate: TEACHER_LESSON_CLOSURE_PATH,
    teacherPrivateSignup: TEACHER_PRIVATE_SIGNUP_PATH,
  },
  legacy: {
    teacherPrivateSignup: TEACHER_PRIVATE_SIGNUP_LEGACY_PATH,
    teacherControlCenter: TEACHER_CONTROL_CENTER_LEGACY_PATHS,
    teacherAgenda: TEACHER_AGENDA_LEGACY_PATH,
    teacherStudents: TEACHER_STUDENTS_LEGACY_PATH,
    teacherPlanning: TEACHER_PLANNING_LEGACY_PATH,
    teacherFinance: TEACHER_FINANCE_LEGACY_PATH,
  },
} as const;

const handledStaticPaths = new Set([
  ROOT_PATH,
  LOGIN_PATH,
  RECOVER_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  SIGNUP_PATH,
  EXPLORE_PATH,
  AGENDA_PATH,
  PROGRESS_PATH,
  PROFILE_PATH,
  PARENT_PROFILE_SETTINGS_PATH,
  TEACHER_PROFILE_SETTINGS_PATH,
  TEACHER_CONTROL_CENTER_PATH,
  TEACHER_STUDENTS_PATH,
  TEACHER_PLANNING_PATH,
  TEACHER_FINANCE_PATH,
  TEACHER_PRIVATE_SIGNUP_PATH,
  TEACHER_PRIVATE_SIGNUP_LEGACY_PATH,
  ...TEACHER_CONTROL_CENTER_LEGACY_PATHS,
  TEACHER_AGENDA_LEGACY_PATH,
  TEACHER_STUDENTS_LEGACY_PATH,
  TEACHER_PLANNING_LEGACY_PATH,
  TEACHER_FINANCE_LEGACY_PATH,
]);

const handledDynamicPatterns = [
  /^\/professora\/[^/]+$/,
  /^\/agendar\/[^/]+$/,
  /^\/checkout\/[^/]+$/,
  /^\/confirmacao-reserva\/[^/]+$/,
  /^\/aula\/[^/]+$/,
  /^\/chat\/[^/]+$/,
  /^\/aulas\/[^/]+\/cierre$/,
];

function encodePathParam(value: string) {
  return encodeURIComponent(value);
}

export function normalizeFrontendPath(path: string) {
  if (!path) {
    return ROOT_PATH;
  }

  const next = path.startsWith("/") ? path : `/${path}`;
  return next.length > 1 ? next.replace(/\/+$/, "") : next;
}

export function isBlockedMobilePath(path: string) {
  return BLOCKED_MOBILE_PATHS.has(normalizeFrontendPath(path));
}

export function isKnownFrontendPath(path: string) {
  const normalizedPath = normalizeFrontendPath(path);
  return (
    handledStaticPaths.has(normalizedPath) ||
    handledDynamicPatterns.some((pattern) => pattern.test(normalizedPath))
  );
}

export function buildTeacherProfilePath(id: string) {
  return `/professora/${encodePathParam(id)}`;
}

export function buildBookingSchedulerPath(id: string) {
  return `/agendar/${encodePathParam(id)}`;
}

export function buildCheckoutPath(id: string) {
  return `/checkout/${encodePathParam(id)}`;
}

export function buildBookingConfirmationPath(bookingId: string) {
  return `/confirmacao-reserva/${encodePathParam(bookingId)}`;
}

export function buildBookingDetailPath(bookingId: string) {
  return `/aula/${encodePathParam(bookingId)}`;
}

export function buildChatPath(threadId: string) {
  return `/chat/${encodePathParam(threadId)}`;
}

export function buildTeacherLessonClosurePath(bookingId: string) {
  return `/aulas/${encodePathParam(bookingId)}/cierre`;
}

export function buildFrontendPathFromSegments(segments: string[]) {
  if (!segments.length) {
    return ROOT_PATH;
  }

  return `/${segments.filter(Boolean).map((segment) => encodePathParam(segment)).join("/")}`;
}

export function buildFrontendPathWithQuery(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
      continue;
    }

    searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}
