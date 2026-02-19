export type UserRole = "parent" | "teacher" | null;

export interface AuthSession {
  isAuthenticated: boolean;
  role: UserRole;
  email?: string;
  fullName?: string;
}

const AUTH_SESSION_KEY = "kidario_auth_session_v1";
const SUPABASE_TOKENS_KEY = "kidario_supabase_tokens_v1";
const SUPABASE_AUTH_VERSION = "v1";

const defaultSession: AuthSession = {
  isAuthenticated: false,
  role: null,
};

interface SupabaseTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

interface StoredAuthMetadata {
  role?: UserRole;
  email?: string;
  fullName?: string;
}

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: {
    email?: string;
    identities?: Array<{ id?: string }> | null;
    user_metadata?: {
      full_name?: string;
      role?: UserRole;
    };
  };
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  } | null;
  msg?: string;
  error?: string;
  error_description?: string;
}

interface SignUpParams {
  email: string;
  password: string;
  fullName?: string;
  role?: UserRole;
  metadata?: Record<string, unknown>;
}

interface SignInParams {
  email: string;
  password: string;
  roleHint?: UserRole;
}

interface SignUpResult {
  session: AuthSession;
  emailConfirmationRequired: boolean;
}

interface RecoveryTokens {
  accessToken: string;
  refreshToken?: string;
  type?: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

function getStoredTokens(): SupabaseTokens | null {
  if (!canUseStorage()) return null;

  const rawValue = window.localStorage.getItem(SUPABASE_TOKENS_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<SupabaseTokens>;
    if (!parsed.accessToken) return null;

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn,
      tokenType: parsed.tokenType,
    };
  } catch {
    return null;
  }
}

function saveSupabaseTokens(tokens: SupabaseTokens) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SUPABASE_TOKENS_KEY, JSON.stringify(tokens));
}

function clearSupabaseTokens() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SUPABASE_TOKENS_KEY);
}

function normalizeRole(value: unknown): UserRole {
  return value === "parent" || value === "teacher" ? value : null;
}

function getStoredAuthMetadata(): StoredAuthMetadata | null {
  if (!canUseStorage()) return null;

  const rawValue = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>;
    return {
      role: normalizeRole(parsed.role),
      email: parsed.email,
      fullName: parsed.fullName,
    };
  } catch {
    return null;
  }
}

async function supabaseAuthRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: Record<string, unknown>;
    accessToken?: string;
  } = {},
) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const { method = "GET", body, accessToken } = options;

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${supabaseUrl}/auth/${SUPABASE_AUTH_VERSION}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as SupabaseAuthResponse;

  if (!response.ok) {
    const message = payload.msg || payload.error_description || payload.error || "Erro de autenticação.";
    throw new Error(message);
  }

  return payload;
}

export function getAuthSession(): AuthSession {
  const tokens = getStoredTokens();
  const hasValidTokens = Boolean(tokens?.accessToken);
  const metadata = getStoredAuthMetadata();

  if (!canUseStorage()) return defaultSession;

  if (!hasValidTokens) {
    return {
      ...defaultSession,
      role: metadata?.role ?? null,
      email: metadata?.email,
      fullName: metadata?.fullName,
    };
  }

  return {
    isAuthenticated: true,
    role: metadata?.role ?? null,
    email: metadata?.email,
    fullName: metadata?.fullName,
  };
}

export function saveAuthSession(session: AuthSession) {
  if (!canUseStorage()) return;
  const metadata: StoredAuthMetadata = {
    role: normalizeRole(session.role),
    email: session.email,
    fullName: session.fullName,
  };
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(metadata));
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  clearSupabaseTokens();
}

export function isAuthenticated() {
  return getAuthSession().isAuthenticated;
}

export function hasSupabaseBearerToken() {
  return Boolean(getSupabaseAccessToken());
}

export function getSupabaseAccessToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.accessToken ?? null;
}

export async function signUpWithEmailPassword({
  email,
  password,
  fullName,
  role = "parent",
  metadata,
}: SignUpParams): Promise<SignUpResult> {
  const signupMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
    full_name: fullName,
    role,
  };

  const payload = await supabaseAuthRequest("signup", {
    method: "POST",
    body: {
      email,
      password,
      data: signupMetadata,
    },
  });

  const sessionFromSignup = payload.session;
  const hasSession = Boolean(sessionFromSignup?.access_token && sessionFromSignup?.refresh_token);
  const duplicateSignupDetected =
    !hasSession &&
    Array.isArray(payload.user?.identities) &&
    payload.user.identities.length === 0;

  if (duplicateSignupDetected) {
    clearAuthSession();
    throw new Error("Este e-mail já está cadastrado. Faça login ou confirme o e-mail da conta existente.");
  }

  const sessionRole = normalizeRole(payload.user?.user_metadata?.role) || role;

  if (hasSession) {
    saveSupabaseTokens({
      accessToken: sessionFromSignup?.access_token || "",
      refreshToken: sessionFromSignup?.refresh_token || "",
      expiresIn: sessionFromSignup?.expires_in,
      tokenType: sessionFromSignup?.token_type,
    });
  } else {
    clearSupabaseTokens();
  }

  const nextSession: AuthSession = {
    isAuthenticated: hasSession,
    role: sessionRole,
    email: payload.user?.email || email,
    fullName: payload.user?.user_metadata?.full_name || fullName,
  };

  saveAuthSession(nextSession);

  return {
    session: nextSession,
    emailConfirmationRequired: !hasSession,
  };
}

export async function signInWithEmailPassword({
  email,
  password,
  roleHint = null,
}: SignInParams): Promise<AuthSession> {
  const payload = await supabaseAuthRequest("token?grant_type=password", {
    method: "POST",
    body: {
      email,
      password,
    },
  });

  if (!payload.access_token || !payload.refresh_token) {
    throw new Error("Falha ao criar sessão. Verifique as configurações de Auth no Supabase.");
  }

  saveSupabaseTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    tokenType: payload.token_type,
  });

  const previousSession = getAuthSession();
  const role = normalizeRole(payload.user?.user_metadata?.role) || roleHint || previousSession.role;

  const nextSession: AuthSession = {
    isAuthenticated: true,
    role,
    email: payload.user?.email || email,
    fullName: payload.user?.user_metadata?.full_name || previousSession.fullName,
  };

  saveAuthSession(nextSession);
  return nextSession;
}

export async function signOutFromSupabase() {
  const tokens = getStoredTokens();

  try {
    if (tokens?.accessToken) {
      await supabaseAuthRequest("logout", {
        method: "POST",
        accessToken: tokens.accessToken,
      });
    }
  } catch {
    // We still clear local session in case remote logout fails
  } finally {
    clearAuthSession();
  }
}

export async function requestPasswordRecovery(email: string, redirectTo?: string) {
  const body: Record<string, unknown> = { email };
  if (redirectTo) {
    body.redirect_to = redirectTo;
  }

  await supabaseAuthRequest("recover", {
    method: "POST",
    body,
  });
}

export function getRecoveryTokensFromUrlHash(): RecoveryTokens | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash?.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token") ?? params.get("access-token");
  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: params.get("refresh_token") ?? params.get("refresh-token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

export async function updatePasswordWithRecoveryToken(accessToken: string, password: string) {
  await supabaseAuthRequest("user", {
    method: "PUT",
    accessToken,
    body: {
      password,
    },
  });

  clearAuthSession();
}
