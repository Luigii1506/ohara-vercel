#!/usr/bin/env ts-node
//
// Wrapper CLI sobre lib/services/krOfficialSync.ts (lógica compartida con el
// cron de sincronización KR). Este archivo solo parsea argv, corre
// runKrSync() y valida las variables de entorno necesarias para subir
// imágenes — los reportes de seguimiento (missing-us-base-kr.json,
// missing-images-kr.json, missing-kr-alternates.json,
// changed-source-images-kr.json) los escribe la propia runKrSync().
//
// Uso: ver runKrSync/ScriptOptions en lib/services/krOfficialSync.ts para
// todas las opciones disponibles (--dry-run, --update-existing, --limit=N,
// --series=..., --set=..., --link-by-card-setcode, etc.)

import "dotenv/config";
import { runKrSync, ScriptOptions } from "@/lib/services/krOfficialSync";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

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

const parseArgs = (): Partial<ScriptOptions> => {
  const args = process.argv.slice(2);
  const options: Partial<ScriptOptions> = {
    dryRun: args.includes("--dry-run"),
    updateExisting: args.includes("--update-existing"),
    markExclusive: args.includes("--mark-exclusive"),
    emptySetCode: args.includes("--empty-setcode"),
    linkByCardSetCode: args.includes("--link-by-card-setcode"),
    forceAlternates: args.includes("--force-alternates"),
    overrideSetCode: args.includes("--override-setcode"),
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
    } else if (arg.startsWith("--series=")) {
      options.seriesFilter = (arg.split("=")[1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
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
    }
  }

  return options;
};

async function main() {
  const options = parseArgs();
  if (!options.dryRun) {
    ensureEnvVars();
  }

  const summary = await runKrSync(options);

  console.log(
    `\n[summary] created=${summary.created} skipped=${summary.skipped} changedSourceImages=${summary.changedSourceImages} missingUsBase=${summary.missingUsBase} missingImages=${summary.missingImages} unresolvedAlternates=${summary.unresolvedAlternates}`
  );
}

main().catch((error) => {
  console.error("[error] Script failed", error);
  process.exitCode = 1;
});
