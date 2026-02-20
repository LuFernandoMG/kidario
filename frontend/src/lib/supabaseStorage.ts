function getSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Configuracao do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
  };
}

export function getTeacherProfilePhotosBucket() {
  return import.meta.env.VITE_SUPABASE_PROFILE_PHOTOS_BUCKET?.trim() || "teacher-profile-photos";
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeObjectPath(rawPath: string, bucket: string) {
  const normalized = rawPath.trim().replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.startsWith(`${bucket}/`)) {
    return normalized.slice(bucket.length + 1);
  }
  return normalized;
}

function sanitizeFileName(fileName: string) {
  const extensionMatch = fileName.match(/\.[a-zA-Z0-9]+$/);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : "";
  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const safeBase = baseName || "profile-photo";
  return `${safeBase}${extension}`;
}

function sanitizeEmail(email: string) {
  return email
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildTeacherProfilePhotoPublicUrl(rawPath: string): string | null {
  if (!rawPath.trim()) return null;

  const { supabaseUrl } = getSupabaseConfig();
  const bucket = getTeacherProfilePhotosBucket();
  const objectPath = normalizeObjectPath(rawPath, bucket);
  if (!objectPath) return null;

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
}

export async function uploadTeacherProfilePhoto(params: {
  accessToken: string;
  file: File;
  email: string;
}): Promise<string> {
  const { accessToken, file, email } = params;
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const bucket = getTeacherProfilePhotosBucket();

  const safeEmail = sanitizeEmail(email) || "teacher";
  const safeFileName = sanitizeFileName(file.name);
  const objectPath = `${safeEmail}/${Date.now()}-${safeFileName}`;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(objectPath)}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "x-upsert": "true",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const reason =
      payload && typeof payload === "object"
        ? (payload as { error?: string; message?: string }).message ||
          (payload as { error?: string; message?: string }).error
        : null;
    throw new Error(reason || "Nao foi possivel enviar a foto de perfil.");
  }

  return objectPath;
}
