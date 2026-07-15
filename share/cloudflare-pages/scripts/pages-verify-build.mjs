#!/usr/bin/env node
import { loadConfig } from "../lib/config.mjs";
import { verifyBuild } from "../lib/verify-build.mjs";

try {
  const { root, config } = await loadConfig(process.cwd());
  await verifyBuild({ root, config });
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
