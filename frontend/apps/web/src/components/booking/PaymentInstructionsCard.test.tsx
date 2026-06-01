import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentInstructionsCard } from "@/components/booking/PaymentInstructionsCard";
import type { PaymentCharge, PaymentOrder } from "@/data/api/bookings";

function paymentOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: "order-1",
    parent_id: "parent-1",
    booking_id: "booking-1",
    package_id: null,
    provider: "pagarme",
    provider_order_id: "or_test",
    provider_order_code: "booking_test",
    requested_payment_method: "pix",
    amount_cents: 32400,
    currency: "BRL",
    status: "pending",
    expires_at: null,
    charges: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

function paymentCharge(overrides: Partial<PaymentCharge> = {}): PaymentCharge {
  return {
    id: "charge-1",
    payment_order_id: "order-1",
    provider: "pagarme",
    provider_charge_id: "ch_test",
    provider_transaction_id: "tran_test",
    payment_method: "pix",
    status: "pending",
    amount_cents: 32400,
    paid_amount_cents: null,
    installments: 1,
    pix_qr_code_url: null,
    pix_qr_code: null,
    boleto_url: null,
    payment_url: null,
    boleto_barcode: null,
    boleto_line: null,
    expires_at: null,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

describe("PaymentInstructionsCard", () => {
  it("renders Pix QR code, copy code and payment deadline", () => {
    render(
      <PaymentInstructionsCard
        paymentOrder={paymentOrder()}
        paymentCharge={paymentCharge({
          pix_qr_code_url: "https://example.com/pix.png",
          pix_qr_code: "000201PIXCODE",
          expires_at: "2026-06-02T18:30:00Z",
        })}
      />,
    );

    expect(screen.getByText("Pague com Pix")).toBeInTheDocument();
    expect(screen.getByAltText("QR Code Pix")).toHaveAttribute("src", "https://example.com/pix.png");
    expect(screen.getByText("000201PIXCODE")).toBeInTheDocument();
    expect(screen.getByText(/Pague até/)).toBeInTheDocument();
  });

  it("copies Pix code when clipboard is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <PaymentInstructionsCard
        paymentOrder={paymentOrder()}
        paymentCharge={paymentCharge({ pix_qr_code: "000201PIXCODE" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));

    expect(writeText).toHaveBeenCalledWith("000201PIXCODE");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });

  it("renders boleto line and link", () => {
    render(
      <PaymentInstructionsCard
        paymentOrder={paymentOrder({ requested_payment_method: "boleto" })}
        paymentCharge={paymentCharge({
          payment_method: "boleto",
          boleto_line: "34191.79001 01043.510047 91020.150008 1 98760000012000",
          boleto_url: "https://example.com/boleto",
        })}
      />,
    );

    expect(screen.getByText("Pague com boleto")).toBeInTheDocument();
    expect(screen.getByText(/34191\.79001/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir boleto/i })).toHaveAttribute(
      "href",
      "https://example.com/boleto",
    );
    expect(screen.getByText("O boleto vence em até 3 dias após a geração.")).toBeInTheDocument();
  });
});
