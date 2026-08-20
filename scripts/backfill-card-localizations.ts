import { Prisma } from "@prisma/client";

import {
  buildCardLocalizationDrafts,
  buildCardLocalizationDraftsWithTranslations,
} from "@/lib/cards/localization/drafts";
import { prisma } from "@/lib/prisma";
import { CardTextTranslationService } from "@/lib/cards/localization/translator";

type CliOptions = {
  language: string;
  dryRun: boolean;
  limit: number | null;
  cardId: number | null;
  overwriteDrafts: boolean;
  mode: "glossary" | "ai";
  startCardId: number | null;
  onlyMissingAi: boolean;
};

type PendingCardRow = {
  id: number;
};

const OP_SET_CODES = Array.from({ length: 17 }, (_, index) =>
  `OP${String(index + 1).padStart(2, "0")}`
);
const ST_SET_CODES = Array.from({ length: 36 }, (_, index) =>
  `ST${String(index + 1).padStart(2, "0")}`
);
function buildPriorityCaseSql() {
  return Prisma.sql`
    CASE
      WHEN c."setCode" IN (${Prisma.join(OP_SET_CODES)}) THEN 0
      WHEN c."setCode" IN (${Prisma.join(ST_SET_CODES)}) THEN 1
      ELSE 2
    END
  `;
}

