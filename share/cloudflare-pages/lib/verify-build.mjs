import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ASSET_PATTERN = /(?:src|href)=["']([^"']+\.(?:css|js))["']/gi;

export function extractAssets(html) {
  return [...html.matchAll(ASSET_PATTERN)].map((match) => match[1]);
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function toDistRelativeAsset(assetPath, entryPath) {
  if (assetPath.startsWith("/")) {
    return assetPath.replace(/^\//, "");
  }
  // Relative to the HTML entry directory within dist.
  const entryDir = entryPath.includes("/")
    ? entryPath.slice(0, entryPath.lastIndexOf("/"))
    : "";
  if (!entryDir) {
    return assetPath;
  }
  return join(entryDir, assetPath).replace(/\\/g, "/");
}

export async function verifyBuild({ root, config, log = console.log }) {
  const distDir = resolve(root, config.distDir);
  const distStat = await stat(distDir).catch(() => null);
  if (!distStat || !distStat.isDirectory()) {
    throw new Error(`Distribution directory not found: ${distDir}`);
  }

  const workerPath = resolve(distDir, "_worker.js");
  const routesPath = resolve(distDir, "_routes.json");
  for (const required of [workerPath, routesPath]) {
    const exists = await stat(required).catch(() => null);
    if (!exists) {
      throw new Error(
        `Missing ${required}. Run caddie cloudflare:pages:setup and rebuild so the guard ships in dist.`,
      );
    }
  }

  for (const entry of config.htmlEntries) {
    const relative = entry.replace(/^\//, "");
    const absolute = resolve(distDir, relative);
    const html = await readFile(absolute, "utf8").catch(() => null);
    if (html === null) {
      throw new Error(`Missing HTML entry: ${entry} (expected ${absolute})`);
    }

    const assets = extractAssets(html);
    if (!assets.length) {
      throw new Error(`${entry} does not reference any CSS or JavaScript assets`);
    }

    for (const asset of assets) {
      const relativeAsset = toDistRelativeAsset(asset, relative);
      const assetAbsolute = resolve(distDir, relativeAsset);
      const assetExists = await stat(assetAbsolute).catch(() => null);
      if (!assetExists) {
        throw new Error(`${entry} references missing asset: ${asset}`);
      }
      log(`Verified local asset ${asset}`);
    }
  }

  const files = await walkFiles(distDir);
  for (const file of files) {
    const contents = await readFile(file, "utf8").catch(() => null);
    if (contents === null) {
      continue;
    }
    for (const pattern of config.forbiddenPatterns || []) {
      const regex = new RegExp(pattern);
      if (regex.test(contents)) {
        throw new Error(
          `Production build contains forbidden pattern /${pattern}/ in ${file.replace(`${distDir}/`, "")}`,
        );
      }
    }
  }

  if ((config.requiredPatterns || []).length) {
    const joined = (
      await Promise.all(files.map(async (file) => readFile(file, "utf8").catch(() => "")))
    ).join("\n");
    for (const pattern of config.requiredPatterns) {
      const regex = new RegExp(pattern);
      if (!regex.test(joined)) {
        throw new Error(`Production build is missing required pattern /${pattern}/`);
      }
    }
  }

  log(`Production build verified under ${distDir}`);
  return { distDir };
}
