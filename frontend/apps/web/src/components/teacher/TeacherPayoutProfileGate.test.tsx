import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeacherPayoutProfileOrNullMock = vi.fn();

vi.mock("@/data/api/payments", () => ({
  getTeacherPayoutProfileOrNull: (...args: unknown[]) => getTeacherPayoutProfileOrNullMock(...args),
}));

vi.mock("@/lib/authSession", () => ({
  getAuthSession: () => ({ isAuthenticated: true, role: "teacher" }),
  getSupabaseAccessToken: () => "token",
}));

vi.mock("./TeacherPayoutProfileDialog", () => ({
  TeacherPayoutProfileDialog: ({ open }: { open: boolean }) => (
    open ? <div role="dialog">Dados para recebimento</div> : null
  ),
}));

import { TeacherPayoutProfileGate } from "./TeacherPayoutProfileGate";

describe("TeacherPayoutProfileGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the required payout profile dialog when the teacher has no payout profile", async () => {
    getTeacherPayoutProfileOrNullMock.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <TeacherPayoutProfileGate />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent("Dados para recebimento");
    expect(getTeacherPayoutProfileOrNullMock).toHaveBeenCalledWith("token");
  });
});
