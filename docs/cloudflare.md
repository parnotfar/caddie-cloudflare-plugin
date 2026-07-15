# Cloudflare module (plugin)

Optional Caddie plugin for Cloudflare Pages publishing with SPA asset guards.

## Project config

Create `caddie.cloudflare.pages.json` at the application repository root:

```bash
caddie cloudflare:pages:config:init          # simple single-app site
caddie cloudflare:pages:config:init parnotfar
```

### Field reference

| Field | Type | Description |
|-------|------|-------------|
| `buildCommand` | string | Command run before verify/publish |
| `distDir` | string | Artifact directory passed to `wrangler pages deploy` |
| `projectName` | string | Cloudflare Pages project |
| `productionBranch` | string | Branch name for production deploy |
| `hostnames` | string[] | Absolute origins to verify after deploy |
| `htmlEntries` | string[] | Dist HTML files whose linked CSS/JS must exist |
| `staticPrefixes` | string[] | Path prefixes that must never return HTML |
| `spaPrefixes` | string[] | Path prefixes that serve an SPA shell for extensionless documents |
| `spaStaticPrefixes` | string[] | Static trees under SPA prefixes that skip shell fallback |
| `documentRoutes` | string[] | Optional live deep links that must return the SPA shell |
| `retryAttempts` | number | Live verification attempts |
| `retryDelayMs` | number | Delay between attempts |
| `forbiddenPatterns` | string[] | Regexes banned from dist contents |
| `requiredPatterns` | string[] | Optional regexes required in dist |
| `workerSourceDir` | string | Output directory for `pages:setup` |
| `userAgent` | string | Verifier User-Agent |

## SPA asset guard

`caddie cloudflare:pages:setup` writes:

- `_worker.js` — serves SPA shells for configured document routes; converts HTML ASSETS responses under `staticPrefixes` into `404 text/plain` with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`
- `_routes.json` — routes those prefixes through the worker

Your build must copy both files into `distDir`.

Deep-link fallback applies only to extensionless document paths under `spaPrefixes` that are not also under `staticPrefixes` / `spaStaticPrefixes`. Filenames and static asset paths never receive the SPA shell rewrite.

## Publish flow

```bash
caddie cloudflare:pages:publish
```

1. Run `buildCommand`
2. Verify local HTML entries + hashed CSS/JS files exist
3. Reject forbidden local URL / secret patterns in dist
4. Require `_worker.js` and `_routes.json` in dist
5. Authenticate Wrangler if needed
6. `wrangler pages deploy <distDir> --project-name ... --branch ...`
7. For each hostname: match hashes, require CSS/JS MIME types, reject HTML bodies, require missing assets → 404
8. Retry for `retryAttempts` × `retryDelayMs`
9. Nonzero exit if any check fails — publish is not reported successful until verification passes
