import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseAccessToken, signOutFromSupabase } from "@/lib/authSession";
import { getParentProfile, patchParentProfile, type BackendParentChildView } from "@/lib/backendProfiles";

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
    current_grade: "",
    school: "",
    focus_points: "",
  };
}

export default function ParentProfileSettings() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ParentFormState>(emptyForm);
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
      setEmail(payload.profile.email);
      setForm({
        firstName: payload.profile.first_name || "",
        lastName: payload.profile.last_name || "",
        phone: payload.phone || "",
        birthDate: payload.birth_date || "",
        address: payload.address || "",
        bio: payload.bio || "",
        children: payload.children || [],
      });
      setDeletedChildIds([]);
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

  const updateChild = (index: number, field: keyof BackendParentChildView, value: string) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((child, childIndex) =>
        childIndex === index ? { ...child, [field]: value } : child,
      ),
    }));
  };

  const addChild = () => {
    setForm((prev) => ({ ...prev, children: [...prev.children, emptyChild()] }));
  };

  const removeChild = (index: number) => {
    const targetChild = form.children[index];
    if (targetChild?.id && !targetChild.id.startsWith("tmp-")) {
      setDeletedChildIds((current) => [...current, targetChild.id]);
    }
    setForm((prev) => ({
      ...prev,
      children: prev.children.filter((_, childIndex) => childIndex !== index),
    }));
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
    if (form.children.length === 0) {
      setError("Adicione pelo menos uma criança.");
      return;
    }
    if (form.children.some((child) => !child.name?.trim())) {
      setError("Todas as crianças devem ter nome.");
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
            gender: child.gender || null,
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
          <p className="text-muted-foreground mt-1">Edite seus dados e os dados das crianças.</p>
        </motion.div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando perfil...</p>
        ) : (
          <>
            <section className="card-kidario p-4 space-y-3">
              <div className="text-sm text-muted-foreground">{email}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Nome"
                  value={form.firstName}
                  onChange={(event) => setField("firstName", event.target.value)}
                />
                <Input
                  placeholder="Sobrenome"
                  value={form.lastName}
                  onChange={(event) => setField("lastName", event.target.value)}
                />
              </div>
              <Input
                placeholder="Telefone"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
              <Input
                type="date"
                value={form.birthDate}
                onChange={(event) => setField("birthDate", event.target.value)}
              />
              <Input
                placeholder="Endereço"
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
              />
              <Textarea
                placeholder="Bio"
                value={form.bio}
                onChange={(event) => setField("bio", event.target.value)}
              />
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Crianças</h2>
                <KidarioButton size="sm" variant="outline" onClick={addChild}>
                  <Plus className="w-4 h-4" />
                  Adicionar
                </KidarioButton>
              </div>
              {form.children.map((child, index) => (
                <div key={child.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      Criança {index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    placeholder="Nome"
                    value={child.name || ""}
                    onChange={(event) => updateChild(index, "name", event.target.value)}
                  />
                  <Input
                    placeholder="Série atual"
                    value={child.current_grade || ""}
                    onChange={(event) => updateChild(index, "current_grade", event.target.value)}
                  />
                  <Input
                    placeholder="Escola"
                    value={child.school || ""}
                    onChange={(event) => updateChild(index, "school", event.target.value)}
                  />
                  <Textarea
                    placeholder="Pontos de atenção"
                    value={child.focus_points || ""}
                    onChange={(event) => updateChild(index, "focus_points", event.target.value)}
                  />
                </div>
              ))}
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}

            <KidarioButton size="lg" variant="hero" fullWidth onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar perfil"}
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
