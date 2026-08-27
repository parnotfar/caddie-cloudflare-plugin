# caddie-cloudflare-plugin Release Notes

## Version 1.1.0 - Thin agent skill

**Release Date:** August 27, 2026

- Added the `caddie-cloudflare` skill for production publish, pinned Wrangler, and live-verification policy.
- Added skill installers for Cursor, Codex, and Claude.
- Removed legacy `export -f` declarations; child shells use `caddie agent:exec`.

---

## Version 1.0.0 - Cloudflare Pages publish with SPA asset guards

**Release Date:** July 14, 2026

### New features

- **`cloudflare:pages:publish`**: Build, deploy with project-pinned Wrangler, then verify every configured production hostname before success.
- **`cloudflare:pages:verify-build`**: Build the configured artifact and reject missing hashed CSS/JS references plus forbidden local-development URL patterns.
- **`cloudflare:pages:verify-live`**: Confirm live HTML matches local hashed assets, require correct CSS/JS MIME types, reject HTML bodies for assets, and require missing static paths to return HTTP 404 (never an SPA shell). Retries across a configurable propagation window.
- **`cloudflare:pages:setup`**: Generate reusable `_worker.js` + `_routes.json` scaffolds that guard configured static prefixes and preserve SPA document deep links.
- **`cloudflare:pages:config:init`**: Project-owned `caddie.cloudflare.pages.json` with `simple` and `parnotfar` presets (hosts stay in app config, not plugin runtime).

### Usage

```bash
cd caddie-cloudflare-plugin
make install
caddie reload
caddie cloudflare:help
```