async function fetchPendingCardIds(options: CliOptions, take: number) {
  const priorityPhaseSql = buildPriorityCaseSql();

  if (options.cardId) {
    return [{ id: options.cardId }];
  }

  if (options.mode === "ai" && options.onlyMissingAi) {
    return prisma.$queryRaw<PendingCardRow[]>(Prisma.sql`
      SELECT c.id
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
                AND cl.language = ${options.language}
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
                  AND cl.language = ${options.language}
                  AND cl."translationSource" = 'AI'
                  AND cl."sourceKey" = ('text:' || t.id::text)
              )
          )
        )
      ORDER BY
        ${priorityPhaseSql},
        c."setCode" ASC,
        c.code ASC,
        c.id ASC
      LIMIT ${take}
    `);
  }

  return prisma.$queryRaw<PendingCardRow[]>(Prisma.sql`
    SELECT c.id
    FROM "Card" c
    WHERE c."baseCardId" IS NULL
      AND c.region = 'US'
      AND (
        c."triggerCard" IS NOT NULL
        OR EXISTS (SELECT 1 FROM "CardEffect" e WHERE e."cardId" = c.id)
        OR EXISTS (SELECT 1 FROM "CardText" t WHERE t."cardId" = c.id)
      )
    ORDER BY
      ${priorityPhaseSql},
      c."setCode" ASC,
      c.code ASC,
      c.id ASC
    LIMIT ${take}
  `);
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    language: "es",
    dryRun: false,
    limit: null,
    cardId: null,
    overwriteDrafts: false,
    mode: "glossary",
    startCardId: null,
    onlyMissingAi: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--overwrite-drafts") options.overwriteDrafts = true;
    else if (arg === "--only-missing-ai") options.onlyMissingAi = true;
    else if (arg === "--mode=ai") options.mode = "ai";
    else if (arg === "--mode=glossary") options.mode = "glossary";
    else if (arg.startsWith("--language=")) {
      options.language = arg.split("=")[1]?.trim() || "es";
    } else if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.split("=")[1]);
      options.limit = Number.isFinite(parsed) ? parsed : null;
    } else if (arg.startsWith("--card-id=")) {
      const parsed = Number(arg.split("=")[1]);
      options.cardId = Number.isInteger(parsed) ? parsed : null;
    } else if (arg.startsWith("--start-card-id=")) {
      const parsed = Number(arg.split("=")[1]);
      options.startCardId = Number.isInteger(parsed) ? parsed : null;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const startedAt = Date.now();
  let processedCards = 0;
  let generatedDrafts = 0;
  let writtenDrafts = 0;
  let cursorId = options.startCardId ?? 0;
  const translator = new CardTextTranslationService({
    minIntervalMs: options.mode === "ai" ? 15_000 : 0,
    maxRetries: options.mode === "ai" ? 6 : 0,
  });

  try {
    while (true) {
      const pendingCardIds = await fetchPendingCardIds(
        options,
        options.cardId ? 1 : 100
      );
      if (pendingCardIds.length === 0) break;

      const cards = await prisma.card.findMany({
        where: {
          id: {
            in: pendingCardIds.map((row) => row.id),
          },
        },
        include: {
          effects: { orderBy: { id: "asc" } },
          texts: { orderBy: { id: "asc" } },
          localizations: {
            where: { language: options.language },
            orderBy: [{ sourceOrder: "asc" }, { id: "asc" }],
          },
        },
      });

      if (cards.length === 0) break;

      const orderedCards = pendingCardIds
        .map((row) => cards.find((card) => card.id === row.id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card));

      for (const card of orderedCards) {
        const cardStartedAt = Date.now();
        console.log(
          `[backfill-card-localizations] start cardId=${card.id} setCode=${card.setCode} code=${card.code} mode=${options.mode} processed=${processedCards + 1}${options.limit ? `/${options.limit}` : ""}`
        );

        const drafts =
          options.mode === "ai"
            ? await buildCardLocalizationDraftsWithTranslations(
                card,
                options.language,
                translator,
                "ai"
              )
            : buildCardLocalizationDrafts(card, options.language);
        generatedDrafts += drafts.length;
        processedCards += 1;

        if (!options.dryRun && drafts.length > 0) {
          const existingEntries = new Map(
            card.localizations.map((entry) => [entry.sourceKey, entry])
          );

          const toWrite = drafts.filter((draft) => {
            const existing = existingEntries.get(draft.sourceKey);
            if (!existing) return true;
            if (
              options.onlyMissingAi &&
              options.mode === "ai" &&
              existing.translationSource === "AI"
            ) {
              return false;
            }
            if (existing.status === "APPROVED" && !options.overwriteDrafts)
              return false;
            return options.overwriteDrafts;
          });

          if (toWrite.length > 0) {
            await prisma.$transaction(
              toWrite.map((draft) =>
                prisma.cardLocalization.upsert({
                  where: {
                    cardId_language_sourceKey: {
                      cardId: draft.cardId,
                      language: draft.language,
                      sourceKey: draft.sourceKey,
                    },
                  },
                  create: draft,
                  update: {
                    sourceText: draft.sourceText,
                    translatedText: draft.translatedText,
                    sourceHash: draft.sourceHash,
                    glossaryVersion: draft.glossaryVersion,
                    sourceOrder: draft.sourceOrder,
                    sourceRecordId: draft.sourceRecordId,
                    translationSource: draft.translationSource,
                    status: "DRAFT",
                  },
                })
              )
            );
            writtenDrafts += toWrite.length;
          }
        }

        console.log(
          `[backfill-card-localizations] done cardId=${card.id} generated=${drafts.length} writtenTotal=${writtenDrafts} cardMs=${Date.now() - cardStartedAt} totalMs=${Date.now() - startedAt}`
        );

        cursorId = card.id;

        if (options.limit && processedCards >= options.limit) {
          console.log(
            JSON.stringify(
              {
                processedCards,
                generatedDrafts,
                writtenDrafts,
                dryRun: options.dryRun,
                language: options.language,
                mode: options.mode,
                lastCardId: cursorId,
              },
              null,
              2
            )
          );
          return;
        }
      }

      if (options.cardId) break;
    }

    console.log(
      JSON.stringify(
        {
          processedCards,
          generatedDrafts,
          writtenDrafts,
          dryRun: options.dryRun,
          language: options.language,
          mode: options.mode,
          lastCardId: cursorId,
        },
        null,
        2
      )
    );
  } finally {
    await translator.flush();
  }
}

main()
  .catch((error) => {
    console.error("[backfill-card-localizations] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
