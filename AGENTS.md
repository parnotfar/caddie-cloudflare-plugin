# AGENTS.md — caddie-cloudflare-plugin

## Relationship to caddie.sh

- This is an **optional plugin**, not a core caddie.sh module.
- Install: `make install` → `~/.caddie_modules/.caddie_cloudflare` plus share tree; then `caddie reload`.
- Core skill does **not** catalog this plugin; agents must discover via `caddie cloudflare:help` / `core:module:commands cloudflare`.
- Version independently of `CADDIE_SH_VERSION`.

## Conventions

- Prefer project-pinned `./node_modules/.bin/wrangler`; use `cloudflare:wrangler:set` for explicit fallbacks
- Apps own `caddie.cloudflare.pages.json`, dist output, and Wrangler auth
- Do not hardcode ParNotFar hostnames in reusable runtime — keep them in project config / examples
- Do not deploy while developing this plugin unless the user asks
- Validate: `make install`, `caddie reload`, `caddie cloudflare:help`, `make lint`, `make test`
