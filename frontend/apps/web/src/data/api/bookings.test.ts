import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_BACKEND_API_URL", "https://backend.test/api/v2");

vi.mock("@/lib/authSession", () => ({
  getValidSupabaseAccessToken: async () => "resolved-token",
  handleExpiredSessionRedirect: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  buildRequestIdHeader: () => ({ "X-Request-ID": "test-request" }),
}));

import { getParentAgenda, getTeacherAvailabilitySlots } from "@/data/api/bookings";

describe("bookings api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps backend availability slots as the canonical scheduling source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          teacher_id: "teacher-1",
          teacher_profile_id: "teacher-1",
          slots: [
            {
              date_iso: "2026-06-01",
              date_label: "seg. 01/06",
              times: ["12:00", "14:30"],
            },
          ],
        }),
      }),
    );

    await expect(
      getTeacherAvailabilitySlots("token", {
        teacherProfileId: "teacher-1",
        from: "2026-06-01",
        to: "2026-06-07",
        durationMinutes: 60,
      }),
    ).resolves.toEqual({
      teacher_id: "teacher-1",
      teacher_profile_id: "teacher-1",
      slots: [
        {
          date_iso: "2026-06-01",
          date_label: "Seg. 01/06",
          times: ["12:00", "14:30"],
        },
      ],
    });
  });

  it("normalizes legacy backend time shapes without changing the source day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          teacher_id: "teacher-1",
          slots: [
            {
              date: "2026-06-01",
              starts_at: ["2026-06-01T12:00:00-03:00", "14:30:00", "14:30"],
            },
          ],
        }),
      }),
    );

    const response = await getTeacherAvailabilitySlots("token", {
      teacherProfileId: "teacher-1",
      from: "2026-06-01",
      to: "2026-06-07",
      durationMinutes: 60,
    });

    expect(response.slots[0]).toEqual(
      expect.objectContaining({
        date_iso: "2026-06-01",
        times: ["12:00", "14:30"],
      }),
    );
  });

  it("keeps teacher rejection status in parent agenda lessons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bookings: [
            {
              id: "booking-1",
              parent_id: "parent-1",
              child_id: "child-1",
              teacher_id: "teacher-1",
              package_id: null,
              starts_at: "2026-06-01T12:00:00-03:00",
              duration_minutes: 60,
              modality: "online",
              status: "pendente",
              teacher_decision_status: "rejected",
              teacher_decision_reason: "Conflito de agenda",
              teacher_decision_at: "2026-05-31T12:00:00Z",
              payment_flow_status: "failed",
              cancellation_reason: null,
              confirmed_at: null,
              completed_at: null,
              canceled_at: null,
              created_at: "2026-05-31T11:00:00Z",
              updated_at: "2026-05-31T12:00:00Z",
              child: { id: "child-1", name: "Lucas" },
              teacher: { id: "teacher-1", display_name: "Ana Silva", profile_photo_url: null },
              parent: { id: "parent-1", display_name: "Maria Silva" },
              payment_order: null,
              latest_follow_up: null,
              actions: {
                can_reschedule: true,
                can_cancel: true,
                can_complete: false,
                can_review: false,
              },
            },
          ],
        }),
      }),
    );

    const response = await getParentAgenda("token", { tab: "upcoming" });

    expect(response.lessons[0]).toEqual(
      expect.objectContaining({
        status: "pendente",
        teacher_decision_status: "rejected",
        payment_flow_status: "failed",
      }),
    );
  });
});
