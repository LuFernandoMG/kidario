import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Chat from "@/pages/Chat";

const mockGetAuthSession = vi.fn();
const mockGetSupabaseAccessToken = vi.fn();
const mockGetChatThread = vi.fn();
const mockGetChatMessages = vi.fn();

vi.mock("@/lib/authSession", () => ({
  getAuthSession: () => mockGetAuthSession(),
  getSupabaseAccessToken: () => mockGetSupabaseAccessToken(),
}));

vi.mock("@/lib/backendChat", () => ({
  getChatThread: (...args: unknown[]) => mockGetChatThread(...args),
  getChatMessages: (...args: unknown[]) => mockGetChatMessages(...args),
  sendChatMessage: vi.fn(),
}));

describe("Chat page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockReturnValue({ isAuthenticated: true, role: "parent" });
    mockGetSupabaseAccessToken.mockReturnValue("header.eyJzdWIiOiJwYXJlbnQtMSJ9.signature");
    mockGetChatMessages.mockResolvedValue({ messages: [] });
  });

  it("shows readonly mode for canceled/concluded booking thread", async () => {
    mockGetChatThread.mockResolvedValue({
      thread: {
        id: "thread-1",
        booking_id: "booking-1",
        parent_profile_id: "parent-1",
        teacher_profile_id: "teacher-1",
        child_id: "child-1",
        booking_status: "concluida",
        parent_name: "Parent",
        teacher_name: "Teacher",
        child_name: "Child",
        created_at: "2026-02-20T10:00:00Z",
        updated_at: "2026-02-20T10:00:00Z",
        last_message_at: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <Routes>
          <Route path="/chat/:threadId" element={<Chat />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/somente leitura/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /chat em somente leitura/i })).toBeDisabled();
  });
});
