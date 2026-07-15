#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { CONFIG_FILENAME, exampleConfig } from "../lib/config.mjs";

const preset = process.argv[2] || "simple";
const targetDir = resolve(process.argv[3] || process.cwd());
const force = process.argv.includes("--force");
const outPath = resolve(targetDir, CONFIG_FILENAME);

if (existsSync(outPath) && !force) {
  console.error(`${CONFIG_FILENAME} already exists at ${outPath}`);
  console.error("Pass --force to overwrite.");
  process.exit(1);
}

await mkdir(dirname(outPath), { recursive: true });
const config = exampleConfig(preset);
await writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
