import { spawn } from "node:child_process";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RunnerOptions = {
  language: string;
  batchSize: number;
  maxBatches: number | null;
  sleepMs: number;
  overwriteDrafts: boolean;
};

const OP_SET_CODES = Array.from({ length: 17 }, (_, index) =>
  `OP${String(index + 1).padStart(2, "0")}`
);
const ST_SET_CODES = Array.from({ length: 36 }, (_, index) =>
  `ST${String(index + 1).padStart(2, "0")}`
);
function parseArgs(): RunnerOptions {
  const options: RunnerOptions = {
    language: "es",
    batchSize: 10,
    maxBatches: null,
    sleepMs: 2_000,
    overwriteDrafts: true,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--language=")) {
      options.language = arg.split("=")[1]?.trim() || "es";
    } else if (arg.startsWith("--batch-size=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        options.batchSize = parsed;
      }
    } else if (arg.startsWith("--max-batches=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        options.maxBatches = parsed;
      }
    } else if (arg.startsWith("--sleep-ms=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isInteger(parsed) && parsed >= 0) {
        options.sleepMs = parsed;
      }
    } else if (arg === "--no-overwrite-drafts") {
      options.overwriteDrafts = false;
    }
  }

  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRemainingCardCount(language: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "Card" c
    WHERE c."baseCardId" IS NULL
      AND c.region = 'US'
      AND (
        (
          c."triggerCard" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "CardLocalization" cl
            WHERE cl."cardId" = c.id
              AND cl.language = ${language}
              AND cl."translationSource" = 'AI'
              AND cl."sourceKey" = 'triggerCard'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM "CardText" t
          WHERE t."cardId" = c.id
            AND NOT EXISTS (
              SELECT 1
              FROM "CardLocalization" cl
              WHERE cl."cardId" = c.id
                AND cl.language = ${language}
                AND cl."translationSource" = 'AI'
                AND cl."sourceKey" = ('text:' || t.id::text)
            )
        )
      )
  `);

  const rawCount = rows[0]?.count ?? 0;
  return typeof rawCount === "bigint" ? Number(rawCount) : rawCount;
}

async function getNextPendingCardPreview(language: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; setCode: string; code: string }>
  >(Prisma.sql`
    SELECT c.id, c."setCode", c.code
    FROM "Card" c
    WHERE c."baseCardId" IS NULL
      AND c.region = 'US'
      AND (
        (
          c."triggerCard" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "CardLocalization" cl
            WHERE cl."cardId" = c.id
              AND cl.language = ${language}
              AND cl."translationSource" = 'AI'
              AND cl."sourceKey" = 'triggerCard'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM "CardText" t
          WHERE t."cardId" = c.id
            AND NOT EXISTS (
              SELECT 1
              FROM "CardLocalization" cl
              WHERE cl."cardId" = c.id
                AND cl.language = ${language}
                AND cl."translationSource" = 'AI'
                AND cl."sourceKey" = ('text:' || t.id::text)
            )
        )
      )
    ORDER BY
      CASE
        WHEN c."setCode" IN (${Prisma.join(OP_SET_CODES)}) THEN 0
        WHEN c."setCode" IN (${Prisma.join(ST_SET_CODES)}) THEN 1
        ELSE 2
      END,
      c."setCode" ASC,
      c.code ASC,
      c.id ASC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

type BackfillResult = {
  processedCards: number;
  generatedDrafts: number;
  writtenDrafts: number;
  dryRun: boolean;
  language: string;
  mode: "glossary" | "ai";
  lastCardId: number;
};

async function runBatch(
  options: RunnerOptions
): Promise<BackfillResult | null> {
  const args = [
    "tsx",
    "scripts/backfill-card-localizations.ts",
    `--language=${options.language}`,
    "--mode=ai",
    "--only-missing-ai",
    `--limit=${options.batchSize}`,
  ];

  if (options.overwriteDrafts) {
    args.push("--overwrite-drafts");
  }

  return await new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk.toString());
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Batch failed with exit code ${code ?? "unknown"}`));
        return;
      }

      const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
      if (!jsonMatch) {
        resolve(null);
        return;
      }

      resolve(JSON.parse(jsonMatch[0]) as BackfillResult);
    });
  });
}

async function main() {
  const options = parseArgs();
  const startedAt = Date.now();
  let batchIndex = 0;
  let lastCardId = 0;

  console.log(
    `[card-localizations-runner] starting with language=${options.language}, batchSize=${options.batchSize}, order=OP01-OP17 -> ST01-ST36 -> rest`
  );

  while (true) {
    if (options.maxBatches && batchIndex >= options.maxBatches) {
      console.log(
        `[card-localizations-runner] reached max batches (${options.maxBatches}).`
      );
      break;
    }

    const remainingBefore = await getRemainingCardCount(options.language);
    if (remainingBefore === 0) {
      console.log("[card-localizations-runner] no remaining cards to process.");
      break;
    }

    const nextPendingCard = await getNextPendingCardPreview(options.language);

    console.log(
      `[card-localizations-runner] batch ${batchIndex + 1} starting from next=${nextPendingCard?.setCode ?? "?"}/${nextPendingCard?.code ?? "?"}/cardId=${nextPendingCard?.id ?? 0} (${remainingBefore} cards remaining)`
    );

    const batchResult = await runBatch(options);
    if (!batchResult) {
      console.log("[card-localizations-runner] no JSON result returned. stopping.");
      break;
    }

    batchIndex += 1;
    lastCardId = batchResult.lastCardId;

    console.log(
      `[card-localizations-runner] batch ${batchIndex} done: processed=${batchResult.processedCards}, written=${batchResult.writtenDrafts}, lastCardId=${batchResult.lastCardId}`
    );

    if (batchResult.processedCards === 0) {
      console.log("[card-localizations-runner] processed 0 cards. stopping.");
      break;
    }

    if (options.sleepMs > 0) {
      await sleep(options.sleepMs);
    }
  }

  const aiCount = await prisma.cardLocalization.count({
    where: {
      language: options.language,
      translationSource: "AI",
    },
  });

  const elapsedMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        language: options.language,
        batchesCompleted: batchIndex,
        lastCardId,
        aiRows: aiCount,
        elapsedMs,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[card-localizations-runner] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
