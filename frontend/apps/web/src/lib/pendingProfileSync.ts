import type { UserRole } from "@/lib/authSession";
import {
  patchParentProfile,
  type ParentProfilePatchPayload,
} from "@/data/api/parentProfiles";
import {
  patchTeacherProfile,
  type TeacherProfilePatchPayload,
  uploadTeacherProfilePhoto,
} from "@/data/api/teacherProfiles";

const PENDING_PROFILE_SYNC_KEY = "kidario_pending_profile_sync_v1";
const PENDING_TEACHER_PHOTO_DB_NAME = "kidario_pending_teacher_photo_v1";
const PENDING_TEACHER_PHOTO_STORE = "teacherProfilePhotos";

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

interface PendingTeacherProfilePhotoRecord {
  email: string;
  file: Blob;
  fileName: string;
  contentType: string;
  createdAt: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function openPendingTeacherPhotoDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(PENDING_TEACHER_PHOTO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_TEACHER_PHOTO_STORE)) {
        db.createObjectStore(PENDING_TEACHER_PHOTO_STORE, { keyPath: "email" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
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

export async function savePendingTeacherProfilePhoto(params: {
  email: string;
  file: File;
}): Promise<boolean> {
  const email = normalizeEmail(params.email);
  if (!email) return false;

  const db = await openPendingTeacherPhotoDb();
  if (!db) return false;

  return new Promise((resolve) => {
    const transaction = db.transaction(PENDING_TEACHER_PHOTO_STORE, "readwrite");
    const store = transaction.objectStore(PENDING_TEACHER_PHOTO_STORE);
    const record: PendingTeacherProfilePhotoRecord = {
      email,
      file: params.file,
      fileName: params.file.name,
      contentType: params.file.type,
      createdAt: new Date().toISOString(),
    };

    store.put(record);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };
    transaction.onerror = () => {
      db.close();
      resolve(false);
    };
    transaction.onabort = () => {
      db.close();
      resolve(false);
    };
  });
}

async function readPendingTeacherProfilePhoto(email: string): Promise<File | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const db = await openPendingTeacherPhotoDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const transaction = db.transaction(PENDING_TEACHER_PHOTO_STORE, "readonly");
    const request = transaction.objectStore(PENDING_TEACHER_PHOTO_STORE).get(normalizedEmail);

    request.onsuccess = () => {
      const record = request.result as PendingTeacherProfilePhotoRecord | undefined;
      if (!record?.file || !(record.file instanceof Blob)) {
        resolve(null);
        return;
      }

      resolve(
        new File(
          [record.file],
          record.fileName || "profile-photo.jpg",
          { type: record.contentType || record.file.type || "image/jpeg" },
        ),
      );
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      resolve(null);
    };
    transaction.onabort = () => {
      db.close();
      resolve(null);
    };
  });
}

export async function clearPendingTeacherProfilePhoto(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const db = await openPendingTeacherPhotoDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(PENDING_TEACHER_PHOTO_STORE, "readwrite");
    transaction.objectStore(PENDING_TEACHER_PHOTO_STORE).delete(normalizedEmail);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
    transaction.onabort = () => {
      db.close();
      resolve();
    };
  });
}

export async function syncPendingProfileIfNeeded(params: {
  accessToken: string;
  role: UserRole;
  email?: string;
}) {
  const sessionEmail = normalizeEmail(params.email || "");
  const pending = readPendingProfileSync();

  if (pending && sessionEmail) {
    const pendingEmail = normalizeEmail(pending.email);
    if (sessionEmail === pendingEmail && params.role === pending.role) {
      if (pending.role === "parent") {
        await patchParentProfile(params.accessToken, pending.payload);
      } else {
        await patchTeacherProfile(params.accessToken, pending.payload);
      }

      clearPendingProfileSync();
    }
  }

  if (params.role === "teacher" && sessionEmail) {
    const pendingPhoto = await readPendingTeacherProfilePhoto(sessionEmail);
    if (pendingPhoto) {
      await uploadTeacherProfilePhoto(params.accessToken, pendingPhoto);
      await clearPendingTeacherProfilePhoto(sessionEmail);
    }
  }
}
