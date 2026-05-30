import type { TeacherPayoutProfile } from "@/data/api/payments";

export const TEACHER_PAYOUT_PROFILE_SAVED_EVENT = "kidario:teacher-payout-profile-saved";

export function notifyTeacherPayoutProfileSaved(profile: TeacherPayoutProfile) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<TeacherPayoutProfile>(TEACHER_PAYOUT_PROFILE_SAVED_EVENT, {
      detail: profile,
    }),
  );
}

export function getTeacherPayoutProfileSavedEventDetail(event: Event) {
  if (!(event instanceof CustomEvent) || event.type !== TEACHER_PAYOUT_PROFILE_SAVED_EVENT) {
    return null;
  }

  return event.detail as TeacherPayoutProfile;
}
