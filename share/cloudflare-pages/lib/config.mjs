import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

export const CONFIG_FILENAME = "caddie.cloudflare.pages.json";

export const DEFAULT_CONFIG = {
  buildCommand: "npm run build",
  distDir: "dist",
  projectName: "",
  productionBranch: "main",
  hostnames: [],
  htmlEntries: ["/index.html"],
  staticPrefixes: ["/assets/"],
  spaPrefixes: [],
  spaStaticPrefixes: [],
  documentRoutes: [],
  retryAttempts: 8,
  retryDelayMs: 3000,
  forbiddenPatterns: [
    "https?://(127\\.0\\.0\\.1|localhost)(:\\d+)?",
    "sb_secret_",
    "service_role_key",
  ],
  requiredPatterns: [],
  workerSourceDir: "public",
  userAgent: "caddie-cloudflare pages verifier",
};

export function normalizePrefix(prefix) {
  if (!prefix) {
    return "/";
  }
  let value = String(prefix).trim();
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }
  if (!value.endsWith("/")) {
    value = `${value}/`;
  }
  return value;
}

export function normalizeHostname(hostname) {
  const value = String(hostname || "").trim();
  if (!value) {
    return "";
  }
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

export function normalizeConfig(raw = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...raw,
  };

  config.distDir = String(config.distDir || DEFAULT_CONFIG.distDir).replace(/\/+$/, "") || "dist";
  config.projectName = String(config.projectName || "").trim();
  config.productionBranch = String(config.productionBranch || "main").trim() || "main";
  config.buildCommand = String(config.buildCommand || DEFAULT_CONFIG.buildCommand);
  config.workerSourceDir = String(config.workerSourceDir || DEFAULT_CONFIG.workerSourceDir);
  config.userAgent = String(config.userAgent || DEFAULT_CONFIG.userAgent);
  config.retryAttempts = Number.parseInt(String(config.retryAttempts ?? 8), 10);
  config.retryDelayMs = Number.parseInt(String(config.retryDelayMs ?? 3000), 10);

  if (!Number.isFinite(config.retryAttempts) || config.retryAttempts < 1) {
    config.retryAttempts = 8;
  }
  if (!Number.isFinite(config.retryDelayMs) || config.retryDelayMs < 0) {
    config.retryDelayMs = 3000;
  }

  config.hostnames = (config.hostnames || []).map(normalizeHostname).filter(Boolean);
  config.htmlEntries = (config.htmlEntries || []).map((entry) => {
    const value = String(entry || "").trim();
    if (!value) {
      return "";
    }
    return value.startsWith("/") ? value : `/${value}`;
  }).filter(Boolean);
  config.staticPrefixes = (config.staticPrefixes || []).map(normalizePrefix);
  config.spaPrefixes = (config.spaPrefixes || []).map(normalizePrefix);
  config.spaStaticPrefixes = (config.spaStaticPrefixes || []).map(normalizePrefix);
  config.documentRoutes = (config.documentRoutes || []).map((route) => {
    const value = String(route || "").trim();
    if (!value) {
      return "";
    }
    return value.startsWith("/") ? value : `/${value}`;
  }).filter(Boolean);
  config.forbiddenPatterns = Array.isArray(config.forbiddenPatterns)
    ? config.forbiddenPatterns.map(String)
    : [...DEFAULT_CONFIG.forbiddenPatterns];
  config.requiredPatterns = Array.isArray(config.requiredPatterns)
    ? config.requiredPatterns.map(String)
    : [];

  return config;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.projectName) {
    errors.push("projectName is required");
  }
  if (!config.hostnames.length) {
    errors.push("hostnames must include at least one production hostname");
  }
  if (!config.htmlEntries.length) {
    errors.push("htmlEntries must include at least one HTML entry");
  }
  if (!config.staticPrefixes.length) {
    errors.push("staticPrefixes must include at least one static asset prefix");
  }
  if (!config.buildCommand) {
    errors.push("buildCommand is required");
  }
  if (!config.distDir) {
    errors.push("distDir is required");
  }

  return errors;
}

export function findConfigPath(startDir = process.cwd()) {
  let dir = resolve(startDir);
  while (true) {
    const candidate = resolve(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export async function loadConfig(startDir = process.cwd()) {
  const configPath = findConfigPath(startDir);
  if (!configPath) {
    throw new Error(
      `No ${CONFIG_FILENAME} found in this directory or parents. Run: caddie cloudflare:pages:config:init`,
    );
  }

  const raw = JSON.parse(await readFile(configPath, "utf8"));
  const config = normalizeConfig(raw);
  const errors = validateConfig(config);
  if (errors.length) {
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n- ${errors.join("\n- ")}`);
  }

  return {
    configPath,
    root: dirname(configPath),
    config,
  };
}

export function exampleConfig(preset = "simple") {
  if (preset === "parnotfar") {
    return normalizeConfig({
      buildCommand: "npm run build",
      distDir: "dist",
      projectName: "parnotfar",
      productionBranch: "main",
      hostnames: [
        "https://parnotfar.com/",
        "https://www.parnotfar.com/",
      ],
      htmlEntries: [
        "/index.html",
        "/course-report/index.html",
      ],
      staticPrefixes: [
        "/assets/",
        "/course-report/assets/",
      ],
      spaPrefixes: [
        "/course-report/",
      ],
      spaStaticPrefixes: [
        "/course-report/collateral/",
        "/course-report/data/",
        "/course-report/images/",
      ],
      documentRoutes: [
        "/course-report/",
        "/course-report/courses/poplar-creek",
        "/course-report/courses/poplar-creek/holes/1",
        "/course-report/profile",
      ],
      retryAttempts: 8,
      retryDelayMs: 3000,
      forbiddenPatterns: [
        "https?://(127\\.0\\.0\\.1|localhost):(54321|5174|5176)",
        "sb_secret_",
        "service_role_key",
        "SUPABASE_SERVICE_ROLE",
        "VITE_OAUTH_CLIENT_ID",
      ],
      requiredPatterns: [],
      workerSourceDir: "apps/site/public",
    });
  }

  return normalizeConfig({
    buildCommand: "npm run build",
    distDir: "dist",
    projectName: "example-pages",
    productionBranch: "main",
    hostnames: ["https://example.com/"],
    htmlEntries: ["/index.html"],
    staticPrefixes: ["/assets/"],
    spaPrefixes: [],
    spaStaticPrefixes: [],
    documentRoutes: [],
    workerSourceDir: "public",
  });
}
