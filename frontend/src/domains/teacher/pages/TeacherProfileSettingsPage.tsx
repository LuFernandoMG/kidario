import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseAccessToken, signOutFromSupabase } from "@/lib/authSession";
import { resolveTeacherAvatarUrl } from "@/lib/avatarUrl";
import {
  WeeklyAvailabilityCalendar,
  type WeeklyAvailabilitySlot,
} from "@/components/teacher/WeeklyAvailabilityCalendar";
import {
  getTeacherProfile,
  patchTeacherProfile,
  uploadTeacherProfilePhoto,
} from "@/domains/teacher/api/backendTeacherProfiles";

interface FormationForm {
  id?: string;
  degreeType: string;
  courseName: string;
  institution: string;
  completionYear: string;
}

interface ExperienceForm {
  id?: string;
  institution: string;
  role: string;
  responsibilities: string;
  periodFrom: string;
  periodTo: string;
  currentPosition: boolean;
}

interface TeacherFormState {
  firstName: string;
  lastName: string;
  phone: string;
  professionalRegistration: string;
  city: string;
  state: string;
  modality: string;
  miniBio: string;
  pricePerClass: string;
  lessonDurationMinutes: string;
  requestExperienceAnonymity: boolean;
  profilePhotoFileName: string;
  formations: FormationForm[];
  experiences: ExperienceForm[];
  weeklyAvailability: (WeeklyAvailabilitySlot & { id?: string })[];
}

const emptyForm: TeacherFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  professionalRegistration: "",
  city: "",
  state: "",
  modality: "",
  miniBio: "",
  pricePerClass: "",
  lessonDurationMinutes: "",
  requestExperienceAnonymity: false,
  profilePhotoFileName: "",
  formations: [],
  experiences: [],
  weeklyAvailability: [],
};

const durationOptions = [
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "60 minutos" },
  { value: "75", label: "75 minutos" },
  { value: "90", label: "90 minutos" },
  { value: "120", label: "120 minutos" },
];

const modalityOptions = [
  { value: "online", label: "Online" },
  { value: "presencial", label: "Presencial" },
  { value: "hibrido", label: "Híbrido" },
];

const degreeTypes = [
  { value: "graduacao", label: "Graduacao" },
  { value: "pos-graduacao", label: "Pos-graduacao" },
  { value: "especializacao", label: "Especializacao" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
  { value: "curso-livre", label: "Curso livre / certificacao" },
];

const dayLabelByValue = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
} as const;

const dayValueByNumber = {
  0: "segunda",
  1: "terca",
  2: "quarta",
  3: "quinta",
  4: "sexta",
  5: "sabado",
  6: "domingo",
} as const;

const dayNumberByValue = {
  segunda: 0,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sabado: 5,
  domingo: 6,
} as const;

function emptyFormation(): FormationForm {
  return {
    degreeType: "",
    courseName: "",
    institution: "",
    completionYear: "",
  };
}

function emptyExperience(): ExperienceForm {
  return {
    institution: "",
    role: "",
    responsibilities: "",
    periodFrom: "",
    periodTo: "",
    currentPosition: false,
  };
}

function getAvailabilityKey(dayOfWeek: string, startTime: string) {
  return `${dayOfWeek}|${startTime}`;
}

function mapDayNumberToValue(dayOfWeek: number): WeeklyAvailabilitySlot["dayOfWeek"] {
  return dayValueByNumber[dayOfWeek as keyof typeof dayValueByNumber] ?? "segunda";
}

function mapDayValueToNumber(dayOfWeek: string): number {
  return dayNumberByValue[dayOfWeek as keyof typeof dayNumberByValue] ?? 0;
}

