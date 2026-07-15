#!/usr/bin/env node
import { loadConfig } from "../lib/config.mjs";
import { verifyLive } from "../lib/verify-live.mjs";

try {
  const { root, config } = await loadConfig(process.cwd());
  const hostnames = process.argv.slice(2).filter(Boolean);
  await verifyLive({
    root,
    config,
    hostnames: hostnames.length ? hostnames : config.hostnames,
  });
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
