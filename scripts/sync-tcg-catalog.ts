#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { syncTcgCatalog } from "../lib/services/tcgCatalogSync";
import { syncTcgplayerPrices } from "../lib/services/tcgplayerPriceSync";

const DEFAULT_DELAY_MS = Number(process.env.TCGPLAYER_SYNC_DELAY_MS ?? 2000);

interface CliOptions {
  pageSize: number;
  offset: number;
  limit?: number;
  delayMs: number;
  dryRun?: boolean;
}

const DEFAULT_OPTIONS: CliOptions = {
  pageSize: 100,
  offset: 0,
  delayMs: DEFAULT_DELAY_MS,
};

const REQUIRED_ENV = [
  "DATABASE_URL",
  "TCGPLAYER_PUBLIC_KEY",
  "TCGPLAYER_PRIVATE_KEY",
] as const;

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      loadEnv({ path: fullPath, override: true });
    }
  }
}

function ensureEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

function parseCliOptions(): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };
  const args = process.argv.slice(2);

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.substring(2).split("=");
    const value = rawValue ?? "";
    switch (rawKey) {
      case "pageSize": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
          throw new Error("--pageSize must be between 1 and 100");
        }
        options.pageSize = parsed;
        break;
      }
      case "offset": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("--offset must be >= 0");
        }
        options.offset = parsed;
        break;
      }
      case "limit": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error("--limit must be a positive number");
        }
        options.limit = parsed;
        break;
      }
      case "delayMs": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("--delayMs must be >= 0");
        }
        options.delayMs = parsed;
        break;
      }
      case "dryRun": {
        options.dryRun = value !== "0";
        break;
      }
      default:
        console.warn(`Unknown argument ignored: ${arg}`);
    }
  }

  return options;
}

const log = (message: string, meta?: unknown) => {
  if (meta === undefined) {
    console.log(`[sync-tcg-catalog] ${message}`);
    return;
  }
  console.log(`[sync-tcg-catalog] ${message}`, meta);
};

async function main() {
  loadEnvFiles();
  ensureEnv();
  const options = parseCliOptions();

  log("Starting sync", options);
  const started = Date.now();
  const result = await syncTcgCatalog({
    pageSize: options.pageSize,
    offset: options.offset,
    limit: options.limit,
    delayMs: options.delayMs,
    dryRun: options.dryRun,
    logger: (message, meta) => log(message, meta),
  });
  const duration = ((Date.now() - started) / 1000).toFixed(2);
  log("Sync completed", { ...result, duration });

  if (!result.dryRun) {
    log("Starting price sync");
    const priceResult = await syncTcgplayerPrices();
    log("Price sync completed", priceResult);
  }
}

main().catch((error) => {
  console.error("sync-tcg-catalog failed", error);
  process.exitCode = 1;
});
