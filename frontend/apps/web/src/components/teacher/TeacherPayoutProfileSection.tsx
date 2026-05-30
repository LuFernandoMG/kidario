import { useEffect, useState } from "react";
import { CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import {
  getTeacherPayoutProfileOrNull,
  type TeacherPayoutProfile,
} from "@/data/api/payments";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { getBankLabel } from "./brazilianBanks";
import { TeacherPayoutProfileDialog } from "./TeacherPayoutProfileDialog";
import {
  getTeacherPayoutProfileSavedEventDetail,
  TEACHER_PAYOUT_PROFILE_SAVED_EVENT,
} from "./teacherPayoutProfileEvents";

export function TeacherPayoutProfileSection() {
  const [payoutProfile, setPayoutProfile] = useState<TeacherPayoutProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");

    void getTeacherPayoutProfileOrNull(accessToken)
      .then((profile) => {
        if (cancelled) return;
        setPayoutProfile(profile);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os dados de recebimento.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSavedProfile = (event: Event) => {
      const savedProfile = getTeacherPayoutProfileSavedEventDetail(event);
      if (!savedProfile) return;

      setPayoutProfile(savedProfile);
      setIsLoading(false);
      setError("");
      setNotice("Dados de recebimento atualizados.");
    };

    window.addEventListener(TEACHER_PAYOUT_PROFILE_SAVED_EVENT, handleSavedProfile);
    return () => {
      window.removeEventListener(TEACHER_PAYOUT_PROFILE_SAVED_EVENT, handleSavedProfile);
    };
  }, []);

  return (
    <section className="card-kidario p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Dados de recebimento</h2>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {isLoading ? "Carregando" : payoutStatusLabel(payoutProfile?.recipient_status || payoutProfile?.status)}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-success">{notice}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando dados de recebimento...</p>
      ) : payoutProfile ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Recebedor
            </div>
            <p className="text-sm font-medium text-foreground">{payoutProfile.legal_name}</p>
            <p className="text-xs text-muted-foreground">
              {payoutProfile.document_type.toUpperCase()} {payoutProfile.document_number_masked}
            </p>
            {payoutProfile.professional_occupation && (
              <p className="mt-2 text-xs text-muted-foreground">{payoutProfile.professional_occupation}</p>
            )}
            {payoutProfile.monthly_income_cents && (
              <p className="text-xs text-muted-foreground">
                Renda declarada {formatCents(payoutProfile.monthly_income_cents)}
              </p>
            )}
            {payoutProfile.provider_recipient_id && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {payoutProfile.provider || "pagarme"}: {payoutProfile.provider_recipient_id}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Landmark className="h-4 w-4 text-primary" />
              Banco
            </div>
            <p className="text-sm font-medium text-foreground">{getBankLabel(payoutProfile.bank_code)}</p>
            <p className="text-xs text-muted-foreground">
              Agência {appendDigit(payoutProfile.branch_number, payoutProfile.branch_check_digit)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <CreditCard className="h-4 w-4 text-primary" />
              Conta
            </div>
            <p className="text-sm font-medium text-foreground">
              {appendDigit(payoutProfile.account_number_masked, payoutProfile.account_check_digit)}
            </p>
            <p className="text-xs text-muted-foreground">{accountTypeLabel(payoutProfile.account_type)}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium text-foreground">Dados de recebimento pendentes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre os dados legais e bancários para habilitar o recipient usado no split dos pagamentos.
          </p>
        </div>
      )}

      <KidarioButton type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
        {payoutProfile ? "Editar dados de recebimento" : "Cadastrar dados de recebimento"}
      </KidarioButton>

      <TeacherPayoutProfileDialog
        open={isDialogOpen}
        initialProfile={payoutProfile}
        onOpenChange={setIsDialogOpen}
        onSaved={(savedProfile) => {
          setPayoutProfile(savedProfile);
          setNotice("Dados de recebimento atualizados.");
        }}
      />
    </section>
  );
}

function payoutStatusLabel(status?: TeacherPayoutProfile["status"]) {
  if (status === "active") return "Recipient ativo";
  if (status === "rejected") return "Rejeitado";
  if (status === "disabled") return "Desativado";
  return "Pendente";
}

function accountTypeLabel(type?: TeacherPayoutProfile["account_type"]) {
  return type === "savings" ? "Poupança" : "Conta corrente";
}

function appendDigit(value: string | null | undefined, digit: string | null | undefined) {
  return digit ? `${value || "-"}-${digit}` : value || "-";
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}
