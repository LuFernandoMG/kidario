import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeacherPayoutProfileDialog } from "./TeacherPayoutProfileDialog";

describe("TeacherPayoutProfileDialog", () => {
  const draftProfile = {
    id: "profile-1",
    teacher_id: "teacher-1",
    legal_name: "Ana Silva",
    document_type: "cpf" as const,
    document_number_masked: "*********01",
    bank_code: "260",
    branch_number: "0001",
    branch_check_digit: null,
    account_number_masked: "****6789",
    account_check_digit: null,
    account_type: "checking" as const,
    birthdate: "1984-10-30",
    monthly_income_cents: 350000,
    professional_occupation: "Professor(a)",
    status: "pending" as const,
    provider: null,
    provider_recipient_id: null,
    recipient_status: null,
    created_at: "2026-05-26T10:00:00Z",
    updated_at: "2026-05-26T10:00:00Z",
  };

  it("shows the required onboarding message before the payout form", async () => {
    render(
      <TeacherPayoutProfileDialog
        open
        required
        initialProfile={null}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Bem-vindo ao Kidario!" })).toBeInTheDocument();
    expect(screen.getByText(/precisamos saber para onde vamos transferir o dinheiro/i)).toBeInTheDocument();
    expect(screen.queryByText("Nome legal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(await screen.findByRole("heading", { name: "Dados para recebimento" })).toBeInTheDocument();
    expect(await screen.findByText("Nome legal")).toBeInTheDocument();
    expect(screen.getByText("Banco")).toBeInTheDocument();
    expect(screen.getByText("Data de nascimento")).toBeInTheDocument();
    expect(screen.getByText("Renda mensal declarada (R$)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Professor(a)")).toBeInTheDocument();
    expect(screen.getByText("Dígito agência (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Dígito conta (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Senha da conta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirme sua senha para salvar")).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("requires account password while the recipient was not synced yet", () => {
    render(
      <TeacherPayoutProfileDialog
        open
        initialProfile={draftProfile}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Dados para recebimento" })).toBeInTheDocument();
    expect(screen.getByText("Senha da conta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirme sua senha para salvar")).toHaveAttribute("type", "password");
  });

  it("requires account password when editing an already synced payout recipient", () => {
    render(
      <TeacherPayoutProfileDialog
        open
        initialProfile={{
          ...draftProfile,
          provider: "pagarme",
          provider_recipient_id: "re_test_123",
          recipient_status: "active",
        }}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Dados para recebimento" })).toBeInTheDocument();
    expect(screen.getByText("Senha da conta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirme sua senha para salvar")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
