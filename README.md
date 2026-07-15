# caddie-cloudflare-plugin

Optional **plugin** for [caddie.sh](https://github.com/parnotfar/caddie.sh). Provides the `cloudflare` module for **Cloudflare Pages** publish workflows that refuse SPA fallback responses masquerading as CSS/JS assets.

This repository is **not** part of the core caddie.sh install. It follows the same ecosystem pattern as [caddie-supabase-plugin](https://github.com/parnotfar/caddie-supabase-plugin) and [caddie-docker-plugin](https://github.com/parnotfar/caddie-docker-plugin).

## Relationship to caddie.sh

| Concern | Where it lives |
|---------|----------------|
| Core CLI, skill, discovery protocol | [caddie.sh](https://github.com/parnotfar/caddie.sh) |
| This module’s commands, docs, version | **This repo** |
| `caddie.cloudflare.pages.json`, dist, Wrangler auth | Each application repository |

**Plugin architecture:**

1. `make install` copies `modules/dot_caddie_cloudflare` → `~/.caddie_modules/.caddie_cloudflare`
2. Share scripts install to `~/.caddie_modules/caddie-cloudflare-plugin/`
3. `caddie reload` loads every `.caddie_*` file (core + plugins)
4. Commands are `caddie cloudflare:<command>`
5. Agents discover with `caddie cloudflare:help` or `caddie agent:exec core:module:commands cloudflare`
6. Versioned independently of `CADDIE_SH_VERSION`

## Version

1.0.0

## Why this exists

Cloudflare Pages can return the SPA document with HTTP 200 for a missing hashed asset such as `/assets/main-ABC123.css`. The browser then fails because the response is `text/html` instead of `text/css`.

This plugin:

1. Scaffolds a Pages worker that converts HTML responses under static prefixes into `404 text/plain`
2. Verifies local dist assets before deploy
3. Verifies every production hostname after deploy (MIME type, hash match, missing-path 404)
4. Retries during propagation and fails the publish if verification does not pass

## Commands

| Command | Purpose |
|---------|---------|
| `caddie cloudflare:doctor` | Plugin share, node, project config, Wrangler |
| `caddie cloudflare:pages:config:init [simple\|parnotfar]` | Write `caddie.cloudflare.pages.json` |
| `caddie cloudflare:pages:config:show` | Show project config |
| `caddie cloudflare:pages:setup` | Write `_worker.js` + `_routes.json` |
| `caddie cloudflare:pages:verify-build` | Build + verify local dist |
| `caddie cloudflare:pages:verify-live [hosts...]` | Verify live hostnames |
| `caddie cloudflare:pages:publish` | Build → deploy → verify live |
| `caddie cloudflare:wrangler:set\|get\|unset` | Pin Wrangler CLI |

CLI resolution: prefer `./node_modules/.bin/wrangler`. Never auto-invoke an unpinned PATH “latest” binary.

## Installation

```bash
git clone https://github.com/parnotfar/caddie-cloudflare-plugin.git
cd caddie-cloudflare-plugin
make install
caddie reload
caddie cloudflare:help
```

## Quick start

```bash
cd your-pages-app
caddie cloudflare:pages:config:init
# edit caddie.cloudflare.pages.json
caddie cloudflare:pages:setup
# ensure build copies public/_worker.js and public/_routes.json into dist
caddie cloudflare:pages:verify-build
caddie cloudflare:pages:publish
```

## Configuration

Project marker / config file: **`caddie.cloudflare.pages.json`**

| Field | Purpose |
|-------|---------|
| `buildCommand` | Shell command that produces `distDir` |
| `distDir` | Directory deployed to Pages |
| `projectName` | Cloudflare Pages project name |
| `productionBranch` | Production branch for Wrangler deploy |
| `hostnames` | One or more production origin URLs |
| `htmlEntries` | Dist-relative HTML entries (e.g. `/index.html`) |
| `staticPrefixes` | Asset path prefixes guarded against HTML fallback |
| `spaPrefixes` | Document prefixes that should SPA-shell deep links |
| `spaStaticPrefixes` | Static subtrees under an SPA that are not document routes |
| `documentRoutes` | Optional deep links verified against the SPA shell |
| `retryAttempts` / `retryDelayMs` | Live verification propagation window |
| `forbiddenPatterns` | Regexes that must not appear anywhere in dist |
| `requiredPatterns` | Optional regexes that must appear somewhere in dist |
| `workerSourceDir` | Where `pages:setup` writes `_worker.js` / `_routes.json` |

Defaults include `/assets/` as a guarded static prefix. Nested apps (for example Course Report) add their own prefixes in project config.

See [docs/cloudflare.md](docs/cloudflare.md) and [examples/parnotfar/](examples/parnotfar/).

## Tests

```bash
make test
make lint
```

## Remaining Cloudflare Pages limitations

- Propagation can still serve mixed generations briefly; verification retries mitigate this but cannot eliminate edge skew across PoPs.
- `_routes.json` include/exclude rules are coarse; carefully keep asset prefixes on the worker so the HTML→404 guard runs.
- The guard detects HTML via `Content-Type` from the ASSETS binding. If an upstream ever returned HTML with a non-HTML content type, MIME sniffing alone would not catch it (live verification also rejects HTML bodies).
- Preview deployments are out of V1 (`pages:publish` targets the configured production branch).
- Custom `_redirects` / `_headers` interactions remain app-owned and should be tested with `pages:verify-live`.

## License

MIT (Par Not Far)
