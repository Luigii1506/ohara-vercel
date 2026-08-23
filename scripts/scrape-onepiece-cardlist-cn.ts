#!/usr/bin/env -S npx tsx
//
// Wrapper CLI sobre lib/services/cnOfficialSync.ts (lógica compartida con el
// cron de sincronización CN). Este archivo solo parsea argv, corre
// runCnSync() y escribe los archivos de seguimiento de fallos que otros
// scripts (retry-cn-missing-images.ts) leen.
//
// Uso: ver runCnSync/CnSyncOptions en lib/services/cnOfficialSync.ts para
// todas las opciones disponibles (--dry-run, --update-existing, --limit=N,
// --offer-type-pattern=..., --set=..., --link-by-card-setcode, etc.)

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { runCnSync, CnSyncOptions } from "@/lib/services/cnOfficialSync";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const missingImagesPath = "scripts/missing-images-cn.json";
const missingUsBasePath = "scripts/missing-us-base-cn.json";

const ensureEnvVars = () => {
  const missing = REQUIRED_ENV.filter(
    (key) => !process.env[key] || process.env[key]!.trim().length === 0
  );
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

const parseArgs = (): Partial<CnSyncOptions> => {
  const args = process.argv.slice(2);
  const options: Partial<CnSyncOptions> = {
    dryRun: args.includes("--dry-run"),
    updateExisting: args.includes("--update-existing"),
    markExclusive: args.includes("--mark-exclusive"),
    linkByCardSetCode: args.includes("--link-by-card-setcode"),
    forceAlternates: args.includes("--force-alternates"),
    promoteAlternateToBase: args.includes("--promote-alternate-base"),
    overrideSetCode: args.includes("--override-setcode"),
    emptySetCode: args.includes("--empty-setcode"),
    backfillCardSource: args.includes("--backfill-card-source"),
    cleanupDuplicates: !args.includes("--no-cleanup-duplicates"),
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) options.limit = value;
    } else if (arg.startsWith("--region=")) {
      options.region = arg.split("=")[1];
    } else if (arg.startsWith("--language=")) {
      options.language = arg.split("=")[1];
    } else if (arg.startsWith("--offer-type=")) {
      options.offerTypeFilter = (arg.split("=")[1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--offer-type-pattern=")) {
      options.offerTypePattern = (arg.split("=")[1] ?? "").trim() || null;
    } else if (arg.startsWith("--offer-type-order=")) {
      const value = (arg.split("=")[1] ?? "").trim().toLowerCase();
      if (value === "asc" || value === "desc") {
        options.offerTypeOrder = value;
        options.offerTypeOrderProvided = true;
      }
    } else if (arg.startsWith("--set=")) {
      options.setFilter = (arg.split("=")[1] ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg.startsWith("--only-ids=")) {
      options.onlyIds = (arg.split("=")[1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--ensure-set-id=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) options.ensureSetId = value;
    }
  }

  return options;
};

const loadJsonArray = async <T>(filePath: string, key: string): Promise<T[]> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.[key]) ? (parsed[key] as T[]) : [];
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

async function main() {
  const options = parseArgs();
  if (!options.dryRun) {
    ensureEnvVars();
  }

  const summary = await runCnSync(options);

  console.log(
    `\n[summary] offerTypes=${summary.offerTypesProcessed} cardsProcessed=${summary.cardsProcessed} created=${summary.created} updated=${summary.updated} skippedExisting=${summary.skippedExisting}`
  );

  if (summary.missingImages.length || summary.networkErrors.length) {
    const existingMissing = await loadJsonArray<{ id: string; url: string }>(
      missingImagesPath,
      "missingImages"
    );
    const seen = new Set(existingMissing.map((e) => `${e.id}::${e.url}`));
    const merged = [...existingMissing];
    for (const entry of summary.missingImages) {
      const key = `${entry.id}::${entry.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(entry);
      }
    }
    await fs.writeFile(
      path.join(process.cwd(), missingImagesPath),
      JSON.stringify(
        { missingImages: merged, networkErrors: summary.networkErrors },
        null,
        2
      )
    );
    console.log(
      `[summary] ${summary.missingImages.length} missing images, ${summary.networkErrors.length} network errors -> ${missingImagesPath}`
    );
  }

  if (summary.missingUsBase.length) {
    const existing = await loadJsonArray<{ id: string; code: string; set: string }>(
      missingUsBasePath,
      "missingUsBaseCards"
    );
    const seen = new Set(existing.map((e) => e.id));
    const merged = [...existing];
    for (const entry of summary.missingUsBase) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        merged.push(entry);
      }
    }
    await fs.writeFile(
      path.join(process.cwd(), missingUsBasePath),
      JSON.stringify({ missingUsBaseCards: merged }, null, 2)
    );
    console.log(
      `[summary] ${summary.missingUsBase.length} cards without a US base -> ${missingUsBasePath}`
    );
  }

  if (summary.unresolvedAlternates) {
    console.log(
      `[summary] ${summary.unresolvedAlternates} alternates unresolved (no base card, no --promote-alternate-base)`
    );
  }
}

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  });
