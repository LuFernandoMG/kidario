import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envFiles = [".env.local", ".env"];
const defaultFrontendWebUrl = "http://localhost:8080";
const timeoutMultiplier = Number(process.env.DEV_CHECK_TIMEOUT_MULTIPLIER || "1");

function printSection(title) {
  console.log(`\n== ${title} ==`);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split("=");
      acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
}

function loadEnv() {
  const merged = {};
  for (const file of envFiles) {
    Object.assign(merged, parseEnvFile(resolve(root, file)));
  }
  return {
    ...merged,
    ...process.env,
  };
}

function runCheck(label, command, args, timeout) {
  const effectiveTimeout = Math.max(1000, Math.floor(timeout * timeoutMultiplier));
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    timeout: effectiveTimeout,
  });

  if (result.error?.code === "ETIMEDOUT") {
    console.log(
      `WARN ${label}: timed out after ${effectiveTimeout / 1000}s. Try DEV_CHECK_TIMEOUT_MULTIPLIER=2 npm run dev:check`,
    );
    return false;
  }

  if (result.status !== 0) {
    console.log(`FAIL ${label}`);
    if (result.stdout.trim()) console.log(result.stdout.trim());
    if (result.stderr.trim()) console.log(result.stderr.trim());
    return false;
  }

  console.log(`OK   ${label}`);
  return true;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function checkFile(label, path) {
  if (existsSync(path)) {
    console.log(`OK   ${label}`);
    return true;
  }

  console.log(`FAIL ${label}`);
  console.log(`Missing: ${path}`);
  return false;
}

async function checkFrontendAvailability(url) {
  if (!url || !isValidHttpUrl(url)) {
    console.log("FAIL Frontend shell URL");
    console.log("EXPO_PUBLIC_FRONTEND_WEB_URL is missing or invalid.");
    return false;
  }

  const timeout = Math.max(1000, Math.floor(5000 * timeoutMultiplier));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.log("FAIL Frontend availability");
      console.log(`GET ${url} returned HTTP ${response.status}.`);
      return false;
    }

    console.log(`OK   Frontend availability (${response.status})`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("FAIL Frontend availability");
    console.log(`Could not reach ${url}: ${message}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

printSection("Environment");
console.log(`Node: ${process.version}`);
console.log(`Workspace: ${root}`);
console.log(`Timeout multiplier: ${timeoutMultiplier}x`);

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!Number.isNaN(nodeMajor) && nodeMajor >= 24) {
  console.log("WARN Node 24+ can be unstable with Expo. Prefer Node 22 LTS for local development.");
}

const env = loadEnv();
let envOk = true;

const frontendUrl = env.EXPO_PUBLIC_FRONTEND_WEB_URL || defaultFrontendWebUrl;
if (!env.EXPO_PUBLIC_FRONTEND_WEB_URL) {
  console.log(`WARN missing EXPO_PUBLIC_FRONTEND_WEB_URL in .env or .env.local, falling back to ${defaultFrontendWebUrl}`);
}

if (frontendUrl && !isValidHttpUrl(frontendUrl)) {
  envOk = false;
  console.log(`FAIL EXPO_PUBLIC_FRONTEND_WEB_URL is not a valid http(s) URL: ${frontendUrl}`);
} else if (frontendUrl) {
  console.log(`OK   EXPO_PUBLIC_FRONTEND_WEB_URL -> ${frontendUrl}`);
  const hostname = new URL(frontendUrl).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    console.log("WARN frontend URL uses localhost. Physical devices will not reach it directly.");
  }
}

printSection("Tooling");
const checks = [
  runCheck("Route contract", "node", ["./scripts/check-route-contract.mjs"], 8000),
  runCheck("Expo config", "./node_modules/.bin/expo", ["config", "--type", "public"], 30000),
  runCheck("TypeScript", "./node_modules/.bin/tsc", ["--noEmit", "--pretty", "false"], 45000),
  runCheck("ESLint", "./node_modules/.bin/eslint", ["app", "src", "app.config.ts", "expo-env.d.ts"], 30000),
];

printSection("Shell");
const shellChecks = [
  checkFile("react-native-webview", resolve(root, "node_modules/react-native-webview/package.json")),
  checkFile("expo-document-picker", resolve(root, "node_modules/expo-document-picker/package.json")),
  checkFile("@react-native-community/netinfo", resolve(root, "node_modules/@react-native-community/netinfo/package.json")),
  await checkFrontendAvailability(frontendUrl),
];

printSection("Result");
if (!envOk || checks.some((item) => !item) || shellChecks.some((item) => !item)) {
  console.log("Development check failed. Fix the warnings/errors above before proceeding.");
  process.exitCode = 1;
} else {
  console.log("Development check passed.");
}
