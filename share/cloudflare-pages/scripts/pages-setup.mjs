#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { generateRoutesConfig, generateWorkerSource } from "../lib/worker-guard.mjs";

const { root, config, configPath } = await loadConfig(process.cwd());
const sourceDir = resolve(root, config.workerSourceDir);
await mkdir(sourceDir, { recursive: true });

const workerPath = resolve(sourceDir, "_worker.js");
const routesPath = resolve(sourceDir, "_routes.json");
const routes = generateRoutesConfig(config);

await writeFile(workerPath, generateWorkerSource(config), "utf8");
await writeFile(routesPath, `${JSON.stringify(routes, null, 2)}\n`, "utf8");

console.log(`Config: ${configPath}`);
console.log(`Wrote ${workerPath}`);
console.log(`Wrote ${routesPath}`);
console.log("Include these files in your production dist (copy public → dist during build).");
