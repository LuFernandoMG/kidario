import { type KeyboardEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/Chip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignupStepCarousel, type SignupStep } from "@/components/forms/SignupStepCarousel";
import {
  WeeklyAvailabilityCalendar,
  type WeeklyAvailabilitySlot,
} from "@/components/teacher/WeeklyAvailabilityCalendar";

interface AcademicFormation {
  degreeType: string;
  courseName: string;
  institution: string;
  completionYear: string;
}

interface ProfessionalExperience {
  institution: string;
  role: string;
  responsibilities: string;
  periodFrom: string;
  periodTo: string;
  currentPosition: boolean;
}

interface TeacherSignupFormData {
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  professionalRegistration: string;
  city: string;
  state: string;
  modality: string;
  miniBio: string;
  hourlyRate: string;
  lessonDuration: string;
  profilePhoto: File | null;
  requestExperienceAnonymity: boolean;
  acceptTerms: boolean;
  specialties: string[];
  formations: AcademicFormation[];
  experiences: ProfessionalExperience[];
  weeklyAvailability: WeeklyAvailabilitySlot[];
}

const steps: SignupStep[] = [
  {
    title: "Perfil profissional",
    subtitle: "Dados, formacao e experiencia",
  },
  {
    title: "Agenda semanal",
    subtitle: "Horarios disponiveis para atendimento",
  },
];

const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const degreeTypes = [
  { value: "graduacao", label: "Graduacao" },
  { value: "pos-graduacao", label: "Pos-graduacao" },
  { value: "especializacao", label: "Especializacao" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
  { value: "curso-livre", label: "Curso livre / certificacao" },
];

const durationOptions = [
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "60 minutos" },
  { value: "75", label: "75 minutos" },
  { value: "90", label: "90 minutos" },
  { value: "120", label: "120 minutos" },
];

const createEmptyFormation = (): AcademicFormation => ({
  degreeType: "",
  courseName: "",
  institution: "",
  completionYear: "",
});

const createEmptyExperience = (): ProfessionalExperience => ({
  institution: "",
  role: "",
  responsibilities: "",
  periodFrom: "",
  periodTo: "",
  currentPosition: false,
});

