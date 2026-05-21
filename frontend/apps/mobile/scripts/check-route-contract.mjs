import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sharedRoutesPath = resolve(root, "..", "..", "packages", "shared", "src", "routes", "frontend.ts");
const mobileManifestPath = resolve(root, "src", "routes", "frontend.ts");

const expectedWrapperContracts = [
  { file: "app/index.tsx", exports: ["ROOT_PATH"] },
  { file: "app/login.tsx", exports: ["LOGIN_PATH"] },
  { file: "app/recuperar-senha.tsx", exports: ["RECOVER_PASSWORD_PATH"] },
  { file: "app/redefinir-senha.tsx", exports: ["RESET_PASSWORD_PATH"] },
  { file: "app/cadastro.tsx", exports: ["SIGNUP_PATH"] },
  { file: "app/explorar.tsx", exports: ["EXPLORE_PATH"] },
  { file: "app/professora/[id].tsx", exports: ["buildTeacherProfilePath"] },
  { file: "app/agendar/[id].tsx", exports: ["buildBookingSchedulerPath"] },
  { file: "app/checkout/[id].tsx", exports: ["buildCheckoutPath"] },
  { file: "app/confirmacao-reserva/[bookingId].tsx", exports: ["buildBookingConfirmationPath"] },
  { file: "app/aula/[bookingId].tsx", exports: ["buildBookingDetailPath"] },
  { file: "app/chat/[threadId].tsx", exports: ["buildChatPath"] },
  { file: "app/agenda.tsx", exports: ["AGENDA_PATH"] },
  { file: "app/progresso.tsx", exports: ["PROGRESS_PATH"] },
  { file: "app/perfil/index.tsx", exports: ["PROFILE_PATH"] },
  { file: "app/perfil/responsavel.tsx", exports: ["PARENT_PROFILE_SETTINGS_PATH"] },
  { file: "app/perfil/professora.tsx", exports: ["TEACHER_PROFILE_SETTINGS_PATH"] },
  { file: "app/inicio.tsx", exports: ["TEACHER_CONTROL_CENTER_PATH"] },
  { file: "app/alunos.tsx", exports: ["TEACHER_STUDENTS_PATH"] },
  { file: "app/planejamento.tsx", exports: ["TEACHER_PLANNING_PATH"] },
  { file: "app/financeiro.tsx", exports: ["TEACHER_FINANCE_PATH"] },
  { file: "app/aulas/[bookingId]/cierre.tsx", exports: ["buildTeacherLessonClosurePath"] },
  { file: "app/convites/professoras/cadastro-privado-kidario-a8k3m2.tsx", exports: ["TEACHER_PRIVATE_SIGNUP_PATH"] },
  { file: "app/escolher-professora.tsx", exports: ["TEACHER_PRIVATE_SIGNUP_LEGACY_PATH"] },
  { file: "app/professora/centro.tsx", exports: ["TEACHER_CONTROL_CENTER_LEGACY_PATHS"] },
  { file: "app/professora/inicio.tsx", exports: ["TEACHER_CONTROL_CENTER_LEGACY_PATHS"] },
  { file: "app/professora/agenda.tsx", exports: ["TEACHER_AGENDA_LEGACY_PATH"] },
  { file: "app/professora/alunos.tsx", exports: ["TEACHER_STUDENTS_LEGACY_PATH"] },
  { file: "app/professora/planejamento.tsx", exports: ["TEACHER_PLANNING_LEGACY_PATH"] },
  { file: "app/professora/financeiro.tsx", exports: ["TEACHER_FINANCE_LEGACY_PATH"] },
  { file: "app/[...path].tsx", exports: ["ROOT_PATH", "buildFrontendPathFromSegments", "isBlockedMobilePath"] },
];

function readSource(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }

  return readFileSync(path, "utf8");
}

function hasSharedExport(source, name) {
  return new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`, "m").test(source);
}

function importedRouteExports(source) {
  const names = new Set();
  const matches = source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/routes\/frontend["'];/g);

  for (const match of matches) {
    for (const item of match[1].split(",")) {
      const name = item.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) {
        names.add(name);
      }
    }
  }

  return names;
}

const sharedSource = readSource(sharedRoutesPath);
const mobileSource = readSource(mobileManifestPath);

assert.match(
  mobileSource,
  /export \* from "@kidario\/shared\/routes\/frontend";/,
  "mobile route manifest must re-export the shared frontend route contract.",
);

assert.ok(
  !mobileSource.includes("ADMIN_HIDDEN_DASHBOARD_PATH"),
  "mobile route manifest must not expose admin path constants.",
);

assert.ok(
  !/export\s+const\s+\w+_PATH\s*=/.test(mobileSource),
  "mobile route manifest must not duplicate shared route constants.",
);

for (const { file: relativePath, exports } of expectedWrapperContracts) {
  const absolutePath = resolve(root, relativePath);
  assert.ok(existsSync(absolutePath), `Missing wrapper file: ${relativePath}`);

  const wrapperSource = readSource(absolutePath);
  const importedNames = importedRouteExports(wrapperSource);

  for (const name of exports) {
    assert.ok(hasSharedExport(sharedSource, name), `Missing shared route export ${name} for ${relativePath}.`);
    assert.ok(
      importedNames.has(name),
      `${relativePath} must import ${name} from "@/routes/frontend".`,
    );
  }
}

console.log("Route contract passed.");
