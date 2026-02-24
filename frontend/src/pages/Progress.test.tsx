import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Progress from "@/pages/Progress";

const mockGetSupabaseAccessToken = vi.fn();
const mockGetParentProfile = vi.fn();
const mockGetParentAgenda = vi.fn();
const mockGetBookingDetail = vi.fn();

vi.mock("@/lib/authSession", () => ({
  getSupabaseAccessToken: () => mockGetSupabaseAccessToken(),
}));

vi.mock("@/lib/backendProfiles", () => ({
  getParentProfile: (...args: unknown[]) => mockGetParentProfile(...args),
}));

vi.mock("@/lib/backendBookings", () => ({
  getParentAgenda: (...args: unknown[]) => mockGetParentAgenda(...args),
  getBookingDetail: (...args: unknown[]) => mockGetBookingDetail(...args),
}));

describe("Progress page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAccessToken.mockReturnValue("token");
  });

  it("renders follow-up entries from backend data", async () => {
    mockGetParentProfile.mockResolvedValue({
      profile: { id: "parent-1", role: "parent", email: "parent@example.com" },
      children: [{ id: "child-1", name: "Luca" }],
    });
    mockGetParentAgenda.mockResolvedValue({
      lessons: [
        {
          id: "booking-1",
          teacher_id: "teacher-1",
          teacher_name: "Ana Carolina Silva",
          teacher_avatar_url: null,
          specialty: "Alfabetizacao",
          child_id: "child-1",
          child_name: "Luca",
          date_iso: "2026-02-20",
          date_label: "20/02/2026",
          time: "14:00",
          modality: "online",
          status: "concluida",
          created_at_iso: "2026-02-01T10:00:00Z",
          updated_at_iso: "2026-02-01T10:00:00Z",
        },
      ],
    });
    mockGetBookingDetail.mockResolvedValue({
      id: "booking-1",
      parent_profile_id: "parent-1",
      child_id: "child-1",
      child_name: "Luca",
      teacher_id: "teacher-1",
      teacher_name: "Ana Carolina Silva",
      date_iso: "2026-02-20",
      date_label: "20/02/2026",
      time: "14:00",
      duration_minutes: 60,
      modality: "online",
      status: "concluida",
      price_total: 120,
      currency: "BRL",
      cancellation_reason: null,
      latest_follow_up: {
        updated_at: "2026-02-21T10:00:00Z",
        summary: "Evolucao consistente em leitura.",
        next_steps: "Manter pratica diaria.",
        tags: ["Leitura"],
        attention_points: [],
      },
      actions: {
        can_reschedule: false,
        can_cancel: false,
        can_complete: false,
      },
    });

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Evolucao consistente em leitura.")).toBeInTheDocument();
    expect(screen.getByText(/Proximos passos:/i)).toBeInTheDocument();
    expect(screen.getByText("Ana Carolina Silva")).toBeInTheDocument();
  });
});
