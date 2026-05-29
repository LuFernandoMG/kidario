from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


PayoutDocumentType = Literal["cpf", "cnpj"]
PayoutAccountType = Literal["checking", "savings"]
PayoutStatus = Literal["pending", "active", "rejected", "disabled"]


class TeacherPayoutProfile(BaseModel):
    id: UUID
    teacher_id: UUID
    legal_name: str
    document_type: PayoutDocumentType
    document_number_masked: str
    bank_code: str
    branch_number: str
    branch_check_digit: str | None = None
    account_number_masked: str
    account_check_digit: str | None = None
    account_type: PayoutAccountType
    status: PayoutStatus
    created_at: datetime
    updated_at: datetime


class TeacherPayoutProfileUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    legal_name: str = Field(min_length=1, max_length=180)
    document_type: PayoutDocumentType
    document_number: str = Field(min_length=11, max_length=18)
    bank_code: str = Field(min_length=1, max_length=16)
    branch_number: str = Field(min_length=1, max_length=16)
    branch_check_digit: str | None = Field(default=None, max_length=8)
    account_number: str = Field(min_length=1, max_length=24)
    account_check_digit: str | None = Field(default=None, max_length=8)
    account_type: PayoutAccountType


class TeacherPaymentRecipientSyncResponse(BaseModel):
    status: str = "ok"
    teacher_id: UUID
    provider: str = "pagarme"
    provider_recipient_id: str
    recipient_status: PayoutStatus


class PagarmeWebhookResponse(BaseModel):
    status: Literal["ok", "ignored"] = "ok"
    event_id: UUID | None = None


class PaymentSplit(BaseModel):
    id: UUID
    payment_order_id: UUID
    payment_charge_id: UUID | None = None
    teacher_id: UUID | None = None
    provider: str
    provider_recipient_id: str
    split_role: Literal["platform", "teacher"]
    type: Literal["flat", "percentage"]
    amount_cents: int | None = None
    percentage: float | None = None
    liable: bool
    charge_processing_fee: bool
    charge_remainder_fee: bool
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def ensure_amount_or_percentage(self) -> "PaymentSplit":
        if self.type == "flat" and self.amount_cents is None:
            raise ValueError("amount_cents is required for flat splits.")
        if self.type == "percentage" and self.percentage is None:
            raise ValueError("percentage is required for percentage splits.")
        return self
