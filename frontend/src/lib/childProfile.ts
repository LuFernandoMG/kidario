export type ChildGender = "girl" | "boy" | "other" | "prefer not to disclose";

export interface ChildGenderOption {
  value: ChildGender;
  label: string;
}

export const childGenderOptions: ChildGenderOption[] = [
  { value: "boy", label: "Menino" },
  { value: "girl", label: "Menina" },
  { value: "other", label: "Outro" },
  { value: "prefer not to disclose", label: "Prefiro não informar" },
];

const childGenderLabelMap = new Map(childGenderOptions.map((option) => [option.value, option.label]));

export function normalizeChildGender(gender?: string | null): ChildGender | null {
  if (!gender) return null;

  const normalized = gender.trim().toLowerCase();
  if (normalized === "girl" || normalized === "feminino" || normalized === "menina") return "girl";
  if (normalized === "boy" || normalized === "masculino" || normalized === "menino") return "boy";
  if (normalized === "other" || normalized === "outro") return "other";
  if (
    normalized === "prefer not to disclose"
    || normalized === "prefer_not_to_disclose"
    || normalized === "nao_informar"
    || normalized === "prefiro nao informar"
    || normalized === "prefiro não informar"
  ) {
    return "prefer not to disclose";
  }

  return null;
}

export function formatChildGenderLabel(gender?: string | null): string {
  const normalized = normalizeChildGender(gender);
  if (!normalized) return "Gênero não informado";
  return childGenderLabelMap.get(normalized) || "Gênero não informado";
}

export interface ChildGradeOption {
  value: string;
  label: string;
}

export const childGradeOptions: ChildGradeOption[] = [
  { value: "creche", label: "Creche" },
  { value: "pre-escola", label: "Pré-escola" },
  { value: "1-ano-fundamental", label: "1º ano - Ensino Fundamental" },
  { value: "2-ano-fundamental", label: "2º ano - Ensino Fundamental" },
  { value: "3-ano-fundamental", label: "3º ano - Ensino Fundamental" },
  { value: "4-ano-fundamental", label: "4º ano - Ensino Fundamental" },
  { value: "5-ano-fundamental", label: "5º ano - Ensino Fundamental" },
  { value: "6-ano-fundamental", label: "6º ano - Ensino Fundamental" },
  { value: "7-ano-fundamental", label: "7º ano - Ensino Fundamental" },
  { value: "8-ano-fundamental", label: "8º ano - Ensino Fundamental" },
  { value: "9-ano-fundamental", label: "9º ano - Ensino Fundamental" },
  { value: "1-serie-medio", label: "1ª série - Ensino Médio" },
  { value: "2-serie-medio", label: "2ª série - Ensino Médio" },
  { value: "3-serie-medio", label: "3ª série - Ensino Médio" },
  { value: "eja", label: "EJA (Educação de Jovens e Adultos)" },
];

const childGradeLabelMap = new Map(childGradeOptions.map((option) => [option.value, option.label]));
const childGradeValueSet = new Set(childGradeOptions.map((option) => option.value));

export function isKnownChildGrade(value?: string | null): value is string {
  return Boolean(value && childGradeValueSet.has(value));
}

export function formatChildGradeLabel(value?: string | null): string {
  if (!value) return "Não informado";
  return childGradeLabelMap.get(value) || value;
}
