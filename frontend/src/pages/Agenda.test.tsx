import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Agenda from "@/pages/Agenda";

const mockGetAuthSession = vi.fn();
const mockGetSupabaseAccessToken = vi.fn();
const mockGetParentAgenda = vi.fn();

vi.mock("@/lib/authSession", () => ({
  getAuthSession: () => mockGetAuthSession(),
  getSupabaseAccessToken: () => mockGetSupabaseAccessToken(),
}));

vi.mock("@/lib/backendBookings", () => ({
  getParentAgenda: (...args: unknown[]) => mockGetParentAgenda(...args),
}));

describe("Agenda page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockReturnValue({ isAuthenticated: true, role: "parent" });
    mockGetSupabaseAccessToken.mockReturnValue("token");
  });

  it("renders backend bookings list for parent", async () => {
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
          status: "confirmada",
          created_at_iso: "2026-02-01T10:00:00Z",
          updated_at_iso: "2026-02-01T10:00:00Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ana Carolina Silva")).toBeInTheDocument();
    expect(screen.getByText("Alfabetizacao")).toBeInTheDocument();
  });

  it("shows backend error in portuguese fallback", async () => {
    mockGetParentAgenda.mockRejectedValue(new Error("Nao autorizado"));

    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nao autorizado")).toBeInTheDocument();
  });
});
