export const SITE_NAME = "Kidario";
export const SITE_TAGLINE = "Educação que cresce com você";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://kidario.app";

export const EXPLORE_URL = "https://use.kidario.app/explorar";
export const CADASTRO_URL = "https://use.kidario.app/cadastro";
export const LOGIN_URL = "https://use.kidario.app/login";
export const EDUCATOR_INVITE_URL =
  "http://use.kidario.app/convites/professoras/cadastro-privado-kidario-a8k3m2";

export const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || "hello@kidario.app";

export const MAIN_NAV_ITEMS = [
  { href: "/familias", label: "Para famílias" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/empresa", label: "Empresa" },
] as const;

export const COMPANY_VALUES = [
  "Centrado nos alunos e nas crianças",
  "O aprendizado é o nosso foco",
  "Empatia radical",
  "Todos somos agentes de impacto",
] as const;
