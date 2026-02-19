import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
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
import { SignupStepCarousel, type SignupStep } from "@/components/forms/SignupStepCarousel";
import { getSupabaseAccessToken, signUpWithEmailPassword } from "@/lib/authSession";
import { patchParentProfile } from "@/lib/backendProfiles";
import { clearPendingProfileSync, savePendingProfileSync } from "@/lib/pendingProfileSync";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";

interface ChildFormData {
  name: string;
  gender: string;
  age: string;
  currentGrade: string;
  birthMonthYear: string;
  school: string;
  focusPoints: string;
}

interface ParentSignupFormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  birthDate: string;
  address: string;
  bio: string;
  children: ChildFormData[];
}

const signupSteps: SignupStep[] = [
  {
    title: "Informacoes basicas",
    subtitle: "Dados de contato e acesso",
  },
  {
    title: "Perfil da familia",
    subtitle: "Endereco e objetivo pedagogico",
  },
  {
    title: "Registro de filhos",
    subtitle: "Cadastro de um ou mais filhos",
  },
];

const brazilianGradeOptions = [
  { value: "creche", label: "Creche" },
  { value: "pre-escola", label: "Pre-escola" },
  { value: "1-ano-fundamental", label: "1º ano - Ensino Fundamental" },
  { value: "2-ano-fundamental", label: "2º ano - Ensino Fundamental" },
  { value: "3-ano-fundamental", label: "3º ano - Ensino Fundamental" },
  { value: "4-ano-fundamental", label: "4º ano - Ensino Fundamental" },
  { value: "5-ano-fundamental", label: "5º ano - Ensino Fundamental" },
  { value: "6-ano-fundamental", label: "6º ano - Ensino Fundamental" },
  { value: "7-ano-fundamental", label: "7º ano - Ensino Fundamental" },
  { value: "8-ano-fundamental", label: "8º ano - Ensino Fundamental" },
  { value: "9-ano-fundamental", label: "9º ano - Ensino Fundamental" },
  { value: "1-serie-medio", label: "1ª serie - Ensino Medio" },
  { value: "2-serie-medio", label: "2ª serie - Ensino Medio" },
  { value: "3-serie-medio", label: "3ª serie - Ensino Medio" },
  { value: "eja", label: "EJA (Educacao de Jovens e Adultos)" },
];

