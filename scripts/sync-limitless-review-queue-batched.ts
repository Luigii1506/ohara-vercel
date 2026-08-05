#!/usr/bin/env -S npx tsx --tsconfig tsconfig.scripts.json

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { getLimitlessCatalogFeed, syncLimitlessCatalogReviews } from "@/lib/services/limitlessSetSync";
import { prisma } from "@/lib/prisma";

type Category = "main" | "promo" | "all";

type CategoryProgress = {
  completedSlugs: string[];
  synced: number;
  failed: number;
  batchesCompleted: number;
  totalAtStart: number;
  lastUpdatedAt: string | null;
};

type ProgressState = {
  category: Category;
  region: string;
  batchSize: number;
  categories: Record<Exclude<Category, "all">, CategoryProgress>;
};

type Options = {
  category: Category;
  region: string;
  batchSize: number;
  stateFile: string;
  resume: boolean;
  reset: boolean;
  maxBatches: number | null;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const getArg = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;

  const categoryRaw = getArg("--category");
  const category: Category =
    categoryRaw === "main" || categoryRaw === "promo" || categoryRaw === "all"
      ? categoryRaw
      : "all";

  const region = (getArg("--region") ?? "US").trim().toUpperCase();
  const batchSizeRaw = Number.parseInt(getArg("--batch-size") ?? "", 10);
  const batchSize = Number.isFinite(batchSizeRaw) ? Math.max(1, batchSizeRaw) : 20;
  const stateFile =
    getArg("--state-file") ??
    path.join(process.cwd(), ".tmp", "limitless-review-queue-batched-progress.json");
  const resume = !args.includes("--no-resume");
  const reset = args.includes("--reset");
  const maxBatchesRaw = Number.parseInt(getArg("--max-batches") ?? "", 10);
  const maxBatches = Number.isFinite(maxBatchesRaw) ? Math.max(1, maxBatchesRaw) : null;

  return { category, region, batchSize, stateFile, resume, reset, maxBatches };
}

function createEmptyCategoryProgress(): CategoryProgress {
  return {
    completedSlugs: [],
    synced: 0,
    failed: 0,
    batchesCompleted: 0,
    totalAtStart: 0,
    lastUpdatedAt: null,
  };
}

function createInitialState(options: Options): ProgressState {
  return {
    category: options.category,
    region: options.region,
    batchSize: options.batchSize,
    categories: {
      main: createEmptyCategoryProgress(),
      promo: createEmptyCategoryProgress(),
    },
  };
}

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function loadState(options: Options): Promise<ProgressState> {
  if (options.reset) {
    return createInitialState(options);
  }

  if (!options.resume) {
    return createInitialState(options);
  }

  try {
    const raw = await fs.readFile(options.stateFile, "utf8");
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      ...createInitialState(options),
      ...parsed,
      categories: {
        main: {
          ...createEmptyCategoryProgress(),
          ...parsed.categories?.main,
          completedSlugs: parsed.categories?.main?.completedSlugs ?? [],
        },
        promo: {
          ...createEmptyCategoryProgress(),
          ...parsed.categories?.promo,
          completedSlugs: parsed.categories?.promo?.completedSlugs ?? [],
        },
      },
    };
  } catch {
    return createInitialState(options);
  }
}

async function saveState(state: ProgressState, stateFile: string) {
  await ensureParentDir(stateFile);
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function runCategory(
  category: Exclude<Category, "all">,
  state: ProgressState,
  options: Options
) {
  const { region, batchSize, stateFile, maxBatches } = options;
  const feed = await getLimitlessCatalogFeed({ region, staleHours: 24 });
  const progress = state.categories[category];
  const completed = new Set(progress.completedSlugs);
  const entries = feed.entries.filter(
    (entry) => entry.category === category && !completed.has(entry.slug)
  );

  if (progress.totalAtStart === 0) {
    progress.totalAtStart = feed.entries.filter((entry) => entry.category === category).length;
  }

  console.log(
    `[batch-sync] category=${category} region=${region} pending=${entries.length} completed=${progress.completedSlugs.length} total=${progress.totalAtStart} batchSize=${batchSize}`
  );
  await saveState(state, stateFile);

  let processedBatches = 0;
  for (let start = 0; start < entries.length; start += batchSize) {
    if (maxBatches !== null && processedBatches >= maxBatches) {
      console.log(`[batch-sync] category=${category} reached max-batches=${maxBatches}`);
      break;
    }

    const batch = entries.slice(start, start + batchSize).map((entry) => entry.slug);
    const result = await syncLimitlessCatalogReviews({
      category,
      region,
      slugs: batch,
      forceAll: true,
      limit: batch.length,
    });

    progress.synced += result.synced;
    progress.failed += result.failed;
    progress.batchesCompleted += 1;
    progress.lastUpdatedAt = new Date().toISOString();
    processedBatches += 1;

    console.log(
      `[batch-sync] category=${category} batch=${Math.floor(start / batchSize) + 1} range=${start + 1}-${Math.min(start + batchSize, entries.length)} synced=${result.synced} failed=${result.failed}`
    );

    result.results.forEach((item) => {
      progress.completedSlugs.push(item.slug);
      if (item.ok) {
        console.log(
          `  ✓ ${item.slug} · wrong=${item.wrongSetCount} missing=${item.missingCount} extra=${item.extraCount}`
        );
      } else {
        console.log(`  ✕ ${item.slug} · ${item.error}`);
      }
    });

    await saveState(state, stateFile);
  }

  console.log(
    `[batch-sync] done category=${category} synced=${progress.synced} failed=${progress.failed} completed=${progress.completedSlugs.length}/${progress.totalAtStart}`
  );
}

async function main() {
  const options = parseArgs();
  const state = await loadState(options);
  state.category = options.category;
  state.region = options.region;
  state.batchSize = options.batchSize;

  if (options.category === "all") {
    await runCategory("main", state, options);
    await runCategory("promo", state, options);
    return;
  }

  await runCategory(options.category, state, options);
}

main()
  .catch((error) => {
    console.error("[batch-sync] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
