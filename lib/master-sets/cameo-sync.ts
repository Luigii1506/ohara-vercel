import { prisma } from "@/lib/prisma";
import {
  GOOGLE_CAMEO_SPREADSHEET_ID,
  classifyMasterSetVariant,
  fetchGoogleCameoRows,
  fetchGoogleCameoTabs,
  MasterSetVariantCategory,
  normalizeCardCode,
  slugifyCharacterName,
} from "@/lib/master-sets/google-sheet";

type Logger = (message: string) => void;

type SyncOptions = {
  spreadsheetId?: string;
  limitSheets?: number;
  onlyGids?: string[];
  onlyNames?: string[];
  logger?: Logger;
};

type SyncSummary = {
  spreadsheetId: string;
  sheetsProcessed: number;
  entriesProcessed: number;
  entriesMatched: number;
  entriesUnmatched: number;
  linksUpserted: number;
  charactersUpserted: number;
};

type IndexedCard = {
  id: number;
  code: string;
  name: string;
  region: string | null;
  baseCardId: number | null;
  isFirstEdition: boolean;
  alternateArt: string | null;
  disclaimer: string | null;
  tcgplayerProductId: string | null;
  tcgUrl: string | null;
};

type CardIndexes = {
  byCode: Map<string, IndexedCard[]>;
  byProductId: Map<string, IndexedCard>;
};

function normalizeName(value: string | null | undefined) {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cardVariantSignals(card: IndexedCard) {
  const category = classifyMasterSetVariant(
    card.alternateArt,
    `${card.disclaimer ?? ""} ${card.tcgUrl ?? ""}`
  );

  return {
    category,
    isBase: category === "BASE" && card.baseCardId === null && card.isFirstEdition,
    isPreRelease: category === "PRE_RELEASE",
    isReleaseEvent: category === "RELEASE_EVENT",
    isJudge: category === "JUDGE",
    isWinner: category === "WINNER",
    hasTcgplayerSignal: Boolean(card.tcgplayerProductId || card.tcgUrl),
  };
}

function categoriesForRequestedVariant(
  variant: string | null | undefined,
  specialSet: string | null | undefined
): MasterSetVariantCategory[] {
  const category = classifyMasterSetVariant(variant, specialSet);

  switch (category) {
    case "PRE_RELEASE":
      return ["PRE_RELEASE", "RELEASE_EVENT"];
    case "WINNER":
      return ["WINNER", "TOP_PLAYER"];
    case "PARTICIPATION":
      return ["PARTICIPATION", "FINALIST"];
    default:
      return [category];
  }
}

function scoreVariantMatch(
  card: IndexedCard,
  variant: string | null | undefined,
  specialSet: string | null | undefined
) {
  const requestedCategories = categoriesForRequestedVariant(variant, specialSet);
  const requestedPrimary = requestedCategories[0];
  const signals = cardVariantSignals(card);

  if (requestedPrimary === "BASE") {
    let score = 0;
    if (signals.isBase) score += 900;
    if (card.region === "US") score += 100;
    if (signals.hasTcgplayerSignal) score += 50;
    if (signals.category !== "BASE") {
      score -= 800;
    }
    return score;
  }

  let score = 0;
  if (requestedCategories.includes(signals.category)) {
    score += signals.category === requestedPrimary ? 1400 : 1100;
  } else {
    score -= 1800;
  }

  if (card.region === "US") score += 100;
  if (signals.hasTcgplayerSignal) score += 75;

  return score;
}

function pickBestCardCandidate(
  indexes: CardIndexes,
  candidates: IndexedCard[],
  cardName?: string | null,
  variant?: string | null,
  specialSet?: string | null,
  tcgplayerProductId?: string | null
) {
  if (tcgplayerProductId) {
    const exactProductMatch = indexes.byProductId.get(tcgplayerProductId);
    if (exactProductMatch) {
      return exactProductMatch;
    }
  }

  if (candidates.length === 0) return null;

  const normalizedName = normalizeName(cardName);
  const byName = normalizedName
    ? candidates.filter((candidate) => normalizeName(candidate.name) === normalizedName)
    : [];
  const pool = byName.length > 0 ? byName : candidates;

  const requestedCategories = categoriesForRequestedVariant(variant, specialSet);
  const requestedPrimary = requestedCategories[0];

  let filteredPool = pool;

  if (requestedPrimary === "BASE") {
    filteredPool = pool.filter((candidate) => cardVariantSignals(candidate).isBase);
  } else {
    filteredPool = pool.filter((candidate) =>
      requestedCategories.includes(cardVariantSignals(candidate).category)
    );
  }

  if (filteredPool.length === 0) {
    return null;
  }

  if (requestedPrimary === "BASE") {
    const usBaseWithTcgplayer = filteredPool.filter(
      (candidate) =>
        candidate.region === "US" &&
        cardVariantSignals(candidate).isBase &&
        Boolean(candidate.tcgplayerProductId || candidate.tcgUrl)
    );

    if (usBaseWithTcgplayer.length > 0) {
      filteredPool = usBaseWithTcgplayer;
    } else {
      const usBase = filteredPool.filter(
        (candidate) =>
          candidate.region === "US" && cardVariantSignals(candidate).isBase
      );

      if (usBase.length > 0) {
        filteredPool = usBase;
      }
    }
  }

  return [...filteredPool].sort((left, right) => {
    const leftVariantScore = scoreVariantMatch(left, variant, specialSet);
    const rightVariantScore = scoreVariantMatch(right, variant, specialSet);
    const leftScore =
      leftVariantScore +
      (left.region === "US" ? 100 : 0) +
      (left.baseCardId === null ? 10 : 0) +
      (left.isFirstEdition ? 1 : 0) +
      (left.tcgplayerProductId ? 1 : 0);
    const rightScore =
      rightVariantScore +
      (right.region === "US" ? 100 : 0) +
      (right.baseCardId === null ? 10 : 0) +
      (right.isFirstEdition ? 1 : 0) +
      (right.tcgplayerProductId ? 1 : 0);

    return rightScore - leftScore || left.id - right.id;
  })[0];
}

async function buildCardIndexes() {
  const cards = await prisma.card.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      region: true,
      baseCardId: true,
      isFirstEdition: true,
      alternateArt: true,
      disclaimer: true,
      tcgplayerProductId: true,
      tcgUrl: true,
    },
  });

  const byCode = new Map<string, IndexedCard[]>();
  const byProductId = new Map<string, IndexedCard>();

  for (const card of cards) {
    const normalizedCode = normalizeCardCode(card.code);
    if (!normalizedCode) continue;

    const list = byCode.get(normalizedCode) ?? [];
    list.push(card);
    byCode.set(normalizedCode, list);

    if (card.tcgplayerProductId) {
      byProductId.set(card.tcgplayerProductId, card);
    }
  }

  return { byCode, byProductId };
}

