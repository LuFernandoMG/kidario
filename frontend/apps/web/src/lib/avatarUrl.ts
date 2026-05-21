import { buildTeacherProfilePhotoPublicUrl } from "@/lib/supabaseStorage";

export const DEFAULT_TEACHER_AVATAR =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face";

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

export function resolveTeacherAvatarUrl(rawValue?: string | null) {
  const value = rawValue?.trim();
  if (!value) return DEFAULT_TEACHER_AVATAR;
  if (isAbsoluteUrl(value)) return value;

  try {
    return buildTeacherProfilePhotoPublicUrl(value) || DEFAULT_TEACHER_AVATAR;
  } catch {
    return DEFAULT_TEACHER_AVATAR;
  }
}