export default function TeacherProfileSettings() {
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<TeacherFormState>(emptyForm);
  const [initialSnapshot, setInitialSnapshot] = useState<TeacherFormState>(emptyForm);
  const [deletedFormationIds, setDeletedFormationIds] = useState<string[]>([]);
  const [deletedExperienceIds, setDeletedExperienceIds] = useState<string[]>([]);

  const avatarUrl = useMemo(
    () => resolveTeacherAvatarUrl(form.profilePhotoFileName || undefined),
    [form.profilePhotoFileName],
  );

  const loadProfile = useCallback(async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil%2Fprofessora");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const payload = await getTeacherProfile(accessToken);
      const nextForm: TeacherFormState = {
        firstName: payload.profile.first_name || "",
        lastName: payload.profile.last_name || "",
        phone: payload.phone || "",
        professionalRegistration: payload.professional_registration || "",
        city: payload.city || "",
        state: payload.state || "",
        modality: payload.modality || "",
        miniBio: payload.mini_bio || "",
        pricePerClass: payload.hourly_rate != null ? String(payload.hourly_rate) : "",
        lessonDurationMinutes:
          payload.lesson_duration_minutes != null ? String(payload.lesson_duration_minutes) : "",
        requestExperienceAnonymity: payload.request_experience_anonymity,
        profilePhotoFileName: payload.profile_photo_file_name || "",
        formations: (payload.formations || []).map((formation) => ({
          id: formation.id,
          degreeType: formation.degree_type,
          courseName: formation.course_name,
          institution: formation.institution,
          completionYear: formation.completion_year || "",
        })),
        experiences: (payload.experiences || []).map((experience) => ({
          id: experience.id,
          institution: experience.institution,
          role: experience.role,
          responsibilities: experience.responsibilities,
          periodFrom: experience.period_from,
          periodTo: experience.period_to || "",
          currentPosition: experience.current_position,
        })),
        weeklyAvailability: (payload.availability || []).map((slot) => ({
          id: slot.id,
          dayOfWeek: mapDayNumberToValue(slot.day_of_week),
          startTime: slot.start_time,
          endTime: slot.end_time,
        })),
      };
      setEmail(payload.profile.email);
      setForm(nextForm);
      setInitialSnapshot(nextForm);
      setDeletedFormationIds([]);
      setDeletedExperienceIds([]);
      setIsEditing(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar o perfil da professora.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const setField = (
    field: Exclude<keyof TeacherFormState, "formations" | "experiences">,
    value: string | boolean,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateFormation = (index: number, field: keyof FormationForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      formations: prev.formations.map((formation, formationIndex) =>
        formationIndex === index ? { ...formation, [field]: value } : formation,
      ),
    }));
  };

  const addFormation = () => {
    setForm((prev) => ({
      ...prev,
      formations: [...prev.formations, emptyFormation()],
    }));
  };

  const removeFormation = (index: number) => {
    const target = form.formations[index];
    if (target?.id) {
      setDeletedFormationIds((current) => [...current, target.id as string]);
    }
    setForm((prev) => ({
      ...prev,
      formations: prev.formations.filter((_, formationIndex) => formationIndex !== index),
    }));
  };

  const updateExperience = (
    index: number,
    field: keyof ExperienceForm,
    value: string | boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.map((experience, experienceIndex) =>
        experienceIndex === index ? { ...experience, [field]: value } : experience,
      ),
    }));
  };

  const addExperience = () => {
    setForm((prev) => ({
      ...prev,
      experiences: [...prev.experiences, emptyExperience()],
    }));
  };

  const removeExperience = (index: number) => {
    const target = form.experiences[index];
    if (target?.id) {
      setDeletedExperienceIds((current) => [...current, target.id as string]);
    }
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, experienceIndex) => experienceIndex !== index),
    }));
  };

  const handleStartEdit = () => {
    setError("");
    setNotice("");
    setInitialSnapshot(form);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setForm(initialSnapshot);
    setDeletedFormationIds([]);
    setDeletedExperienceIds([]);
    setError("");
    setNotice("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil%2Fprofessora");
      return;
    }

    if (!isEditing) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Preencha nome e sobrenome.");
      return;
    }
    if (form.weeklyAvailability.length < 1) {
      setError("Defina pelo menos um horário de disponibilidade semanal.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const currentAvailabilityIds = new Set(
        form.weeklyAvailability
          .map((slot) => slot.id)
          .filter((id): id is string => Boolean(id)),
      );
      const availabilityDeleteIds = initialSnapshot.weeklyAvailability
        .map((slot) => slot.id)
        .filter((id): id is string => Boolean(id) && !currentAvailabilityIds.has(id));

      await patchTeacherProfile(accessToken, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        professional_registration: form.professionalRegistration.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        modality: form.modality.trim() || undefined,
        mini_bio: form.miniBio.trim() || undefined,
        hourly_rate: form.pricePerClass ? Number(form.pricePerClass) : undefined,
        lesson_duration_minutes: form.lessonDurationMinutes
          ? Number(form.lessonDurationMinutes)
          : undefined,
        request_experience_anonymity: form.requestExperienceAnonymity,
        formations_ops: {
          upsert: form.formations.map((formation) => ({
            id: formation.id,
            degree_type: formation.degreeType,
            course_name: formation.courseName,
            institution: formation.institution,
            completion_year: formation.completionYear || null,
          })),
          delete_ids: deletedFormationIds,
        },
        experiences_ops: {
          upsert: form.experiences.map((experience) => ({
            id: experience.id,
            institution: experience.institution,
            role: experience.role,
            responsibilities: experience.responsibilities,
            period_from: experience.periodFrom,
            period_to: experience.currentPosition ? null : experience.periodTo || null,
            current_position: experience.currentPosition,
          })),
          delete_ids: deletedExperienceIds,
        },
        availability_ops: {
          upsert: form.weeklyAvailability.map((slot) => ({
            id: slot.id,
            day_of_week: mapDayValueToNumber(slot.dayOfWeek),
            start_time: slot.startTime,
            end_time: slot.endTime,
          })),
          delete_ids: availabilityDeleteIds,
        },
      });
      setNotice("Perfil da professora atualizado com sucesso.");
      await loadProfile();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil da professora.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil%2Fprofessora");
      return;
    }
    setIsUploadingPhoto(true);
    setError("");
    setNotice("");

    try {
      const result = await uploadTeacherProfilePhoto(accessToken, file);
      setForm((prev) => ({ ...prev, profilePhotoFileName: result.profile_photo_file_name }));
      setNotice("Foto de perfil atualizada com sucesso.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Não foi possível atualizar a foto.",
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const onPhotoFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUploadPhoto(file);
    event.target.value = "";
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    navigate("/");
  };

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-foreground">Perfil</h1>
          <p className="text-muted-foreground mt-1">Veja e atualize seus dados profissionais.</p>
        </motion.div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando perfil...</p>
        ) : (
          <>
            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center gap-4">
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-20 h-20 rounded-2xl object-cover border border-border"
                />
                <div className="space-y-2 flex-1">
                  <div className="text-sm text-muted-foreground">{email}</div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPhotoFileSelected}
                    className="hidden"
                  />
                  <KidarioButton
                    size="sm"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    <Camera className="w-4 h-4" />
                    {isUploadingPhoto ? "Enviando imagem..." : "Atualizar imagem"}
                  </KidarioButton>
                </div>
              </div>
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Disponibilidade semanal</h2>
              </div>
              {form.weeklyAvailability.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário selecionado.
                </p>
              )}
              {!isEditing && form.weeklyAvailability.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <ul className="space-y-1">
                    {form.weeklyAvailability
                      .slice()
                      .sort((a, b) => getAvailabilityKey(a.dayOfWeek, a.startTime).localeCompare(getAvailabilityKey(b.dayOfWeek, b.startTime)))
                      .map((slot, index) => (
                        <li key={`${slot.dayOfWeek}-${slot.startTime}-${index}`} className="text-sm text-foreground">
                          {dayLabelByValue[slot.dayOfWeek as keyof typeof dayLabelByValue]} · {slot.startTime} - {slot.endTime}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {isEditing && (
                <WeeklyAvailabilityCalendar
                  value={form.weeklyAvailability.map((slot) => ({
                    dayOfWeek: slot.dayOfWeek,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                  }))}
                  onChange={(nextSlots) =>
                    setForm((previous) => {
                      const previousByKey = new Map(
                        previous.weeklyAvailability.map((slot) => [getAvailabilityKey(slot.dayOfWeek, slot.startTime), slot]),
                      );
                      return {
                        ...previous,
                        weeklyAvailability: nextSlots.map((slot) => ({
                          id: previousByKey.get(getAvailabilityKey(slot.dayOfWeek, slot.startTime))?.id,
                          dayOfWeek: slot.dayOfWeek,
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                        })),
                      };
                    })
                  }
                  slotDurationMinutes={Number(form.lessonDurationMinutes) || 60}
                />
              )}
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Dados profissionais</h2>
                {!isEditing ? (
                  <KidarioButton size="sm" variant="outline" onClick={handleStartEdit}>
                    <Pencil className="w-4 h-4" />
                    Editar dados
                  </KidarioButton>
                ) : (
                  <KidarioButton size="sm" variant="ghost" onClick={handleCancelEdit}>
                    <X className="w-4 h-4" />
                    Cancelar
                  </KidarioButton>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome">
                  <Input
                    value={form.firstName}
                    onChange={(event) => setField("firstName", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
                <Field label="Sobrenome">
                  <Input
                    value={form.lastName}
                    onChange={(event) => setField("lastName", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Telefone">
                  <Input
                    value={form.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
                <Field label="Registro profissional">
                  <Input
                    value={form.professionalRegistration}
                    onChange={(event) => setField("professionalRegistration", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Cidade">
                  <Input
                    value={form.city}
                    onChange={(event) => setField("city", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
                <Field label="Estado">
                  <Input
                    value={form.state}
                    onChange={(event) => setField("state", event.target.value)}
                    disabled={!isEditing}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Modalidade">
                  <Select
                    value={form.modality || undefined}
                    onValueChange={(value) => setField("modality", value)}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {modalityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Duração da aula">
                  <Select
                    value={form.lessonDurationMinutes || undefined}
                    onValueChange={(value) => setField("lessonDurationMinutes", value)}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a duração" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Valor por aula (R$)">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.pricePerClass}
                  onChange={(event) => setField("pricePerClass", event.target.value)}
                  disabled={!isEditing}
                />
              </Field>

              <Field label="Mini bio">
                <Textarea
                  value={form.miniBio}
                  onChange={(event) => setField("miniBio", event.target.value)}
                  disabled={!isEditing}
                />
              </Field>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  checked={form.requestExperienceAnonymity}
                  onCheckedChange={(checked) => setField("requestExperienceAnonymity", Boolean(checked))}
                  disabled={!isEditing}
                />
                <label className="text-sm text-foreground">
                  Solicitar anonimato da experiência profissional
                </label>
              </div>
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Formação acadêmica</h2>
                {isEditing && (
                  <KidarioButton size="sm" variant="outline" onClick={addFormation}>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </KidarioButton>
                )}
              </div>

              {form.formations.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma formação cadastrada.</p>
              )}

              {form.formations.map((formation, index) => (
                <div key={formation.id || `formation-${index}`} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Formação {index + 1}</span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeFormation(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Field label="Tipo de formação">
                    <Select
                      value={formation.degreeType || undefined}
                      onValueChange={(value) => updateFormation(index, "degreeType", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {degreeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Curso">
                    <Input
                      value={formation.courseName}
                      onChange={(event) => updateFormation(index, "courseName", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Instituição">
                    <Input
                      value={formation.institution}
                      onChange={(event) => updateFormation(index, "institution", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Ano de conclusão">
                    <Input
                      value={formation.completionYear}
                      onChange={(event) => updateFormation(index, "completionYear", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>
                </div>
              ))}
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Experiência profissional</h2>
                {isEditing && (
                  <KidarioButton size="sm" variant="outline" onClick={addExperience}>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </KidarioButton>
                )}
              </div>

              {form.experiences.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma experiência cadastrada.</p>
              )}

              {form.experiences.map((experience, index) => (
                <div key={experience.id || `experience-${index}`} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Experiência {index + 1}</span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeExperience(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <Field label="Instituição">
                    <Input
                      value={experience.institution}
                      onChange={(event) => updateExperience(index, "institution", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Cargo">
                    <Input
                      value={experience.role}
                      onChange={(event) => updateExperience(index, "role", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Responsabilidades">
                    <Textarea
                      value={experience.responsibilities}
                      onChange={(event) => updateExperience(index, "responsibilities", event.target.value)}
                      disabled={!isEditing}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Início">
                      <Input
                        value={experience.periodFrom}
                        onChange={(event) => updateExperience(index, "periodFrom", event.target.value)}
                        disabled={!isEditing}
                      />
                    </Field>
                    <Field label="Término">
                      <Input
                        value={experience.periodTo}
                        onChange={(event) => updateExperience(index, "periodTo", event.target.value)}
                        disabled={!isEditing || experience.currentPosition}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={experience.currentPosition}
                      onCheckedChange={(checked) => {
                        const isCurrent = Boolean(checked);
                        updateExperience(index, "currentPosition", isCurrent);
                        if (isCurrent) updateExperience(index, "periodTo", "");
                      }}
                      disabled={!isEditing}
                    />
                    <label className="text-sm text-foreground">Atualmente nesse cargo</label>
                  </div>
                </div>
              ))}
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}

            {isEditing && (
              <KidarioButton size="lg" variant="hero" fullWidth onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </KidarioButton>
            )}

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
