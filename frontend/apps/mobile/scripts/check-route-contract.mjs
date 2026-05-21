import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sharedRoutesPath = resolve(root, "..", "..", "packages", "shared", "src", "routes", "frontend.ts");
const mobileManifestPath = resolve(root, "src", "routes", "frontend.ts");
const webRouteFiles = [
  resolve(root, "..", "web", "src", "routes", "paths.ts"),
  resolve(root, "..", "web", "src", "routes", "teacher.ts"),
  resolve(root, "..", "web", "src", "routes", "legacy.ts"),
];

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
  "TEACHER_AGENDA_PATH",
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

const sharedSource = readSource(sharedRoutesPath);
const mobileSource = readSource(mobileManifestPath);
const webRouteSources = webRouteFiles.map(readSource);

for (const name of scalarRouteNames) {
  assert.doesNotThrow(() => extractScalar(sharedSource, name), `Could not find ${name} in shared routes.`);
}

for (const name of arrayRouteNames) {
  assert.doesNotThrow(() => extractArray(sharedSource, name), `Could not find ${name} in shared routes.`);
}

assert.match(
  mobileSource,
  /export \* from "@kidario\/shared\/routes\/frontend";/,
  "mobile route manifest must re-export the shared frontend route contract.",
);

for (const source of webRouteSources) {
  assert.ok(
    source.includes('from "@kidario/shared/routes/frontend";'),
    "web route modules must re-export the shared frontend route contract.",
  );
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
