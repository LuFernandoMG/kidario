import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, PackageCheck, PackagePlus, Plus, Save, X } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { formatCurrencyCents } from "@/lib/pricing";
import {
  createMyPackagePlan,
  listMyPackagePlans,
  updateMyPackagePlan,
  type PackagePlan,
  type PackagePlanPayload,
} from "@/data/api/packages";

interface PackagePlanForm {
  code: string;
  name: string;
  description: string;
  sessionsCount: string;
  discountPercent: string;
  isActive: boolean;
}

const emptyForm: PackagePlanForm = {
  code: "",
  name: "",
  description: "",
  sessionsCount: "4",
  discountPercent: "0",
  isActive: true,
};

export function TeacherPackagePlansPanel() {
  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PackagePlan | null>(null);
  const [form, setForm] = useState<PackagePlanForm>(emptyForm);

  const activePlansCount = useMemo(
    () => plans.filter((plan) => plan.is_active).length,
    [plans],
  );

  const loadPlans = useCallback(async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setPlans([]);
      setError("Sessão inválida. Entre novamente para configurar pacotes.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await listMyPackagePlans(accessToken);
      setPlans(response.package_plans);
    } catch (loadError) {
      setPlans([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os pacotes.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setDialogOpen(true);
  };

  const openEditDialog = (plan: PackagePlan) => {
    setEditingPlan(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || "",
      sessionsCount: String(plan.sessions_count),
      discountPercent: String(plan.discount_percent),
      isActive: plan.is_active,
    });
    setError("");
    setNotice("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setDialogOpen(false);
    setEditingPlan(null);
    setForm(emptyForm);
  };

  const setField = <TField extends keyof PackagePlanForm>(
    field: TField,
    value: PackagePlanForm[TField],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const buildPayload = (): PackagePlanPayload | null => {
    const sessionsCount = Number(form.sessionsCount);
    const discountPercent = Number(form.discountPercent);
    const normalizedCode = form.code.trim().toUpperCase();
    const normalizedName = form.name.trim();

    if (!normalizedCode || !normalizedName) {
      setError("Preencha código e nome do pacote.");
      return null;
    }
    if (!Number.isInteger(sessionsCount) || sessionsCount <= 0) {
      setError("Informe uma quantidade válida de aulas.");
      return null;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setError("Informe um desconto entre 0% e 100%.");
      return null;
    }

    return {
      code: normalizedCode,
      name: normalizedName,
      description: form.description.trim() || null,
      sessions_count: sessionsCount,
      discount_percent: discountPercent,
      is_active: form.isActive,
    };
  };

  const handleSubmit = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setError("Sessão inválida. Entre novamente para salvar o pacote.");
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingPlan) {
        const updatedPlan = await updateMyPackagePlan(accessToken, editingPlan.id, payload);
        setPlans((current) =>
          current.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)),
        );
        setNotice("Pacote atualizado com sucesso.");
      } else {
        const createdPlan = await createMyPackagePlan(accessToken, payload);
        setPlans((current) => [createdPlan, ...current]);
        setNotice("Pacote criado com sucesso.");
      }
      setDialogOpen(false);
      setEditingPlan(null);
      setForm(emptyForm);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o pacote.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="card-kidario p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Pacotes ativos</p>
          <h2 className="font-display text-lg font-semibold text-foreground">Pacotes de aulas</h2>
        </div>
        <KidarioButton type="button" size="sm" variant="outline" onClick={openCreateDialog}>
          <Plus className="w-4 h-4" />
          Novo
        </KidarioButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Planos cadastrados" value={String(plans.length)} />
        <Metric label="Visíveis para famílias" value={String(activePlansCount)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pacotes...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum pacote cadastrado.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PackagePlanRow key={plan.id} plan={plan} onEdit={openEditDialog} />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-success">{notice}</p>}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar pacote" : "Novo pacote"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Atualize a configuração do pacote." : "Defina o plano que será exibido às famílias."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
              <Field label="Código">
                <Input
                  value={form.code}
                  onChange={(event) => setField("code", event.target.value.toUpperCase())}
                  placeholder="PACK4"
                  disabled={isSaving}
                />
              </Field>
              <Field label="Nome">
                <Input
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Pacote 4 aulas"
                  disabled={isSaving}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Quantidade de aulas">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.sessionsCount}
                  onChange={(event) => setField("sessionsCount", event.target.value)}
                  disabled={isSaving}
                />
              </Field>
              <Field label="Desconto (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.discountPercent}
                  onChange={(event) => setField("discountPercent", event.target.value)}
                  disabled={isSaving}
                />
              </Field>
            </div>

            <Field label="Descrição">
              <Textarea
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Acompanhamento semanal com continuidade entre as aulas."
                disabled={isSaving}
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Disponível para compra</p>
                <p className="text-xs text-muted-foreground">
                  {form.isActive ? "Ativo" : "Inativo"}
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setField("isActive", checked)}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <KidarioButton type="button" variant="ghost" onClick={closeDialog} disabled={isSaving}>
              <X className="w-4 h-4" />
              Cancelar
            </KidarioButton>
            <KidarioButton type="button" variant="hero" onClick={handleSubmit} disabled={isSaving}>
              <Save className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar pacote"}
            </KidarioButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PackagePlanRow({ plan, onEdit }: { plan: PackagePlan; onEdit: (plan: PackagePlan) => void }) {
  const hasEstimate = plan.estimated_final_amount_cents != null;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {plan.is_active ? <PackageCheck className="w-5 h-5" /> : <PackagePlus className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">{plan.name}</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {plan.code}
                </span>
                <span
                  className={
                    plan.is_active
                      ? "rounded-full bg-success/10 px-2 py-0.5 text-xs text-success"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {plan.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.sessions_count} aulas · {formatDiscount(plan.discount_percent)} de desconto
              </p>
            </div>
            <KidarioButton type="button" size="icon-sm" variant="ghost" onClick={() => onEdit(plan)}>
              <Pencil className="w-4 h-4" />
              <span className="sr-only">Editar pacote</span>
            </KidarioButton>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Original</p>
              <p className="text-sm font-medium text-foreground">
                {plan.estimated_original_amount_cents != null
                  ? formatCurrencyCents(plan.estimated_original_amount_cents)
                  : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-primary/5 px-3 py-2">
              <p className="text-xs text-muted-foreground">Pacote</p>
              <p className="text-sm font-medium text-primary">
                {hasEstimate ? formatCurrencyCents(plan.estimated_final_amount_cents || 0) : "-"}
              </p>
            </div>
          </div>

          {plan.description && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">{plan.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
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

function formatDiscount(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
