import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Landmark, ShieldCheck } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseAccessToken } from "@/lib/authSession";
import {
  getTeacherPayoutProfile,
  patchTeacherPayoutProfile,
  syncTeacherPaymentRecipient,
  type TeacherPayoutProfile,
  type TeacherPayoutProfilePayload,
} from "@/data/api/payments";
import { brazilianBanks } from "./brazilianBanks";
import { notifyTeacherPayoutProfileSaved } from "./teacherPayoutProfileEvents";

type PayoutFormState = TeacherPayoutProfilePayload;
const CUSTOM_BANK_VALUE = "custom_bank";

interface TeacherPayoutProfileDialogProps {
  open: boolean;
  required?: boolean;
  defaultLegalName?: string;
  initialProfile?: TeacherPayoutProfile | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: TeacherPayoutProfile) => void;
}

const emptyForm: PayoutFormState = {
  legal_name: "",
  document_type: "cpf",
  document_number: "",
  bank_code: "",
  branch_number: "",
  branch_check_digit: "",
  account_number: "",
  account_check_digit: "",
  account_type: "checking",
  birthdate: "",
  monthly_income_cents: null,
  professional_occupation: "Professor(a)",
};

export function TeacherPayoutProfileDialog({
  open,
  required = false,
  defaultLegalName = "",
  initialProfile,
  onOpenChange,
  onSaved,
}: TeacherPayoutProfileDialogProps) {
  const [form, setForm] = useState<PayoutFormState>(emptyForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [isUsingCustomBankCode, setIsUsingCustomBankCode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState("");
  const hasSyncedRecipient = Boolean(initialProfile?.provider_recipient_id);
  const shouldShowIntro = required && !hasSyncedRecipient && !hasSeenIntro;
  const canClose = !required || hasSyncedRecipient;
  const bankSelectValue = isUsingCustomBankCode ? CUSTOM_BANK_VALUE : form.bank_code;

  useEffect(() => {
    if (!open) return;
    setError("");
    setCurrentPassword("");
    setMonthlyIncomeInput(
      initialProfile?.monthly_income_cents ? centsToCurrencyInput(initialProfile.monthly_income_cents) : "",
    );
    setHasSeenIntro(!(required && !hasSyncedRecipient));
    setIsUsingCustomBankCode(
      Boolean(initialProfile?.bank_code && !brazilianBanks.some((bank) => bank.code === initialProfile.bank_code)),
    );
    setForm({
      legal_name: initialProfile?.legal_name || defaultLegalName || "",
      document_type: initialProfile?.document_type || "cpf",
      document_number: "",
      bank_code: initialProfile?.bank_code || "",
      branch_number: initialProfile?.branch_number || "",
      branch_check_digit: initialProfile?.branch_check_digit || "",
      account_number: "",
      account_check_digit: initialProfile?.account_check_digit || "",
      account_type: initialProfile?.account_type || "checking",
      birthdate: initialProfile?.birthdate || "",
      monthly_income_cents: initialProfile?.monthly_income_cents || null,
      professional_occupation: initialProfile?.professional_occupation || "Professor(a)",
    });
  }, [defaultLegalName, hasSyncedRecipient, initialProfile, open, required]);

  const setField = <K extends keyof PayoutFormState>(field: K, value: PayoutFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleBankChange = (value: string) => {
    if (value === CUSTOM_BANK_VALUE) {
      setIsUsingCustomBankCode(true);
      setField("bank_code", "");
      return;
    }

    setIsUsingCustomBankCode(false);
    setField("bank_code", value);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!canClose && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setError("Sua sessão expirou. Faça login novamente.");
      return;
    }

    const normalizedDocument = digitsOnly(form.document_number);
    const normalizedBank = digitsOnly(form.bank_code);
    const normalizedBranch = digitsOnly(form.branch_number);
    const normalizedAccount = digitsOnly(form.account_number);
    const monthlyIncomeCents = currencyInputToCents(monthlyIncomeInput);
    const professionalOccupation = form.professional_occupation?.trim() || "";

    if (!form.legal_name.trim()) {
      setError("Informe o nome legal do recebedor.");
      return;
    }
    if (form.document_type === "cpf" && normalizedDocument.length !== 11) {
      setError("Informe um CPF com 11 dígitos.");
      return;
    }
    if (form.document_type === "cnpj" && normalizedDocument.length !== 14) {
      setError("Informe um CNPJ com 14 dígitos.");
      return;
    }
    if (form.document_type === "cpf" && !form.birthdate) {
      setError("Informe a data de nascimento do recebedor.");
      return;
    }
    if (form.document_type === "cpf" && (!monthlyIncomeCents || monthlyIncomeCents <= 0)) {
      setError("Informe a renda mensal declarada do recebedor.");
      return;
    }
    if (form.document_type === "cpf" && !professionalOccupation) {
      setError("Informe a profissão do recebedor.");
      return;
    }
    if (!normalizedBank || !normalizedBranch || !normalizedAccount) {
      setError("Informe banco, agência e conta bancária.");
      return;
    }
    if (!currentPassword.trim()) {
      setError("Informe sua senha para salvar os dados financeiros.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await patchTeacherPayoutProfile(accessToken, {
        ...form,
        document_number: normalizedDocument,
        bank_code: normalizedBank,
        branch_number: normalizedBranch,
        branch_check_digit: form.branch_check_digit?.trim() || undefined,
        account_number: normalizedAccount,
        account_check_digit: form.account_check_digit?.trim() || undefined,
        birthdate: form.document_type === "cpf" ? form.birthdate : undefined,
        monthly_income_cents: form.document_type === "cpf" ? monthlyIncomeCents : undefined,
        professional_occupation: form.document_type === "cpf" ? professionalOccupation : undefined,
        current_password: currentPassword,
      });
      await syncTeacherPaymentRecipient(accessToken);
      const refreshed = await getTeacherPayoutProfile(accessToken);
      notifyTeacherPayoutProfileSaved(refreshed);
      onSaved(refreshed);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível salvar os dados financeiros.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={canClose}
        className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto p-7 sm:max-w-2xl sm:p-8"
      >
        <DialogHeader className={shouldShowIntro ? "items-center space-y-3 text-center sm:text-center" : undefined}>
          <DialogTitle className={shouldShowIntro ? "text-2xl font-semibold text-primary sm:text-3xl" : undefined}>
            {shouldShowIntro ? "Bem-vindo ao Kidario!" : "Dados para recebimento"}
          </DialogTitle>
          <DialogDescription className={shouldShowIntro ? "max-w-xl text-center leading-relaxed" : undefined}>
            {shouldShowIntro
              ? "Estamos muito felizes por você estar aqui, mas antes de começarmos a trabalhar juntos, precisamos saber para onde vamos transferir o dinheiro que você ganhar na plataforma."
              : "Esses dados são usados para criar o recebedor e a conta bancária do split de pagamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="-m-2 overflow-hidden p-2">
          <AnimatePresence mode="wait" initial={false}>
            {shouldShowIntro ? (
              <motion.div
                key="payout-intro"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-5 text-center"
              >
                <div className="mx-auto max-w-xl space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    A seguir, insira a conta bancária (pessoa física ou jurídica) que receberá os pagamentos
                    gerados pelas suas aulas.
                  </p>
                </div>

                <DialogFooter className="sm:justify-center">
                  <KidarioButton type="button" variant="hero" onClick={() => setHasSeenIntro(true)}>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </KidarioButton>
                </DialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="payout-form"
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                    <Field label="Nome legal">
                      <Input
                        value={form.legal_name}
                        onChange={(event) => setField("legal_name", event.target.value)}
                        placeholder="Nome completo ou razão social"
                      />
                    </Field>
                    <Field label="Documento">
                      <Select
                        value={form.document_type}
                        onValueChange={(value) => setField("document_type", value as PayoutFormState["document_type"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label={form.document_type === "cpf" ? "Número do CPF" : "Número do CNPJ"}>
                    <Input
                      value={form.document_number}
                      onChange={(event) => setField("document_number", event.target.value)}
                      inputMode="numeric"
                      placeholder={initialProfile ? "Informe novamente para salvar alterações" : "Somente números"}
                    />
                  </Field>

                  {form.document_type === "cpf" && (
                    <div className="rounded-lg border border-border p-3">
                      <div className="mb-3 text-sm font-medium text-foreground">Dados cadastrais</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Data de nascimento">
                          <Input
                            value={form.birthdate || ""}
                            onChange={(event) => setField("birthdate", event.target.value)}
                            type="date"
                          />
                        </Field>
                        <Field label="Renda mensal declarada (R$)">
                          <Input
                            value={monthlyIncomeInput}
                            onChange={(event) => {
                              const value = event.target.value;
                              setMonthlyIncomeInput(value);
                              setField("monthly_income_cents", currencyInputToCents(value));
                            }}
                            inputMode="decimal"
                            placeholder="Ex.: 3500,00"
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Profissão">
                            <Input
                              value={form.professional_occupation || ""}
                              onChange={(event) => setField("professional_occupation", event.target.value)}
                              placeholder="Professor(a)"
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <Landmark className="h-4 w-4 text-primary" />
                      Conta bancária
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Banco">
                        <Select value={bankSelectValue} onValueChange={handleBankChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {brazilianBanks.map((bank) => (
                              <SelectItem key={bank.code} value={bank.code}>
                                {bank.name} ({bank.code})
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_BANK_VALUE}>Outro banco</SelectItem>
                          </SelectContent>
                        </Select>
                        {isUsingCustomBankCode && (
                          <Input
                            value={form.bank_code}
                            onChange={(event) => setField("bank_code", event.target.value)}
                            inputMode="numeric"
                            placeholder="Código do banco"
                          />
                        )}
                      </Field>
                      <Field label="Agência">
                        <Input
                          value={form.branch_number}
                          onChange={(event) => setField("branch_number", event.target.value)}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Dígito agência (opcional)">
                        <Input
                          value={form.branch_check_digit || ""}
                          onChange={(event) => setField("branch_check_digit", event.target.value)}
                          placeholder="Se houver"
                        />
                      </Field>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Conta">
                        <Input
                          value={form.account_number}
                          onChange={(event) => setField("account_number", event.target.value)}
                          inputMode="numeric"
                          placeholder={initialProfile ? "Informe novamente" : undefined}
                        />
                      </Field>
                      <Field label="Dígito conta (opcional)">
                        <Input
                          value={form.account_check_digit || ""}
                          onChange={(event) => setField("account_check_digit", event.target.value)}
                          placeholder="Se houver"
                        />
                      </Field>
                      <Field label="Tipo">
                        <Select
                          value={form.account_type}
                          onValueChange={(value) => setField("account_type", value as PayoutFormState["account_type"])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Conta corrente</SelectItem>
                            <SelectItem value="savings">Poupança</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>
                      Por segurança, documento e número da conta não são exibidos depois de salvos. Para alterar,
                      informe os dados completos novamente.
                    </p>
                  </div>

                  <Field label="Senha de Kidario por segurança">
                    <Input
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Confirme sua senha para salvar"
                    />
                  </Field>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter className="gap-2">
                  {!required && (
                    <KidarioButton
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      disabled={isSaving}
                    >
                      Cancelar
                    </KidarioButton>
                  )}
                  <KidarioButton type="button" variant="hero" onClick={handleSubmit} disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar e sincronizar recipient"}
                  </KidarioButton>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function digitsOnly(value: string | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function currencyInputToCents(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(cleaned)
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function centsToCurrencyInput(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