function sheetUrl(spreadsheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`;
}

export async function syncGoogleCameoSource(
  options: SyncOptions = {}
): Promise<SyncSummary> {
  const spreadsheetId = options.spreadsheetId ?? GOOGLE_CAMEO_SPREADSHEET_ID;
  const logger = options.logger ?? console.log;
  const characterEntityClient = (prisma as any).characterEntity;
  const sourceSheetClient = (prisma as any).characterSourceSheet;
  const sourceEntryClient = (prisma as any).characterCameoSourceEntry;
  const cardCharacterLinkClient = (prisma as any).cardCharacterLink;

  const tabs = await fetchGoogleCameoTabs(spreadsheetId);
  const filteredTabs = tabs
    .filter((tab) => tab.sheetType === "CHARACTER")
    .filter((tab) =>
      options.onlyGids?.length ? options.onlyGids.includes(tab.gid) : true
    )
    .filter((tab) =>
      options.onlyNames?.length ? options.onlyNames.includes(tab.name) : true
    )
    .slice(0, options.limitSheets ?? Number.POSITIVE_INFINITY);

  const indexes = await buildCardIndexes();

  let charactersUpserted = 0;
  let entriesProcessed = 0;
  let entriesMatched = 0;
  let entriesUnmatched = 0;
  let linksUpserted = 0;

  for (const tab of filteredTabs) {
    const slug = slugifyCharacterName(tab.name);
    if (!slug) continue;

    logger(`[cameo-sync] syncing sheet ${tab.name} (${tab.gid})`);

    const character = await characterEntityClient.upsert({
      where: { slug },
      update: {
        name: tab.name,
        isActive: true,
        aliases: {
          set: [tab.name],
        },
      },
      create: {
        slug,
        name: tab.name,
        aliases: [tab.name],
        isActive: true,
      },
    });

    charactersUpserted += 1;

    const sheetRecord = await sourceSheetClient.upsert({
      where: {
        spreadsheetId_gid: {
          spreadsheetId,
          gid: tab.gid,
        },
      },
      update: {
        characterId: character.id,
        sheetName: tab.name,
        sheetType: "CHARACTER",
        sourceUrl: sheetUrl(spreadsheetId, tab.gid),
        isActive: true,
      },
      create: {
        characterId: character.id,
        spreadsheetId,
        gid: tab.gid,
        sheetName: tab.name,
        sheetType: "CHARACTER",
        sourceUrl: sheetUrl(spreadsheetId, tab.gid),
        isActive: true,
      },
    });

    const rows = await fetchGoogleCameoRows(tab.gid, spreadsheetId);

    await prisma.$transaction([
      sourceEntryClient.updateMany({
        where: { sheetId: sheetRecord.id },
        data: { isActive: false },
      }),
      cardCharacterLinkClient.deleteMany({
        where: {
          source: "GOOGLE_SHEET",
          sourceSheetId: sheetRecord.id,
        },
      }),
    ]);

    let sheetMatched = 0;
    let sheetUnmatched = 0;

    for (const row of rows) {
      const candidates = row.setNumber ? indexes.byCode.get(row.setNumber) ?? [] : [];
      const matchedCard = pickBestCardCandidate(
        indexes,
        candidates,
        row.cardName,
        row.variant,
        row.specialSet,
        row.tcgplayerProductId
      );
      const status = matchedCard ? "MATCHED" : "UNMATCHED";
      const matchedByProductId =
        Boolean(row.tcgplayerProductId) &&
        matchedCard?.tcgplayerProductId === row.tcgplayerProductId;
      const note = matchedCard
        ? matchedByProductId
          ? `Matched by productId ${row.tcgplayerProductId}${row.setNumber ? ` code ${row.setNumber}` : ""}`
          : `Matched by code ${row.setNumber ?? "unknown"}${row.variant ? ` variant ${row.variant}` : ""}${matchedCard.tcgplayerProductId ? ` pid ${matchedCard.tcgplayerProductId}` : ""}`
        : row.setNumber
        ? `No card matched code ${row.setNumber}${row.tcgplayerProductId ? ` pid ${row.tcgplayerProductId}` : ""}`
        : "Row missing Set Number";

      const entry = await sourceEntryClient.upsert({
        where: {
          sheetId_rowNumber: {
            sheetId: sheetRecord.id,
            rowNumber: row.rowNumber,
          },
        },
        update: {
          characterId: character.id,
          sourceCardName: row.cardName,
          sourceCardType: row.cardType,
          sourceCardCode: row.setNumber,
          sourceVariant: row.variant,
          specialSet: row.specialSet,
          relationType: "DEPICTED_IN_ART",
          matchedCardId: matchedCard?.id ?? null,
          status,
          isActive: true,
          notes: note,
          rawData: row.raw,
        },
        create: {
          sheetId: sheetRecord.id,
          characterId: character.id,
          rowNumber: row.rowNumber,
          sourceCardName: row.cardName,
          sourceCardType: row.cardType,
          sourceCardCode: row.setNumber,
          sourceVariant: row.variant,
          specialSet: row.specialSet,
          relationType: "DEPICTED_IN_ART",
          matchedCardId: matchedCard?.id ?? null,
          status,
          isActive: true,
          notes: note,
          rawData: row.raw,
        },
      });

      entriesProcessed += 1;

      if (!matchedCard) {
        entriesUnmatched += 1;
        sheetUnmatched += 1;
        continue;
      }

      entriesMatched += 1;
      sheetMatched += 1;

      await cardCharacterLinkClient.upsert({
        where: {
          unique_card_character_relation: {
            cardId: matchedCard.id,
            characterId: character.id,
            relationType: "DEPICTED_IN_ART",
          },
        },
        update: {
          source: "GOOGLE_SHEET",
          sourceSheetId: sheetRecord.id,
          sourceEntryId: entry.id,
          notes: `Imported from Google Sheet row ${row.rowNumber}`,
        },
        create: {
          cardId: matchedCard.id,
          characterId: character.id,
          relationType: "DEPICTED_IN_ART",
          source: "GOOGLE_SHEET",
          sourceSheetId: sheetRecord.id,
          sourceEntryId: entry.id,
          notes: `Imported from Google Sheet row ${row.rowNumber}`,
        },
      });

      linksUpserted += 1;
    }

    await sourceSheetClient.update({
      where: { id: sheetRecord.id },
      data: {
        lastSyncedAt: new Date(),
        lastRowCount: rows.length,
        syncNotes: `Matched ${sheetMatched}, unmatched ${sheetUnmatched}`,
      },
    });

    logger(
      `[cameo-sync] sheet ${tab.name} done rows=${rows.length} matched=${sheetMatched} unmatched=${sheetUnmatched}`
    );
  }

  return {
    spreadsheetId,
    sheetsProcessed: filteredTabs.length,
    entriesProcessed,
    entriesMatched,
    entriesUnmatched,
    linksUpserted,
    charactersUpserted,
  };
}
