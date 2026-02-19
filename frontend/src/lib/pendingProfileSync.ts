import type { UserRole } from "@/lib/authSession";
import {
  patchParentProfile,
  patchTeacherProfile,
  type ParentProfilePatchPayload,
  type TeacherProfilePatchPayload,
} from "@/lib/backendProfiles";

const PENDING_PROFILE_SYNC_KEY = "kidario_pending_profile_sync_v1";

interface PendingParentProfileSync {
  role: "parent";
  email: string;
  payload: ParentProfilePatchPayload;
  createdAt: string;
}

interface PendingTeacherProfileSync {
  role: "teacher";
  email: string;
  payload: TeacherProfilePatchPayload;
  createdAt: string;
}

type PendingProfileSync = PendingParentProfileSync | PendingTeacherProfileSync;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readPendingProfileSync(): PendingProfileSync | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(PENDING_PROFILE_SYNC_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingProfileSync>;
    if (!parsed.role || !parsed.email || !parsed.payload) return null;
    if (parsed.role !== "parent" && parsed.role !== "teacher") return null;

    return {
      role: parsed.role,
      email: parsed.email,
      payload: parsed.payload as PendingProfileSync["payload"],
      createdAt: parsed.createdAt || new Date(0).toISOString(),
    } as PendingProfileSync;
  } catch {
    return null;
  }
}

export function savePendingProfileSync(
  draft: Omit<PendingParentProfileSync, "createdAt"> | Omit<PendingTeacherProfileSync, "createdAt">,
) {
  if (!canUseStorage()) return;

  const payload: PendingProfileSync = {
    ...draft,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(PENDING_PROFILE_SYNC_KEY, JSON.stringify(payload));
}

export function clearPendingProfileSync() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PENDING_PROFILE_SYNC_KEY);
}

export async function syncPendingProfileIfNeeded(params: {
  accessToken: string;
  role: UserRole;
  email?: string;
}) {
  const pending = readPendingProfileSync();
  if (!pending) return;

  const sessionEmail = params.email?.trim().toLowerCase();
  const pendingEmail = pending.email.trim().toLowerCase();
  if (!sessionEmail || sessionEmail !== pendingEmail) return;
  if (params.role !== pending.role) return;

  if (pending.role === "parent") {
    await patchParentProfile(params.accessToken, pending.payload);
  } else {
    await patchTeacherProfile(params.accessToken, pending.payload);
  }

  clearPendingProfileSync();
}
