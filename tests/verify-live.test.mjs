import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, after } from "node:test";
import { normalizeConfig } from "../share/cloudflare-pages/lib/config.mjs";
import { verifyLive } from "../share/cloudflare-pages/lib/verify-live.mjs";

async function makeProject(files) {
  const root = await mkdtemp(join(tmpdir(), "caddie-cf-live-"));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = join(root, relative);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, contents, "utf8");
  }
  return root;
}

function mockFetch(handler) {
  return async (input, init = {}) => handler(new Request(input, init));
}

const silent = () => {};

describe("verify-live", () => {
  const cleanups = [];
  after(async () => {
    await Promise.all(cleanups.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("fails when HTML references an unavailable live hash", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script>',
    });
    cleanups.push(root);

    const fetchImpl = mockFetch(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(
          '<!doctype html><html><link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script></html>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
        return new Response("<!doctype html><html>missing</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("no", { status: 404 });
    });

    await assert.rejects(
      () =>
        verifyLive({
          root,
          config: normalizeConfig({
            projectName: "demo",
            hostnames: ["https://example.com/"],
            htmlEntries: ["/index.html"],
            staticPrefixes: ["/assets/"],
            retryAttempts: 1,
            retryDelayMs: 0,
          }),
          fetchImpl,
          log: silent,
          warn: silent,
          sleep: async () => {},
        }),
      /Content-Type|HTML instead of an asset|failed after/i,
    );
  });

  it("fails when one hostname is stale", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-NEW.css"><script src="/assets/main-NEW.js"></script>',
    });
    cleanups.push(root);

    const fetchImpl = mockFetch(async (request) => {
      const url = new URL(request.url);
      if (url.hostname === "fresh.example.com" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return new Response(
          '<!doctype html><html><link rel="stylesheet" href="/assets/main-NEW.css"><script src="/assets/main-NEW.js"></script></html>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.hostname === "stale.example.com" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return new Response(
          '<!doctype html><html><link rel="stylesheet" href="/assets/main-OLD.css"><script src="/assets/main-OLD.js"></script></html>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.pathname.includes("missing-")) {
        return new Response("Asset not found", {
          status: 404,
          headers: { "content-type": "text/plain" },
        });
      }
      if (url.pathname.endsWith(".css")) {
        return new Response("x{}", {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }
      if (url.pathname.endsWith(".js")) {
        return new Response("x", {
          status: 200,
          headers: { "content-type": "application/javascript" },
        });
      }
      return new Response("no", { status: 404 });
    });

    await assert.rejects(
      () =>
        verifyLive({
          root,
          config: normalizeConfig({
            projectName: "demo",
            hostnames: ["https://fresh.example.com/", "https://stale.example.com/"],
            htmlEntries: ["/index.html"],
            staticPrefixes: ["/assets/"],
            retryAttempts: 1,
            retryDelayMs: 0,
          }),
          fetchImpl,
          log: silent,
          warn: silent,
          sleep: async () => {},
        }),
      /different assets|stale|failed after/i,
    );
  });

  it("retries and succeeds when propagation catches up", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script>',
    });
    cleanups.push(root);

    let attempts = 0;
    const fetchImpl = mockFetch(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        attempts += 1;
        if (attempts < 2) {
          return new Response(
            '<!doctype html><html><link rel="stylesheet" href="/assets/main-OLD.css"><script src="/assets/main-OLD.js"></script></html>',
            { status: 200, headers: { "content-type": "text/html" } },
          );
        }
        return new Response(
          '<!doctype html><html><link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script></html>',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.pathname.includes("missing-")) {
        return new Response("Asset not found", {
          status: 404,
          headers: { "content-type": "text/plain" },
        });
      }
      if (url.pathname.endsWith(".css")) {
        return new Response("x{}", {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }
      if (url.pathname.endsWith(".js")) {
        return new Response("x", {
          status: 200,
          headers: { "content-type": "application/javascript" },
        });
      }
      return new Response("no", { status: 404 });
    });

    const result = await verifyLive({
      root,
      config: normalizeConfig({
        projectName: "demo",
        hostnames: ["https://example.com/"],
        htmlEntries: ["/index.html"],
        staticPrefixes: ["/assets/"],
        retryAttempts: 3,
        retryDelayMs: 1,
      }),
      fetchImpl,
      log: silent,
      warn: silent,
      sleep: async () => {},
    });
    assert.equal(result.attempts, 2);
  });

  it("exits nonzero after the retry limit", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script>',
    });
    cleanups.push(root);

    const fetchImpl = mockFetch(async () =>
      new Response("nope", { status: 500, headers: { "content-type": "text/plain" } }),
    );

    await assert.rejects(
      () =>
        verifyLive({
          root,
          config: normalizeConfig({
            projectName: "demo",
            hostnames: ["https://example.com/"],
            htmlEntries: ["/index.html"],
            staticPrefixes: ["/assets/"],
            retryAttempts: 2,
            retryDelayMs: 1,
          }),
          fetchImpl,
          log: silent,
          warn: silent,
          sleep: async () => {},
        }),
      /failed after 2 attempt/,
    );
  });
});
