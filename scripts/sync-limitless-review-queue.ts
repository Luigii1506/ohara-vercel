#!/usr/bin/env -S npx tsx --tsconfig tsconfig.scripts.json

import "dotenv/config";
import { syncLimitlessCatalogReviews } from "@/lib/services/limitlessSetSync";
import { prisma } from "@/lib/prisma";

type Options = {
  category: "main" | "promo" | "all";
  region: string;
  limit: number | null;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const getArg = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;

  const categoryRaw = getArg("--category");
  const category =
    categoryRaw === "main" || categoryRaw === "promo" || categoryRaw === "all"
      ? categoryRaw
      : "all";
  const region = (getArg("--region") ?? "US").trim().toUpperCase();
  const limitRaw = Number.parseInt(getArg("--limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : null;

  return { category, region, limit };
}

async function main() {
  const options = parseArgs();
  const result = await syncLimitlessCatalogReviews(options);

  console.log("");
  console.log(
    `[limitless-review-queue] category=${options.category} region=${options.region} total=${result.total} synced=${result.synced} failed=${result.failed}`
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
    console.error("[limitless-review-queue] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
