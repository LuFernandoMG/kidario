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