const createEmptyChild = (): ChildFormData => ({
  name: "",
  gender: "",
  age: "",
  currentGrade: "",
  birthMonthYear: "",
  school: "",
  focusPoints: "",
});

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToParam = searchParams.get("returnTo");
  const roleParam = searchParams.get("role");
  const authQuery = searchParams.toString();
  const loginLink = authQuery ? `/login?${authQuery}` : "/login";

  const decodedReturnTo = useMemo(() => {
    if (!returnToParam) return "";
    try {
      return decodeURIComponent(returnToParam);
    } catch {
      return returnToParam;
    }
  }, [returnToParam]);

  const [currentStep, setCurrentStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [formData, setFormData] = useState<ParentSignupFormData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    birthDate: "",
    address: "",
    bio: "",
    children: [createEmptyChild()],
  });

  const setField = (field: keyof ParentSignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addChild = () => {
    setFormData((prev) => ({
      ...prev,
      children: [...prev.children, createEmptyChild()],
    }));
  };

  const removeChild = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.filter((_, childIndex) => childIndex !== index),
    }));
  };

  const updateChild = (index: number, field: keyof ChildFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.map((child, childIndex) =>
        childIndex === index ? { ...child, [field]: value } : child,
      ),
    }));
  };

  const validateStep = (step: number) => {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.firstName.trim()) nextErrors.firstName = "Informe seu nome.";
      if (!formData.lastName.trim()) nextErrors.lastName = "Informe seu sobrenome.";
      if (!formData.phone.trim()) nextErrors.phone = "Informe seu telefone.";
      if (!formData.email.trim()) nextErrors.email = "Informe seu e-mail.";
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        nextErrors.email = "Informe um e-mail valido.";
      }
      if (!formData.birthDate) nextErrors.birthDate = "Informe sua data de nascimento.";
      if (!formData.password) nextErrors.password = "Crie uma senha.";
      if (formData.password && formData.password.length < 8) {
        nextErrors.password = "A senha deve ter pelo menos 8 caracteres.";
      }
      if (!formData.confirmPassword) nextErrors.confirmPassword = "Repita sua senha.";
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "As senhas nao coincidem.";
      }
    }

    if (step === 1) {
      if (!formData.address.trim()) nextErrors.address = "Informe seu endereco.";
      if (!formData.bio.trim()) {
        nextErrors.bio = "Conte um pouco sobre o que voce busca para seus filhos.";
      }
    }

    if (step === 2) {
      if (formData.children.length === 0) {
        nextErrors.children = "Adicione pelo menos um filho.";
      }

      formData.children.forEach((child, index) => {
        const prefix = `children.${index}`;

        if (!child.name.trim()) nextErrors[`${prefix}.name`] = "Informe o nome do filho.";
        if (!child.gender) nextErrors[`${prefix}.gender`] = "Selecione o genero.";
        if (!child.age) nextErrors[`${prefix}.age`] = "Informe a idade.";
        if (child.age && (Number(child.age) < 1 || Number(child.age) > 18)) {
          nextErrors[`${prefix}.age`] = "A idade deve estar entre 1 e 18 anos.";
        }
        if (!child.currentGrade.trim()) nextErrors[`${prefix}.currentGrade`] = "Informe o curso atual.";
        if (!child.birthMonthYear) nextErrors[`${prefix}.birthMonthYear`] = "Informe mes e ano.";
        if (!child.school.trim()) nextErrors[`${prefix}.school`] = "Informe a escola.";
        if (!child.focusPoints.trim()) nextErrors[`${prefix}.focusPoints`] = "Descreva os pontos de atencao.";
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, signupSteps.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitNotice("");

    if (currentStep < signupSteps.length - 1) {
      handleNext();
      return;
    }

    if (!validateStep(currentStep)) return;

    setIsLoading(true);

    try {
      const parentProfilePayload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        birth_date: formData.birthDate,
        address: formData.address,
        bio: formData.bio,
        children_ops: {
          upsert: formData.children.map((child) => ({
            name: child.name,
            gender: child.gender,
            age: Number(child.age),
            current_grade: child.currentGrade,
            birth_month_year: child.birthMonthYear,
            school: child.school,
            focus_points: child.focusPoints,
          })),
          delete_ids: [],
        },
      };

      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const result = await signUpWithEmailPassword({
        email: formData.email,
        password: formData.password,
        fullName,
        role: "parent",
        metadata: {
          signup_source: "parent_public",
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          birth_date: formData.birthDate,
          address: formData.address,
          bio: formData.bio,
          children: formData.children.map((child) => ({
            name: child.name,
            gender: child.gender,
            age: Number(child.age),
            current_grade: child.currentGrade,
            birth_month_year: child.birthMonthYear,
            school: child.school,
            focus_points: child.focusPoints,
          })),
        },
      });

      if (result.emailConfirmationRequired) {
        savePendingProfileSync({
          role: "parent",
          email: formData.email,
          payload: parentProfilePayload,
        });

        const params = new URLSearchParams();
        params.set("email", formData.email);
        params.set("notice", "check-email");
        if (decodedReturnTo) params.set("returnTo", encodeURIComponent(decodedReturnTo));
        if (roleParam === "parent" || roleParam === "teacher") params.set("role", roleParam);

        navigate(`/login?${params.toString()}`);
        return;
      }

      const accessToken = getSupabaseAccessToken();
      if (!accessToken) {
        throw new Error("Conta criada no Auth, mas token não encontrado para salvar o perfil.");
      }

      savePendingProfileSync({
        role: "parent",
        email: formData.email,
        payload: parentProfilePayload,
      });
      await patchParentProfile(accessToken, parentProfilePayload);
      clearPendingProfileSync();

      navigate(decodedReturnTo || "/explorar");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível criar sua conta.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Criar conta"
      subtitle="Cadastro publico para pais e responsaveis."
      titleContainerClassName="mt-8"
      contentContainerClassName="mt-0"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6"
      >
        <SignupStepCarousel steps={signupSteps} currentStep={currentStep} />
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 pb-8 space-y-5"
        onSubmit={handleSubmit}
      >
        {currentStep === 0 && (
          <section className="card-kidario p-5 space-y-4">
            <h2 className="font-display text-xl font-semibold text-foreground">Dados basicos</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                  Nome
                </label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  placeholder="Seu nome"
                  className="h-12 rounded-xl bg-muted/50"
                />
                <FieldError message={errors.firstName} />
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                  Sobrenome
                </label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  placeholder="Seu sobrenome"
                  className="h-12 rounded-xl bg-muted/50"
                />
                <FieldError message={errors.lastName} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Telefone
              </label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-12 rounded-xl bg-muted/50"
              />
              <FieldError message={errors.phone} />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="seu@email.com"
                className="h-12 rounded-xl bg-muted/50"
              />
              <FieldError message={errors.email} />
            </div>

            <div className="space-y-2">
              <label htmlFor="birthDate" className="text-sm font-medium text-foreground">
                Data de nascimento
              </label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setField("birthDate", e.target.value)}
                className="h-12 rounded-xl bg-muted/50"
              />
              <FieldError message={errors.birthDate} />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  className="h-12 rounded-xl bg-muted/50 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Repetir senha
              </label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                placeholder="Repita sua senha"
                className="h-12 rounded-xl bg-muted/50"
              />
              <FieldError message={errors.confirmPassword} />
            </div>
          </section>
        )}

        {currentStep === 1 && (
          <section className="card-kidario p-5 space-y-4">
            <h2 className="font-display text-xl font-semibold text-foreground">Perfil da familia</h2>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium text-foreground">
                Endereco
              </label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="Rua, numero, bairro, cidade"
                className="h-12 rounded-xl bg-muted/50"
              />
              <FieldError message={errors.address} />
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium text-foreground">
                Biografia curta / o que voce esta buscando para seus filhos
              </label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setField("bio", e.target.value)}
                placeholder="Conte objetivos, rotina e o tipo de apoio pedagogico que deseja."
                className="min-h-[120px] rounded-xl bg-muted/50"
              />
              <FieldError message={errors.bio} />
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="space-y-4">
            {errors.children && <FieldError message={errors.children} />}
            {formData.children.map((child, index) => (
              <div key={index} className="card-kidario p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    Filho {index + 1}
                  </h2>
                  {formData.children.length > 1 && (
                    <KidarioButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeChild(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </KidarioButton>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nome do filho</label>
                  <Input
                    value={child.name}
                    onChange={(e) => updateChild(index, "name", e.target.value)}
                    placeholder="Nome completo"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors[`children.${index}.name`]} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Genero</label>
                  <Select value={child.gender} onValueChange={(value) => updateChild(index, "gender", value)}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                      <SelectValue placeholder="Selecione o genero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feminino">Menina</SelectItem>
                      <SelectItem value="masculino">Menino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao_informar">Prefiro nao informar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError message={errors[`children.${index}.gender`]} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Idade</label>
                    <Input
                      type="number"
                      min={1}
                      max={18}
                      value={child.age}
                      onChange={(e) => updateChild(index, "age", e.target.value)}
                      placeholder="Ex.: 8"
                      className="h-12 rounded-xl bg-muted/50"
                    />
                    <FieldError message={errors[`children.${index}.age`]} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Curso atual</label>
                    <Select
                      value={child.currentGrade}
                      onValueChange={(value) => updateChild(index, "currentGrade", value)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-muted/50">
                        <SelectValue placeholder="Selecione o curso atual" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianGradeOptions.map((grade) => (
                          <SelectItem key={grade.value} value={grade.value}>
                            {grade.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors[`children.${index}.currentGrade`]} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mes e ano de nascimento</label>
                  <Input
                    type="month"
                    value={child.birthMonthYear}
                    onChange={(e) => updateChild(index, "birthMonthYear", e.target.value)}
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors[`children.${index}.birthMonthYear`]} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Escola</label>
                  <Input
                    value={child.school}
                    onChange={(e) => updateChild(index, "school", e.target.value)}
                    placeholder="Nome da escola"
                    className="h-12 rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors[`children.${index}.school`]} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Pontos de atencao que querem fortalecer
                  </label>
                  <Textarea
                    value={child.focusPoints}
                    onChange={(e) => updateChild(index, "focusPoints", e.target.value)}
                    placeholder="Ex.: leitura, concentracao, coordenacao motora, linguagem..."
                    className="min-h-[96px] rounded-xl bg-muted/50"
                  />
                  <FieldError message={errors[`children.${index}.focusPoints`]} />
                </div>
              </div>
            ))}

            <KidarioButton type="button" variant="outline" size="lg" fullWidth onClick={addChild}>
              <Plus className="w-5 h-5" />
              Adicionar outro filho
            </KidarioButton>
          </section>
        )}

        <div className="card-kidario p-4">
          <div className="flex items-center justify-between gap-3">
            <KidarioButton
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Voltar
            </KidarioButton>

            {currentStep < signupSteps.length - 1 ? (
              <KidarioButton type="submit" variant="hero" size="lg">
                Continuar
              </KidarioButton>
            ) : (
              <KidarioButton type="submit" variant="hero" size="lg" disabled={isLoading}>
                {isLoading ? "Criando conta..." : "Criar conta"}
              </KidarioButton>
            )}
          </div>
        </div>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-muted-foreground pb-8"
      >
        {submitNotice && <span className="block mb-3 text-sm text-success">{submitNotice}</span>}
        {submitError && <span className="block mb-3 text-sm text-destructive">{submitError}</span>}
        Ja tem conta?{" "}
        <Link to={loginLink} className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </motion.p>
    </AuthPageLayout>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
