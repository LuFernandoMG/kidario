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

export function buildTeacherProfilePhotoPublicUrl(rawPath: string): string | null {
  if (!rawPath.trim()) return null;

  const { supabaseUrl } = getSupabaseConfig();
  const bucket = getTeacherProfilePhotosBucket();
  const objectPath = normalizeObjectPath(rawPath, bucket);
  if (!objectPath) return null;

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
}
