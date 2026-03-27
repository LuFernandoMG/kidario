import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const frontendRoot = resolve(root, "..", "frontend", "src", "routes");
const mobileManifestPath = resolve(root, "src", "routes", "frontend.ts");

const scalarRouteNames = [
  "ROOT_PATH",
  "LOGIN_PATH",
  "RECOVER_PASSWORD_PATH",
  "RESET_PASSWORD_PATH",
  "SIGNUP_PATH",
  "EXPLORE_PATH",
  "TEACHER_PROFILE_PATH",
  "BOOKING_SCHEDULER_PATH",
  "CHECKOUT_PATH",
  "BOOKING_CONFIRMATION_PATH",
  "BOOKING_DETAIL_PATH",
  "CHAT_PATH",
  "AGENDA_PATH",
  "PROGRESS_PATH",
  "PROFILE_PATH",
  "PARENT_PROFILE_SETTINGS_PATH",
  "TEACHER_PROFILE_SETTINGS_PATH",
  "TEACHER_CONTROL_CENTER_PATH",
  "TEACHER_STUDENTS_PATH",
  "TEACHER_PLANNING_PATH",
  "TEACHER_FINANCE_PATH",
  "TEACHER_LESSON_CLOSURE_PATH",
  "TEACHER_PRIVATE_SIGNUP_PATH",
  "TEACHER_PRIVATE_SIGNUP_LEGACY_PATH",
  "TEACHER_AGENDA_LEGACY_PATH",
  "TEACHER_STUDENTS_LEGACY_PATH",
  "TEACHER_PLANNING_LEGACY_PATH",
  "TEACHER_FINANCE_LEGACY_PATH",
];

const arrayRouteNames = ["TEACHER_CONTROL_CENTER_LEGACY_PATHS"];

const frontendFiles = [
  resolve(frontendRoot, "paths.ts"),
  resolve(frontendRoot, "teacher.ts"),
  resolve(frontendRoot, "legacy.ts"),
];

function readSource(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }

  return readFileSync(path, "utf8");
}

function extractScalar(source, name) {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*"([^"]+)"`, "m"));
  if (!match) {
    throw new Error(`Could not extract ${name}`);
  }
  return match[1];
}

function extractArray(source, name) {
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*\\[(.*?)\\]\\s*as const;`, "ms"));
  if (!match) {
    throw new Error(`Could not extract ${name}`);
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractFromSources(sources, name, kind) {
  for (const source of sources) {
    if (source.includes(`export const ${name}`)) {
      return kind === "array" ? extractArray(source, name) : extractScalar(source, name);
    }
  }

  throw new Error(`Could not find ${name} in source set.`);
}

const frontendSources = frontendFiles.map(readSource);
const mobileSource = readSource(mobileManifestPath);

for (const name of scalarRouteNames) {
  const frontendValue = extractFromSources(frontendSources, name, "scalar");
  const mobileValue = extractScalar(mobileSource, name);
  assert.equal(mobileValue, frontendValue, `${name} does not match frontend.`);
}

for (const name of arrayRouteNames) {
  const frontendValue = extractFromSources(frontendSources, name, "array");
  const mobileValue = extractArray(mobileSource, name);
  assert.deepEqual(mobileValue, frontendValue, `${name} does not match frontend.`);
}

assert.ok(
  !mobileSource.includes("ADMIN_HIDDEN_DASHBOARD_PATH"),
  "mobile route manifest must not expose admin path constants.",
);

const expectedWrapperFiles = [
  "app/index.tsx",
  "app/login.tsx",
  "app/recuperar-senha.tsx",
  "app/redefinir-senha.tsx",
  "app/cadastro.tsx",
  "app/explorar.tsx",
  "app/professora/[id].tsx",
  "app/professora/centro.tsx",
  "app/professora/inicio.tsx",
  "app/professora/agenda.tsx",
  "app/professora/alunos.tsx",
  "app/professora/planejamento.tsx",
  "app/professora/financeiro.tsx",
  "app/agendar/[id].tsx",
  "app/checkout/[id].tsx",
  "app/confirmacao-reserva/[bookingId].tsx",
  "app/aula/[bookingId].tsx",
  "app/chat/[threadId].tsx",
  "app/agenda.tsx",
  "app/progresso.tsx",
  "app/perfil/index.tsx",
  "app/perfil/responsavel.tsx",
  "app/perfil/professora.tsx",
  "app/inicio.tsx",
  "app/alunos.tsx",
  "app/planejamento.tsx",
  "app/financeiro.tsx",
  "app/aulas/[bookingId]/cierre.tsx",
  "app/escolher-professora.tsx",
  "app/convites/professoras/cadastro-privado-kidario-a8k3m2.tsx",
  "app/[...path].tsx",
];

for (const relativePath of expectedWrapperFiles) {
  const absolutePath = resolve(root, relativePath);
  assert.ok(existsSync(absolutePath), `Missing wrapper file: ${relativePath}`);
}

console.log("Route contract passed.");
