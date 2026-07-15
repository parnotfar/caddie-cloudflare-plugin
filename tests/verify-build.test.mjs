import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, after } from "node:test";
import { normalizeConfig } from "../share/cloudflare-pages/lib/config.mjs";
import { verifyBuild } from "../share/cloudflare-pages/lib/verify-build.mjs";

async function makeProject(files) {
  const root = await mkdtemp(join(tmpdir(), "caddie-cf-build-"));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = join(root, relative);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, contents, "utf8");
  }
  return root;
}

const silent = () => {};

describe("verify-build", () => {
  const cleanups = [];
  after(async () => {
    await Promise.all(cleanups.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("fails when HTML references an unavailable hash", async () => {
    const root = await makeProject({
      "dist/index.html": '<link rel="stylesheet" href="/assets/main-MISSING.css">',
      "dist/_worker.js": "export default { fetch(){} }",
      "dist/_routes.json": "{}",
    });
    cleanups.push(root);

    await assert.rejects(
      () =>
        verifyBuild({
          root,
          config: normalizeConfig({
            projectName: "demo",
            hostnames: ["https://example.com/"],
            htmlEntries: ["/index.html"],
            staticPrefixes: ["/assets/"],
          }),
          log: silent,
        }),
      /missing asset/i,
    );
  });

  it("passes a simple site with local assets and no nested SPA", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script>',
      "dist/assets/main-ABC.css": "body{}",
      "dist/assets/main-ABC.js": "console.log(1)",
      "dist/_worker.js": "export default { fetch(){} }",
      "dist/_routes.json": "{}",
    });
    cleanups.push(root);

    await verifyBuild({
      root,
      config: normalizeConfig({
        projectName: "demo",
        hostnames: ["https://example.com/"],
        htmlEntries: ["/index.html"],
        staticPrefixes: ["/assets/"],
        forbiddenPatterns: ["localhost:5174"],
      }),
      log: silent,
    });
  });

  it("fails when dist contains a forbidden local development URL", async () => {
    const root = await makeProject({
      "dist/index.html":
        '<link rel="stylesheet" href="/assets/main-ABC.css"><script src="/assets/main-ABC.js"></script>',
      "dist/assets/main-ABC.css": "body{}",
      "dist/assets/main-ABC.js": 'fetch("http://localhost:5174")',
      "dist/_worker.js": "export default { fetch(){} }",
      "dist/_routes.json": "{}",
    });
    cleanups.push(root);

    await assert.rejects(
      () =>
        verifyBuild({
          root,
          config: normalizeConfig({
            projectName: "demo",
            hostnames: ["https://example.com/"],
            htmlEntries: ["/index.html"],
            staticPrefixes: ["/assets/"],
            forbiddenPatterns: ["localhost:5174"],
          }),
          log: silent,
        }),
      /forbidden pattern/i,
    );
  });
});
