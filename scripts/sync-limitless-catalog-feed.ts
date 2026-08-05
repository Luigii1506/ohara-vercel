#!/usr/bin/env -S npx tsx --tsconfig tsconfig.scripts.json

import "dotenv/config";
import {
  getLimitlessCatalogFeed,
  persistLimitlessSetReview,
  reconcileLimitlessSetMembership,
  type LimitlessCatalogFeedEntry,
} from "@/lib/services/limitlessSetSync";
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
    limit: Number.isFinite(limitRaw) ? Math.max(1, limitRaw) : null,
    newOnly: hasFlag("--new-only"),
    staleHours: Number.isFinite(staleHoursRaw) ? Math.max(1, staleHoursRaw) : 24,
    forceAll: hasFlag("--force-all"),
  };
}

function filterEntries(entries: LimitlessCatalogFeedEntry[], options: Options) {
  return entries.filter((entry) => {
    if (options.category !== "all" && entry.category !== options.category) {
      return false;
    }
    if (options.forceAll) {
      return true;
    }
    if (options.newOnly) {
      return entry.isNew;
    }
    return entry.needsSync;
  });
}

async function main() {
  const options = parseArgs();
  const feed = await getLimitlessCatalogFeed({
    region: options.region,
    staleHours: options.staleHours,
  });

  const eligible = filterEntries(feed.entries, options);
  const queue =
    options.limit && Number.isFinite(options.limit)
      ? eligible.slice(0, options.limit)
      : eligible;

  console.log("");
  console.log(
    `[limitless-catalog-feed] discovered=${feed.stats.total} eligible=${eligible.length} queued=${queue.length} category=${options.category} region=${options.region} mode=${options.forceAll ? "force-all" : options.newOnly ? "new-only" : "stale"}`
  );

  const results: Array<{
    slug: string;
    ok: boolean;
    reviewId?: number;
    wrongSetCount?: number;
    missingCount?: number;
    extraCount?: number;
    error?: string;
  }> = [];

  for (const [index, entry] of queue.entries()) {
    console.log(
      `[${index + 1}/${queue.length}] syncing ${entry.slug} · ${entry.title}`
    );

    try {
      const report = await reconcileLimitlessSetMembership({
        setUrlOrSlug: entry.url,
        region: options.region,
      });
      const review = await persistLimitlessSetReview(report, entry.category);
      results.push({
        slug: entry.slug,
        ok: true,
        reviewId: review.id,
        wrongSetCount: report.wrongSet.length,
        missingCount: report.missing.length,
        extraCount: report.extraInDbSet.length,
      });
      console.log(
        `  ✓ review ${review.id} · wrong=${report.wrongSet.length} missing=${report.missing.length} extra=${report.extraInDbSet.length}`
      );
    } catch (error: any) {
      const message = error?.message ?? "Unknown error";
      results.push({
        slug: entry.slug,
        ok: false,
        error: message,
      });
      console.log(`  ✕ ${message}`);
    }
  }

  console.log("");
  console.log(
    `[limitless-catalog-feed] done discovered=${feed.stats.total} eligible=${eligible.length} queued=${queue.length} synced=${results.filter((item) => item.ok).length} failed=${results.filter((item) => !item.ok).length}`
  );
}

main()
  .catch((error) => {
    console.error("[limitless-catalog-feed] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
