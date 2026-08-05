#!/usr/bin/env -S npx tsx --tsconfig tsconfig.scripts.json

import "dotenv/config";
import { syncLimitlessCatalogReviews } from "@/lib/services/limitlessSetSync";
import { prisma } from "@/lib/prisma";

type Options = {
  category: "main" | "promo" | "all";
  region: string;
  limit: number | null;
  newOnly: boolean;
  staleHours: number | null;
  forceAll: boolean;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getArg = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;

  const categoryRaw = getArg("--category");
  const category =
    categoryRaw === "main" || categoryRaw === "promo" || categoryRaw === "all"
      ? categoryRaw
      : "all";
  const region = (getArg("--region") ?? "US").trim().toUpperCase();
  const limitRaw = Number.parseInt(getArg("--limit") ?? "", 10);
  const staleHoursRaw = Number.parseInt(getArg("--staleHours") ?? "", 10);

  return {
    category,
    region,
    limit: Number.isFinite(limitRaw) ? limitRaw : null,
    newOnly: hasFlag("--new-only"),
    staleHours: Number.isFinite(staleHoursRaw) ? staleHoursRaw : 24,
    forceAll: hasFlag("--force-all"),
  };
}

async function main() {
  const options = parseArgs();
  const result = await syncLimitlessCatalogReviews(options);

  console.log("");
  console.log(
    `[limitless-catalog-feed] category=${options.category} region=${options.region} discovered=${result.discovered} eligible=${result.eligible} synced=${result.synced} failed=${result.failed}`
  );

  result.results.forEach((item) => {
    if (item.ok) {
      console.log(
        `  ✓ ${item.slug} · review ${item.reviewId} · wrong=${item.wrongSetCount} missing=${item.missingCount} extra=${item.extraCount}`
      );
    } else {
      console.log(`  ✕ ${item.slug} · ${item.error}`);
    }
  });
}

main()
  .catch((error) => {
    console.error("[limitless-catalog-feed] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
