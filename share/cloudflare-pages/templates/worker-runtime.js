function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prefixToRegex(prefix) {
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return new RegExp("^" + escapeRegex(normalized) + "(?:/|$)");
}

const staticMatchers = GUARD_OPTIONS.staticPrefixes.map(prefixToRegex);
const spaMatchers = GUARD_OPTIONS.spaPrefixes.map((prefix) => ({
  prefix,
  matcher: prefixToRegex(prefix),
}));
const spaStaticMatchers = GUARD_OPTIONS.spaStaticPrefixes.map(prefixToRegex);

function isStaticPath(pathname) {
  return staticMatchers.some((matcher) => matcher.test(pathname));
}

function isSpaStaticPath(pathname) {
  return spaStaticMatchers.some((matcher) => matcher.test(pathname));
}

function findSpaShellPrefix(pathname) {
  for (const entry of spaMatchers) {
    if (
      entry.matcher.test(pathname) &&
      !isStaticPath(pathname) &&
      !isSpaStaticPath(pathname) &&
      !pathname.includes(".")
    ) {
      return entry.prefix;
    }
  }
  return null;
}

function missingAssetResponse(request) {
  return new Response(request.method === "HEAD" ? null : "Asset not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isDocumentRequest = request.method === "GET" || request.method === "HEAD";
    const spaShellPrefix = isDocumentRequest ? findSpaShellPrefix(url.pathname) : null;

    if (spaShellPrefix) {
      const documentUrl = new URL(spaShellPrefix, url);
      const response = await env.ASSETS.fetch(new Request(documentUrl, request));
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-cache");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const response = await env.ASSETS.fetch(request);

    if (isStaticPath(url.pathname)) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.toLowerCase().startsWith("text/html")) {
        return missingAssetResponse(request);
      }
    }

    return response;
  },
};
