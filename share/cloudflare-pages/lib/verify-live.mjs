import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractAssets } from "./verify-build.mjs";

function expectedContentType(assetPath) {
  return assetPath.endsWith(".css")
    ? /^text\/css(?:;|$)/i
    : /^(?:application|text)\/javascript(?:;|$)/i;
}

function sameAssets(expected, actual) {
  return expected.length === actual.length && expected.every((asset) => actual.includes(asset));
}

function looksLikeHtml(body) {
  return /^\s*(?:<!doctype\s+html|<html)/i.test(body || "");
}

export async function fetchText(url, { redirect = "follow", userAgent, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: {
      "cache-control": "no-cache",
      "user-agent": userAgent || "caddie-cloudflare pages verifier",
    },
    redirect,
  });
  const body = await response.text();
  return { response, body };
}

function assertHtml(url, response, body) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.toLowerCase().startsWith("text/html")) {
    throw new Error(
      `${url.href} returned HTTP ${response.status} with Content-Type ${contentType || "missing"}.`,
    );
  }
  if (!looksLikeHtml(body)) {
    throw new Error(`${url.href} did not return HTML.`);
  }
}

async function verifyAssetsForPage({
  baseUrl,
  expectedAssets,
  liveHtml,
  productionUrl,
  userAgent,
  fetchImpl,
  log,
}) {
  const liveAssets = extractAssets(liveHtml);
  if (!sameAssets(expectedAssets, liveAssets)) {
    throw new Error(`${baseUrl.href} references different assets than the production build.`);
  }

  for (const assetPath of liveAssets) {
    const assetUrl = new URL(assetPath, productionUrl);
    const { response, body } = await fetchText(assetUrl, { userAgent, fetchImpl });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !expectedContentType(assetPath).test(contentType)) {
      throw new Error(
        `${assetUrl.href} returned HTTP ${response.status} with Content-Type ${contentType || "missing"}.`,
      );
    }
    if (looksLikeHtml(body)) {
      throw new Error(`${assetUrl.href} returned HTML instead of an asset.`);
    }
    log(`Verified ${assetUrl.href} (${contentType}).`);
  }

  return liveAssets;
}

async function verifyMissingAssets({ productionUrl, staticPrefixes, userAgent, fetchImpl, log }) {
  const stamp = Date.now();
  for (const prefix of staticPrefixes) {
    const missingCss = new URL(`${prefix}missing-${stamp}.css`, productionUrl);
    const missingJs = new URL(`${prefix}missing-${stamp}.js`, productionUrl);

    for (const missingUrl of [missingCss, missingJs]) {
      const { response, body } = await fetchText(missingUrl, {
        redirect: "manual",
        userAgent,
        fetchImpl,
      });
      if (response.status !== 404) {
        throw new Error(
          `${missingUrl.href} returned HTTP ${response.status}; expected 404 for missing assets.`,
        );
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.toLowerCase().startsWith("text/html") || looksLikeHtml(body)) {
        throw new Error(
          `${missingUrl.href} returned an HTML SPA shell instead of a missing-asset response.`,
        );
      }
      log(`Verified missing asset ${missingUrl.href} → HTTP 404`);
    }
  }
}

export async function verifyHostnameOnce({
  hostname,
  root,
  config,
  fetchImpl = fetch,
  log = console.log,
}) {
  const productionUrl = new URL(hostname);
  const distDir = resolve(root, config.distDir);
  const userAgent = config.userAgent;

  for (const entry of config.htmlEntries) {
    const relative = entry.replace(/^\//, "");
    const localHtml = await readFile(resolve(distDir, relative), "utf8");
    const expectedAssets = extractAssets(localHtml);
    const livePath = entry.endsWith("index.html")
      ? entry.slice(0, -"index.html".length) || "/"
      : entry;
    const pageUrl = new URL(livePath, productionUrl);
    const redirect = entry.includes("/") && entry !== "/index.html" ? "manual" : "follow";
    const { response, body } = await fetchText(pageUrl, { redirect, userAgent, fetchImpl });
    assertHtml(pageUrl, response, body);
    await verifyAssetsForPage({
      baseUrl: pageUrl,
      expectedAssets,
      liveHtml: body,
      productionUrl,
      userAgent,
      fetchImpl,
      log,
    });
  }

  const spaAssetsByPrefix = new Map();
  for (const route of config.documentRoutes || []) {
    const routeUrl = new URL(route, productionUrl);
    const { response, body } = await fetchText(routeUrl, {
      redirect: "manual",
      userAgent,
      fetchImpl,
    });
    assertHtml(routeUrl, response, body);

    const spaPrefix = (config.spaPrefixes || []).find((prefix) =>
      route === prefix || route.startsWith(prefix),
    );
    if (!spaPrefix) {
      throw new Error(
        `documentRoute ${route} is not under any configured spaPrefixes`,
      );
    }

    if (!spaAssetsByPrefix.has(spaPrefix)) {
      const shellEntry = config.htmlEntries.find((entry) => {
        const normalized = entry.endsWith("index.html")
          ? entry.slice(0, -"index.html".length)
          : entry;
        return normalized === spaPrefix || `${normalized}/` === spaPrefix;
      });
      if (!shellEntry) {
        throw new Error(
          `No htmlEntries shell found for spaPrefix ${spaPrefix}. Add the SPA index.html entry.`,
        );
      }
      const shellHtml = await readFile(
        resolve(distDir, shellEntry.replace(/^\//, "")),
        "utf8",
      );
      spaAssetsByPrefix.set(spaPrefix, extractAssets(shellHtml));
    }

    const expected = spaAssetsByPrefix.get(spaPrefix);
    if (!sameAssets(expected, extractAssets(body))) {
      throw new Error(`${routeUrl.href} did not return the configured SPA shell assets.`);
    }
    log(`Verified SPA document route ${routeUrl.href}`);
  }

  await verifyMissingAssets({
    productionUrl,
    staticPrefixes: config.staticPrefixes,
    userAgent,
    fetchImpl,
    log,
  });

  log(`Live deployment verified at ${productionUrl.href}`);
}

export async function verifyLive({
  root,
  config,
  hostnames = config.hostnames,
  fetchImpl = fetch,
  log = console.log,
  warn = console.warn,
  sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms)),
}) {
  const attempts = config.retryAttempts;
  const delayMs = config.retryDelayMs;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      for (const hostname of hostnames) {
        await verifyHostnameOnce({
          hostname,
          root,
          config,
          fetchImpl,
          log,
        });
      }
      return { attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        warn(`Live verification attempt ${attempt}/${attempts} failed: ${error.message}`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `Live deployment verification failed after ${attempts} attempt(s): ${lastError?.message || "Unknown error"}`,
  );
}
