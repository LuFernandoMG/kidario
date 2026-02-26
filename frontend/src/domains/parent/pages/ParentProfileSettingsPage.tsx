import { type ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Baby, LogOut, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseAccessToken, signOutFromSupabase } from "@/lib/authSession";
import {
  getParentProfile,
  patchParentProfile,
  type BackendParentChildView,
} from "@/domains/parent/api/backendParentProfiles";
import {
  childGenderOptions,
  childGradeOptions,
  formatChildGenderLabel,
  formatChildGradeLabel,
  isKnownChildGrade,
  normalizeChildGender,
} from "@/lib/childProfile";

interface ParentFormState {
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  address: string;
  bio: string;
  children: BackendParentChildView[];
}

const emptyForm: ParentFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  birthDate: "",
  address: "",
  bio: "",
  children: [],
};

function emptyChild(): BackendParentChildView {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    birth_month_year: "",
    current_grade: "",
    school: "",
    focus_points: "",
  };
}

function normalizeChildForForm(child: BackendParentChildView): BackendParentChildView {
  return {
    ...child,
    gender: normalizeChildGender(child.gender),
  };
}

export default function ParentProfileSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ParentFormState>(emptyForm);
  const [initialForm, setInitialForm] = useState<ParentFormState>(emptyForm);
  const [deletedChildIds, setDeletedChildIds] = useState<string[]>([]);

  const loadProfile = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil%2Fresponsavel");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const payload = await getParentProfile(accessToken);
      const normalizedChildren = (payload.children || []).map(normalizeChildForForm);
      setEmail(payload.profile.email);
      setForm({
        firstName: payload.profile.first_name || "",
        lastName: payload.profile.last_name || "",
        phone: payload.phone || "",
        birthDate: payload.birth_date || "",
        address: payload.address || "",
        bio: payload.bio || "",
        children: normalizedChildren,
      });
      setInitialForm({
        firstName: payload.profile.first_name || "",
        lastName: payload.profile.last_name || "",
        phone: payload.phone || "",
        birthDate: payload.birth_date || "",
        address: payload.address || "",
        bio: payload.bio || "",
        children: normalizedChildren,
      });
      setDeletedChildIds([]);
      setIsEditingProfile(false);
      setEditingChildId(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o perfil do responsável.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [navigate]);

  const setField = (field: keyof Omit<ParentFormState, "children">, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateChild = <TField extends keyof BackendParentChildView>(
    childId: string,
    field: TField,
    value: BackendParentChildView[TField],
  ) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((child) =>
        child.id === childId ? { ...child, [field]: value } : child,
      ),
    }));
  };

  const addChild = () => {
    const child = emptyChild();
    setForm((prev) => ({ ...prev, children: [...prev.children, child] }));
    setEditingChildId(child.id);
  };

  const removeChild = (childId: string) => {
    const targetChild = form.children.find((child) => child.id === childId);
    if (targetChild?.id && !targetChild.id.startsWith("tmp-")) {
      setDeletedChildIds((current) => [...current, targetChild.id]);
    }
    setForm((prev) => ({
      ...prev,
      children: prev.children.filter((child) => child.id !== childId),
    }));
    if (editingChildId === childId) {
      setEditingChildId(null);
    }
  };

  const handleStartProfileEdit = () => {
    setError("");
    setNotice("");
    setInitialForm(form);
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    setForm((prev) => ({
      ...prev,
      firstName: initialForm.firstName,
      lastName: initialForm.lastName,
      phone: initialForm.phone,
      birthDate: initialForm.birthDate,
      address: initialForm.address,
      bio: initialForm.bio,
    }));
    setIsEditingProfile(false);
  };

  const handleSave = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil%2Fresponsavel");
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Preencha nome e sobrenome.");
      return;
    }

    const childValidationError = validateChildrenForSave(form.children);
    if (childValidationError) {
      setError(childValidationError);
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      await patchParentProfile(accessToken, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        birth_date: form.birthDate || undefined,
        address: form.address.trim() || undefined,
        bio: form.bio.trim() || undefined,
        children_ops: {
          upsert: form.children.map((child) => ({
            id: child.id && !child.id.startsWith("tmp-") ? child.id : undefined,
            name: child.name?.trim() || "",
            current_grade: child.current_grade?.trim() || null,
            school: child.school?.trim() || null,
            focus_points: child.focus_points?.trim() || null,
            birth_month_year: child.birth_month_year || null,
            gender: normalizeChildGender(child.gender),
            age: child.age ?? null,
          })),
          delete_ids: deletedChildIds,
        },
      });
      setNotice("Perfil do responsável atualizado com sucesso.");
      await loadProfile();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil do responsável.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    navigate("/");
  };

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-foreground">Perfil do responsável</h1>
          <p className="text-muted-foreground mt-1">Veja e atualize seus dados e das crianças.</p>
        </motion.div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando perfil...</p>
        ) : (
          <>
            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Dados do responsável</h2>
                {!isEditingProfile ? (
                  <KidarioButton size="sm" variant="outline" onClick={handleStartProfileEdit}>
                    <Pencil className="w-4 h-4" />
                    Editar dados
                  </KidarioButton>
                ) : (
                  <KidarioButton size="sm" variant="ghost" onClick={handleCancelProfileEdit}>
                    <X className="w-4 h-4" />
                    Cancelar
                  </KidarioButton>
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="font-medium">E-mail</span>
                <span>{email}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome">
                  <Input
                    value={form.firstName}
                    onChange={(event) => setField("firstName", event.target.value)}
                    disabled={!isEditingProfile}
                  />
                </Field>
                <Field label="Sobrenome">
                  <Input
                    value={form.lastName}
                    onChange={(event) => setField("lastName", event.target.value)}
                    disabled={!isEditingProfile}
                  />
                </Field>
              </div>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  disabled={!isEditingProfile}
                />
              </Field>
              <Field label="Data de nascimento">
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setField("birthDate", event.target.value)}
                  disabled={!isEditingProfile}
                />
              </Field>
              <Field label="Endereço">
                <Input
                  value={form.address}
                  onChange={(event) => setField("address", event.target.value)}
                  disabled={!isEditingProfile}
                />
              </Field>
              <Field label="Bio">
                <Textarea
                  value={form.bio}
                  onChange={(event) => setField("bio", event.target.value)}
                  disabled={!isEditingProfile}
                />
              </Field>
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Crianças</h2>
                <KidarioButton size="sm" variant="outline" onClick={addChild}>
                  <Plus className="w-4 h-4" />
                  Adicionar
                </KidarioButton>
              </div>
              {form.children.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma criança cadastrada.</p>
              )}

              {form.children.map((child) => {
                const isEditingChild = editingChildId === child.id;
                const ChildIcon = getChildIconByGender();
                const genderValue = normalizeChildGender(child.gender);
                const gradeValue = child.current_grade || "";

                return (
                  <div key={child.id} className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <ChildIcon className="w-5 h-5 text-primary" />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{child.name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{formatChildGenderLabel(child.gender)}</p>
                        </div>
                      </div>
                      <KidarioButton
                        size="sm"
                        variant={isEditingChild ? "ghost" : "outline"}
                        onClick={() => setEditingChildId(isEditingChild ? null : child.id)}
                      >
                        {isEditingChild ? "Fechar" : "Editar"}
                      </KidarioButton>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nome">
                        {isEditingChild ? (
                          <Input
                            value={child.name || ""}
                            onChange={(event) => updateChild(child.id, "name", event.target.value)}
                          />
                        ) : (
                          <StaticFieldValue value={child.name || "Não informado"} />
                        )}
                      </Field>
                      <Field label="Gênero">
                        {isEditingChild ? (
                          <Select
                            value={genderValue || undefined}
                            onValueChange={(value) => updateChild(child.id, "gender", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o gênero" />
                            </SelectTrigger>
                            <SelectContent>
                              {childGenderOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <StaticFieldValue value={formatChildGenderLabel(child.gender)} />
                        )}
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Idade">
                        {isEditingChild ? (
                          <Input
                            type="number"
                            min="0"
                            value={child.age != null ? String(child.age) : ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              updateChild(child.id, "age", value ? Number(value) : null);
                            }}
                          />
                        ) : (
                          <StaticFieldValue value={child.age != null ? `${child.age} anos` : "Não informada"} />
                        )}
                      </Field>
                      <Field label="Série/Curso">
                        {isEditingChild ? (
                          <Select
                            value={gradeValue || undefined}
                            onValueChange={(value) => updateChild(child.id, "current_grade", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a série/curso" />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeValue && !isKnownChildGrade(gradeValue) && (
                                <SelectItem value={gradeValue}>{gradeValue}</SelectItem>
                              )}
                              {childGradeOptions.map((grade) => (
                                <SelectItem key={grade.value} value={grade.value}>
                                  {grade.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <StaticFieldValue value={formatChildGradeLabel(child.current_grade)} />
                        )}
                      </Field>
                      <Field label="Nascimento (mês/ano)">
                        {isEditingChild ? (
                          <Input
                            type="month"
                            value={child.birth_month_year || ""}
                            onChange={(event) =>
                              updateChild(child.id, "birth_month_year", event.target.value || null)
                            }
                          />
                        ) : (
                          <StaticFieldValue value={formatBirthMonthYearLabel(child.birth_month_year)} />
                        )}
                      </Field>
                    </div>

                    <Field label="Escola">
                      {isEditingChild ? (
                        <Input
                          value={child.school || ""}
                          onChange={(event) => updateChild(child.id, "school", event.target.value)}
                        />
                      ) : (
                        <StaticFieldValue value={child.school || "Não informada"} />
                      )}
                    </Field>

                    <Field label="Pontos de atenção">
                      {isEditingChild ? (
                        <Textarea
                          value={child.focus_points || ""}
                          onChange={(event) => updateChild(child.id, "focus_points", event.target.value)}
                        />
                      ) : (
                        <StaticFieldValue value={child.focus_points || "Não informado"} multiline />
                      )}
                    </Field>

                    {isEditingChild && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeChild(child.id)}
                          className="inline-flex items-center gap-1 text-sm text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir criança
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}

            <KidarioButton size="lg" variant="hero" fullWidth onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </KidarioButton>

            <KidarioButton
              variant="ghost"
              size="lg"
              fullWidth
              onClick={handleLogout}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
              Sair da conta
            </KidarioButton>
          </>
        )}
      </div>
    </AppShell>
  );
}

function getChildIconByGender() {
  return Baby;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function StaticFieldValue({ value, multiline = false }: { value: string; multiline?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border bg-background p-2 text-sm text-foreground ${
        multiline ? "whitespace-pre-wrap" : ""
      }`}
    >
      {value}
    </div>
  );
}

function validateChildrenForSave(children: BackendParentChildView[]): string | null {
  if (children.length === 0) return "Adicione pelo menos uma criança.";

  if (children.some((child) => !child.name?.trim())) {
    return "Todas as crianças devem ter nome.";
  }

  for (const child of children) {
    if (!child.id.startsWith("tmp-")) continue;

    if (!normalizeChildGender(child.gender)) {
      return `Selecione o gênero de ${child.name?.trim() || "cada nova criança"}.`;
    }

    if (child.age == null || Number.isNaN(child.age) || child.age < 1 || child.age > 18) {
      return `Informe uma idade válida (1 a 18) para ${child.name?.trim() || "cada nova criança"}.`;
    }

    if (!child.current_grade?.trim()) {
      return `Selecione a série/curso de ${child.name?.trim() || "cada nova criança"}.`;
    }

    if (!child.birth_month_year) {
      return `Informe mês/ano de nascimento de ${child.name?.trim() || "cada nova criança"}.`;
    }

    if (!child.school?.trim()) {
      return `Informe a escola de ${child.name?.trim() || "cada nova criança"}.`;
    }

    if (!child.focus_points?.trim()) {
      return `Descreva os pontos de atenção de ${child.name?.trim() || "cada nova criança"}.`;
    }
  }

  return null;
}

function formatBirthMonthYearLabel(value?: string | null): string {
  if (!value) return "Não informado";
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}
