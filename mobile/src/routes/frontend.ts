export const frontendRoutes = {
  shared: {
    root: "/",
    login: "/login",
    recoverPassword: "/recuperar-senha",
    resetPassword: "/redefinir-senha",
  },
  parent: {
    signup: "/cadastro",
    explore: "/explorar",
    agenda: "/agenda",
    profile: "/perfil",
    chatTemplate: "/chat/:threadId",
  },
  teacher: {
    home: "/inicio",
    agenda: "/agenda",
    students: "/alunos",
    planning: "/planejamento",
    finance: "/financeiro",
    privateSignup: "/convites/professoras/cadastro-privado-kidario-a8k3m2",
  },
} as const;

export function buildFrontendChatPath(threadId: string) {
  return `/chat/${encodeURIComponent(threadId)}`;
}
