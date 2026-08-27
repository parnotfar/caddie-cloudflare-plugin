---
name: caddie-cloudflare
description: Cloudflare Pages publish and verification plugin for Caddie. Use when configuring, verifying, or publishing Pages projects through caddie cloudflare:* commands.
caddie-cloudflare-version: "1.1.0"
---

# caddie-cloudflare

Optional plugin. Discover commands with `caddie cloudflare:help` or `caddie agent:exec core:module:commands cloudflare`. Do not invent shortcuts. The installed CLI is authoritative.

```bash
caddie agent:exec cloudflare:<command> [args]
```

## Agent rules

1. This skill composes with the core `caddie` skill; live discovery remains authoritative.
2. Prefer `cloudflare:pages:verify-build` before any standalone deployment decision.
3. `cloudflare:pages:publish` is a production publish: it builds, deploys the configured production branch, and verifies every configured live hostname.
4. Do not treat build verification as a publish or publish output as success unless live verification also passes.
5. Review `caddie.cloudflare.pages.json` before publishing, especially `projectName`, `productionBranch`, and `hostnames`.
6. Do not invoke PATH `wrangler`. The module uses the project-pinned binary or `cloudflare:wrangler:set`.
7. If the module is unavailable, use the repository's own build and Wrangler workflow and state that Caddie Cloudflare policy checks were bypassed.