export default function TeacherPrivateSignup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<TeacherSignupFormData>({
    fullName: "",
    email: "",
    phone: "",
    cpf: "",
    professionalRegistration: "",
    city: "",
    state: "",
    modality: "",
    miniBio: "",
    hourlyRate: "",
    lessonDuration: "",
    profilePhoto: null,
    requestExperienceAnonymity: false,
    acceptTerms: false,
    specialties: [],
    formations: [createEmptyFormation()],
    experiences: [],
    weeklyAvailability: [],
  });

  const setField = (
    field: keyof TeacherSignupFormData,
    value: string | File | null | string[] | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value as never }));
  };

  const addSpecialty = (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;

    const exists = formData.specialties.some(
      (specialty) => specialty.toLowerCase() === value.toLowerCase(),
    );
    if (exists) return;

    setFormData((prev) => ({ ...prev, specialties: [...prev.specialties, value] }));
    setSpecialtyInput("");
  };

  const removeSpecialty = (specialtyToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((specialty) => specialty !== specialtyToRemove),
    }));
  };

  const handleSpecialtyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSpecialty(specialtyInput.replace(",", ""));
    }
  };

  const updateFormation = (index: number, field: keyof AcademicFormation, value: string) => {
    setFormData((prev) => ({
      ...prev,
      formations: prev.formations.map((formation, formationIndex) =>
        formationIndex === index ? { ...formation, [field]: value } : formation,
      ),
    }));
  };

  const addFormation = () => {
    setFormData((prev) => ({
      ...prev,
      formations: [...prev.formations, createEmptyFormation()],
    }));
  };

  const removeFormation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      formations: prev.formations.filter((_, formationIndex) => formationIndex !== index),
    }));
  };

  const updateExperience = (
    index: number,
    field: keyof ProfessionalExperience,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      experiences: prev.experiences.map((experience, experienceIndex) =>
        experienceIndex === index ? { ...experience, [field]: value } : experience,
      ),
    }));
  };

  const addExperience = () => {
    setFormData((prev) => ({
      ...prev,
      experiences: [...prev.experiences, createEmptyExperience()],
    }));
  };

  const removeExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, experienceIndex) => experienceIndex !== index),
    }));
  };

  const validateStep = (step: number) => {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.fullName.trim()) nextErrors.fullName = "Informe o nome completo.";
      if (!formData.email.trim()) nextErrors.email = "Informe o e-mail.";
      if (!formData.phone.trim()) nextErrors.phone = "Informe o telefone.";
      if (!formData.cpf.trim()) nextErrors.cpf = "Informe o CPF.";
      if (!formData.professionalRegistration.trim()) {
        nextErrors.professionalRegistration = "Informe o registro profissional.";
      }
      if (!formData.city.trim()) nextErrors.city = "Informe a cidade.";
      if (!formData.state) nextErrors.state = "Selecione a UF.";
      if (!formData.modality) nextErrors.modality = "Selecione a modalidade.";
      if (!formData.lessonDuration) nextErrors.lessonDuration = "Selecione a duracao media da aula.";
      if (!formData.hourlyRate.trim()) nextErrors.hourlyRate = "Informe o custo por hora.";
      if (!formData.profilePhoto) nextErrors.profilePhoto = "Adicione uma foto de perfil.";
      if (!formData.miniBio.trim()) nextErrors.miniBio = "Informe uma mini bio profissional.";
      if (formData.specialties.length === 0) {
        nextErrors.specialties = "Adicione pelo menos uma especialidade.";
      }
      if (!formData.acceptTerms) {
        nextErrors.acceptTerms = "Voce precisa aceitar os termos e condicoes.";
      }

      formData.formations.forEach((formation, index) => {
        const prefix = `formations.${index}`;
        if (!formation.degreeType) nextErrors[`${prefix}.degreeType`] = "Selecione o tipo.";
        if (!formation.courseName.trim()) nextErrors[`${prefix}.courseName`] = "Informe o curso.";
        if (!formation.institution.trim()) nextErrors[`${prefix}.institution`] = "Informe a instituicao.";
      });

      formData.experiences.forEach((experience, index) => {
        const prefix = `experiences.${index}`;
        if (!experience.institution.trim()) nextErrors[`${prefix}.institution`] = "Informe a escola/instituicao.";
        if (!experience.role.trim()) nextErrors[`${prefix}.role`] = "Informe o cargo.";
        if (!experience.periodFrom) nextErrors[`${prefix}.periodFrom`] = "Informe o inicio.";
        if (!experience.currentPosition && !experience.periodTo) {
          nextErrors[`${prefix}.periodTo`] = "Informe o termino.";
        }
        if (!experience.responsibilities.trim()) {
          nextErrors[`${prefix}.responsibilities`] = "Descreva o que fazia.";
        }
      });
    }

    if (step === 1) {
      if (formData.weeklyAvailability.length === 0) {
        nextErrors.weeklyAvailability = "Adicione pelo menos um horario semanal.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBackStep = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < steps.length - 1) {
      handleNextStep();
      return;
    }

    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </Link>
      </motion.div>

      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8"
      >
        <h1 className="font-display text-3xl font-bold text-foreground">
          Cadastro privado de professoras
        </h1>
        <p className="text-muted-foreground mt-2">
          Fluxo interno para onboarding de profissionais convidadas.
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6"
      >
        <SignupStepCarousel steps={steps} currentStep={currentStep} />
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 pb-8 space-y-5"
        onSubmit={handleSubmit}
      >
        {currentStep === 0 && (
          <>
            <section className="card-kidario p-5 space-y-4">
              <h2 className="font-display text-xl font-semibold text-foreground">Dados basicos</h2>

              <FormField label="Nome completo">
                <Input
                  value={formData.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  placeholder="Nome completo"
                  className="h-12 rounded-xl bg-muted/50"
                />
                <FieldError message={errors.fullName} />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="E-mail">
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="email@exemplo.com"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.email} />
                </FormField>

                <FormField label="Telefone / WhatsApp">
                  <Input
                    value={formData.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.phone} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="CPF">
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setField("cpf", e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.cpf} />
                </FormField>

                <FormField label="Registro profissional (pedagogo/professor)">
                  <Input
                    value={formData.professionalRegistration}
                    onChange={(e) => setField("professionalRegistration", e.target.value)}
                    placeholder="Numero do registro profissional"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.professionalRegistration} />
                </FormField>
              </div>

              <FormField label="Foto de perfil">
                <Input
                  type="file"
                  accept="image/*"
                  className="h-12 rounded-xl bg-muted/50 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setField("profilePhoto", file);
                  }}
                />
                {formData.profilePhoto && (
                  <p className="text-xs text-muted-foreground">
                    Arquivo selecionado: {formData.profilePhoto.name}
                  </p>
                )}
                <FieldError message={errors.profilePhoto} />
              </FormField>
            </section>

            <section className="card-kidario p-5 space-y-4">
              <h2 className="font-display text-xl font-semibold text-foreground">Perfil profissional</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Cidade">
                  <Input
                    value={formData.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="Cidade"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.city} />
                </FormField>

                <FormField label="Estado (UF)">
                  <Select value={formData.state} onValueChange={(value) => setField("state", value)}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                      <SelectValue placeholder="Selecione a UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.state} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Custo por hora (R$)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setField("hourlyRate", e.target.value)}
                    placeholder="Ex.: 320"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors.hourlyRate} />
                </FormField>

                <FormField label="Duracao media da aula">
                  <Select
                    value={formData.lessonDuration}
                    onValueChange={(value) => setField("lessonDuration", value)}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                      <SelectValue placeholder="Selecione a duracao" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((duration) => (
                        <SelectItem key={duration.value} value={duration.value}>
                          {duration.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.lessonDuration} />
                </FormField>
              </div>

              <FormField label="Modalidade de atendimento">
                <Select value={formData.modality} onValueChange={(value) => setField("modality", value)}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                    <SelectValue placeholder="Selecione a modalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Hibrido</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={errors.modality} />
              </FormField>

              <FormField label="Especialidades (tags)">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={specialtyInput}
                    onChange={(e) => setSpecialtyInput(e.target.value)}
                    onKeyDown={handleSpecialtyKeyDown}
                    placeholder="Digite e pressione Enter"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <KidarioButton
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => addSpecialty(specialtyInput)}
                  >
                    Adicionar
                  </KidarioButton>
                </div>

                {formData.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.specialties.map((specialty) => (
                      <button
                        key={specialty}
                        type="button"
                        onClick={() => removeSpecialty(specialty)}
                        className="group"
                      >
                        <Chip variant="mint" size="md" className="gap-2 cursor-pointer">
                          {specialty}
                          <X className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                        </Chip>
                      </button>
                    ))}
                  </div>
                )}
                <FieldError message={errors.specialties} />
              </FormField>

              <FormField label="Mini bio profissional">
                <Textarea
                  value={formData.miniBio}
                  onChange={(e) => setField("miniBio", e.target.value)}
                  placeholder="Resumo da experiencia e abordagem pedagogica."
                  className="min-h-[110px] rounded-xl bg-muted/50"
                />
                <FieldError message={errors.miniBio} />
              </FormField>
            </section>

            <section className="card-kidario p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-foreground">Formacao academica</h2>
                <KidarioButton type="button" variant="outline" size="sm" onClick={addFormation}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </KidarioButton>
              </div>

              {formData.formations.map((formation, index) => (
                <div key={index} className="card-kidario p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">Formacao {index + 1}</p>
                    {formData.formations.length > 1 && (
                      <KidarioButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFormation(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </KidarioButton>
                    )}
                  </div>

                  <FormField label="Tipo">
                    <Select
                      value={formation.degreeType}
                      onValueChange={(value) => updateFormation(index, "degreeType", value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-muted/50">
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
                    <FieldError message={errors[`formations.${index}.degreeType`]} />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Curso">
                      <Input
                        value={formation.courseName}
                        onChange={(e) => updateFormation(index, "courseName", e.target.value)}
                        placeholder="Ex.: Pedagogia"
                        className="h-12 rounded-xl bg-muted/50"
                      />
                      <FieldError message={errors[`formations.${index}.courseName`]} />
                    </FormField>

                    <FormField label="Instituicao">
                      <Input
                        value={formation.institution}
                        onChange={(e) => updateFormation(index, "institution", e.target.value)}
                        placeholder="Ex.: USP"
                        className="h-12 rounded-xl bg-muted/50"
                      />
                      <FieldError message={errors[`formations.${index}.institution`]} />
                    </FormField>
                  </div>

                  <FormField label="Ano de conclusao (opcional)">
                    <Input
                      type="number"
                      min={1950}
                      max={2100}
                      value={formation.completionYear}
                      onChange={(e) => updateFormation(index, "completionYear", e.target.value)}
                      placeholder="Ex.: 2020"
                      className="h-12 rounded-xl bg-muted/50"
                    />
                  </FormField>
                </div>
              ))}
            </section>

            <section className="card-kidario p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Experiencia profissional
                </h2>
                <KidarioButton type="button" variant="outline" size="sm" onClick={addExperience}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </KidarioButton>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="anonimato-experiencia"
                    checked={formData.requestExperienceAnonymity}
                    onCheckedChange={(checked) => {
                      setField("requestExperienceAnonymity", checked === true);
                    }}
                  />
                  <label
                    htmlFor="anonimato-experiencia"
                    className="text-sm text-foreground cursor-pointer"
                  >
                    Solicitar anonimato na experiencia profissional
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se marcado, seus dados de experiencia poderao ser exibidos com anonimato na plataforma.
                </p>
              </div>

              {formData.experiences.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Experiencia profissional e opcional neste momento. Recem-graduadas podem seguir sem preencher.
                </div>
              )}

              {formData.experiences.map((experience, index) => (
                <div key={index} className="card-kidario p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">Experiencia {index + 1}</p>
                    <KidarioButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeExperience(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </KidarioButton>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Escola / instituicao">
                      <Input
                        value={experience.institution}
                        onChange={(e) => updateExperience(index, "institution", e.target.value)}
                        placeholder="Nome da escola ou instituicao"
                        className="h-12 rounded-xl bg-muted/50"
                      />
                      <FieldError message={errors[`experiences.${index}.institution`]} />
                    </FormField>

                    <FormField label="Cargo">
                      <Input
                        value={experience.role}
                        onChange={(e) => updateExperience(index, "role", e.target.value)}
                        placeholder="Ex.: Professora titular"
                        className="h-12 rounded-xl bg-muted/50"
                      />
                      <FieldError message={errors[`experiences.${index}.role`]} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 pt-6 sm:pt-8">
                        <Checkbox
                          id={`experiencia-atual-${index}`}
                          checked={experience.currentPosition}
                          onCheckedChange={(checked) => {
                            const isCurrent = checked === true;
                            updateExperience(index, "currentPosition", isCurrent);
                            if (isCurrent) {
                              updateExperience(index, "periodTo", "");
                            }
                          }}
                        />
                        <label
                          htmlFor={`experiencia-atual-${index}`}
                          className="text-sm text-foreground cursor-pointer"
                        >
                          Posicao atual
                        </label>
                      </div>
                    </div>
                    
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Periodo - inicio">
                      <Input
                        type="month"
                        value={experience.periodFrom}
                        onChange={(e) => updateExperience(index, "periodFrom", e.target.value)}
                        className="h-12 rounded-xl bg-muted/50"
                      />
                      <FieldError message={errors[`experiences.${index}.periodFrom`]} />
                    </FormField>
                    <FormField label="Periodo - termino">
                      <Input
                        type="month"
                        value={experience.periodTo}
                        onChange={(e) => updateExperience(index, "periodTo", e.target.value)}
                        className="h-12 rounded-xl bg-muted/50"
                        disabled={experience.currentPosition}
                      />
                      {experience.currentPosition && (
                        <p className="text-xs text-muted-foreground">
                          Como esta marcado como posicao atual, termino nao e obrigatorio.
                        </p>
                      )}
                      <FieldError message={errors[`experiences.${index}.periodTo`]} />
                    </FormField>
                  </div>

                  <FormField label="O que fazia nessa funcao">
                    <Textarea
                      value={experience.responsibilities}
                      onChange={(e) => updateExperience(index, "responsibilities", e.target.value)}
                      placeholder="Descreva responsabilidades e resultados."
                      className="min-h-[90px] rounded-xl bg-muted/50"
                    />
                    <FieldError message={errors[`experiences.${index}.responsibilities`]} />
                  </FormField>
                </div>
              ))}
            </section>

            <section className="card-kidario p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="aceite-termos-professora"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => {
                    setField("acceptTerms", checked === true);
                  }}
                />
                <label
                  htmlFor="aceite-termos-professora"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Li e aceito os termos e condicoes da plataforma
                </label>
              </div>
              <FieldError message={errors.acceptTerms} />
            </section>
          </>
        )}

        {currentStep === 1 && (
          <section className="card-kidario p-5 space-y-4">
            <h2 className="font-display text-xl font-semibold text-foreground">Agenda semanal</h2>
            <FieldError message={errors.weeklyAvailability} />
            <WeeklyAvailabilityCalendar
              value={formData.weeklyAvailability}
              slotDurationMinutes={Number(formData.lessonDuration) || 60}
              onChange={(slots) => {
                setFormData((prev) => ({
                  ...prev,
                  weeklyAvailability: slots,
                }));
              }}
            />
          </section>
        )}

        <div className="card-kidario p-4">
          <div className="flex items-center justify-between gap-3">
            <KidarioButton
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleBackStep}
              disabled={currentStep === 0}
            >
              Voltar
            </KidarioButton>

            {currentStep < steps.length - 1 ? (
              <KidarioButton type="submit" variant="hero" size="lg">
                Continuar
              </KidarioButton>
            ) : (
              <KidarioButton type="submit" variant="hero" size="lg" disabled={isLoading}>
                {isLoading ? "Enviando..." : "Salvar pre-cadastro"}
              </KidarioButton>
            )}
          </div>

          {isSubmitted && (
            <p className="text-sm text-success mt-3">
              Pre-cadastro enviado. A equipe Kidario revisara os dados em seguida.
            </p>
          )}
        </div>
      </motion.form>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
