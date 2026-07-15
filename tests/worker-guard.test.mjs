import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPagesGuard, generateRoutesConfig } from "../share/cloudflare-pages/lib/worker-guard.mjs";

function htmlResponse(body = "<!doctype html><html></html>") {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function assetEnv(responses) {
  return {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const handler = responses[url.pathname];
        if (!handler) {
          return htmlResponse(`<!doctype html><html><body>spa fallback for ${url.pathname}</body></html>`);
        }
        return typeof handler === "function" ? handler(request) : handler;
      },
    },
  };
}

const nestedGuard = createPagesGuard({
  staticPrefixes: ["/assets/", "/course-report/assets/"],
  spaPrefixes: ["/course-report/"],
  spaStaticPrefixes: [
    "/course-report/collateral/",
    "/course-report/data/",
    "/course-report/images/",
  ],
});

const simpleGuard = createPagesGuard({
  staticPrefixes: ["/assets/"],
  spaPrefixes: [],
  spaStaticPrefixes: [],
});

describe("pages asset guard", () => {
  it("returns existing CSS as 200 text/css", async () => {
    const env = assetEnv({
      "/assets/main-ABC.css": new Response("body{}", {
        status: 200,
        headers: { "content-type": "text/css; charset=utf-8" },
      }),
    });
    const response = await nestedGuard.fetch(
      new Request("https://example.com/assets/main-ABC.css"),
      env,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/css/i);
    assert.equal(await response.text(), "body{}");
  });

  it("returns existing JavaScript with a JavaScript MIME type", async () => {
    const env = assetEnv({
      "/assets/main-ABC.js": new Response("console.log(1)", {
        status: 200,
        headers: { "content-type": "application/javascript; charset=utf-8" },
      }),
    });
    const response = await nestedGuard.fetch(
      new Request("https://example.com/assets/main-ABC.js"),
      env,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /javascript/i);
  });

  it("turns missing CSS SPA shells into 404 text/plain", async () => {
    const env = assetEnv({});
    const response = await nestedGuard.fetch(
      new Request("https://example.com/assets/missing-XYZ.css"),
      env,
    );
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /^text\/plain/i);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await response.text(), "Asset not found");
  });

  it("turns missing JavaScript SPA shells into 404 text/plain", async () => {
    const env = assetEnv({});
    const response = await nestedGuard.fetch(
      new Request("https://example.com/course-report/assets/missing-XYZ.js"),
      env,
    );
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /^text\/plain/i);
  });

  it("still serves a valid SPA deep link shell", async () => {
    const env = assetEnv({
      "/course-report/": htmlResponse(
        '<!doctype html><html><script src="/course-report/assets/app.js"></script></html>',
      ),
    });
    const response = await nestedGuard.fetch(
      new Request("https://example.com/course-report/courses/poplar-creek"),
      env,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/i);
    assert.match(await response.text(), /course-report\/assets\/app\.js/);
  });

  it("works for a project without a nested Course Report app", async () => {
    const env = assetEnv({
      "/assets/site.css": new Response("x{}", {
        status: 200,
        headers: { "content-type": "text/css" },
      }),
    });
    const ok = await simpleGuard.fetch(new Request("https://example.com/assets/site.css"), env);
    assert.equal(ok.status, 200);

    const missing = await simpleGuard.fetch(
      new Request("https://example.com/assets/missing.css"),
      env,
    );
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type"), /^text\/plain/i);
  });
});

describe("routes generation", () => {
  it("includes guarded static prefixes and keeps ungarded spa static excludes", () => {
    const routes = generateRoutesConfig({
      staticPrefixes: ["/assets/", "/course-report/assets/"],
      spaPrefixes: ["/course-report/"],
      spaStaticPrefixes: ["/course-report/images/", "/course-report/assets/"],
    });
    assert.ok(routes.include.includes("/assets/*"));
    assert.ok(routes.include.includes("/course-report/assets/*"));
    assert.ok(routes.include.includes("/course-report"));
    assert.ok(routes.include.includes("/course-report/*"));
    assert.ok(routes.exclude.includes("/course-report/images/*"));
    assert.ok(!routes.exclude.includes("/course-report/assets/*"));
  });
});
