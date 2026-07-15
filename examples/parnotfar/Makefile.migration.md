# ParNotFar website Makefile reduction (example only)

Do **not** apply this automatically to `/Users/wes/work/pnf/website` until the plugin is installed and tested in that repo.

## 1. Add project config

Copy [caddie.cloudflare.pages.json](./caddie.cloudflare.pages.json) to the website repo root (or run `caddie cloudflare:pages:config:init parnotfar`).

## 2. Install scaffold once

```bash
caddie cloudflare:pages:setup
# refreshes apps/site/public/_worker.js and _routes.json from config
```

Keep copying those files into `dist` during `npm run build` / `make build` as today.

## 3. Reduce Makefile publish targets

Replace custom verify/publish wiring with:

```makefile
publish: install
	caddie cloudflare:pages:publish

verify-production-build:
	caddie cloudflare:pages:verify-build

verify-live:
	caddie cloudflare:pages:verify-live
```

You can then delete or stop calling:

- `scripts/verify-live-assets.mjs` (functionality covered by the plugin)
- Hard-coded `PRODUCTION_URL` / `WWW_PRODUCTION_URL` verify invocations (move into `hostnames`)
- Duplicate forbidden-URL greps that now live in `forbiddenPatterns`

Keep website-specific build steps that the plugin should not own (`.env.production` checks, typecheck, supabase URL presence) inside `make build` / `buildCommand`.

## 4. Acceptance

```bash
caddie cloudflare:doctor
caddie cloudflare:pages:verify-build
# after a real deploy window you choose:
caddie cloudflare:pages:verify-live
```
