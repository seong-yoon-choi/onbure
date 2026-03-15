import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const APP_LANGUAGES = ["ko", "ja", "en", "fr", "es"];
const HANGUL_REGEX = /[\uac00-\ud7a3]/u;
const CJK_IDEOGRAPH_REGEX = /[\u3400-\u9fff]/u;
const REPLACEMENT_CHAR_REGEX = /\uFFFD/u;
const SUSPICIOUS_QUESTION_REGEX = /\?(?:\?|[^\s.,!?)}\]])/u;

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveRepoPath(relativePath), "utf8"));
}

function loadTsModule(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const compiledModule = { exports: {} };
  const sandbox = {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (specifier) => {
      if (specifier.startsWith("@/")) {
        const mapped = specifier.slice(2).replaceAll("/", path.sep);
        const tsPath = `${mapped}.ts`;
        const jsonPath = `${mapped}.json`;
        if (fs.existsSync(resolveRepoPath(tsPath))) return loadTsModule(tsPath);
        if (fs.existsSync(resolveRepoPath(jsonPath))) return loadJson(jsonPath);
      }
      return require(specifier);
    },
    __dirname: path.dirname(absolutePath),
    __filename: absolutePath,
    process,
    console,
  };

  vm.runInNewContext(compiled, sandbox, { filename: absolutePath });
  return compiledModule.exports;
}

function isCorruptedTemplate(language, template) {
  const normalized = String(template || "");
  if (!normalized) return true;
  if (REPLACEMENT_CHAR_REGEX.test(normalized)) return true;

  if (language === "ko") {
    return CJK_IDEOGRAPH_REGEX.test(normalized) || SUSPICIOUS_QUESTION_REGEX.test(normalized);
  }

  if (language === "ja") {
    return HANGUL_REGEX.test(normalized) || SUSPICIOUS_QUESTION_REGEX.test(normalized);
  }

  if (language === "fr" || language === "es") {
    return HANGUL_REGEX.test(normalized);
  }

  return false;
}

function* iterateStrings(value, currentPath = []) {
  if (typeof value === "string") {
    yield { path: currentPath.join("."), value };
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      yield* iterateStrings(item, [...currentPath, String(index)]);
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    yield* iterateStrings(nestedValue, [...currentPath, key]);
  }
}

const sources = [
  ["shared-overrides.json", loadJson("lib/i18n/shared-overrides.json")],
  ["home-copy.json", loadJson("lib/i18n/home-copy.json")],
  ["literal-messages.json", loadJson("lib/i18n/literal-messages.json")],
  ["auth-admin-overrides.ts", loadTsModule("lib/i18n/auth-admin-overrides.ts").AUTH_ADMIN_OVERRIDES],
  ["admin-page-overrides.ts", loadTsModule("lib/i18n/admin-page-overrides.ts").ADMIN_PAGE_OVERRIDES],
  ["workspace-overrides.ts", loadTsModule("lib/i18n/workspace-overrides.ts").WORKSPACE_OVERRIDES],
];

const failures = [];

for (const [sourceName, source] of sources) {
  for (const language of APP_LANGUAGES) {
    for (const entry of iterateStrings(source?.[language], [language])) {
      if (isCorruptedTemplate(language, entry.value)) {
        failures.push(`${sourceName}:${entry.path}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Locale sanity check failed.");
  for (const failure of failures.slice(0, 100)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 100) {
    console.error(`...and ${failures.length - 100} more`);
  }
  process.exit(1);
}

console.log("Locale sanity check passed.");
