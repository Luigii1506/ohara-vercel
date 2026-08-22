import {
  type MasterSetVariantCategory,
} from "@/lib/master-sets/google-sheet";
import {
  getMasterSetRelationTypeLabel as relationTypeLabel,
  getMasterSetSourceLabel as sourceLabel,
  getMasterSetVariantLabel as variantLabel,
} from "@/lib/master-sets/presentation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

type VariantMode = "base" | "all";
type RegionMode = "all" | string;
type RelationFilterMode = "all" | string;
type SourceFilterMode = "all" | string;
type SetFilterMode = "all" | string;

export type MasterSetSummary = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  aliases: string[];
  totalCards: number;
  ownedCards: number;
  missingCards: number;
  completionPercent: number;
  totalMarketValue: number;
  averageMarketPrice: number;
  totalMidValue: number;
  averageMidPrice: number;
  relationTypes: string[];
  sources: string[];
  setCodes: string[];
};

export type MasterSetDetailCard = {
  id: number;
  code: string;
  name: string;
  src: string;
  category: string;
  setCode: string;
  region: string | null;
  rarity: string | null;
  marketPrice: number | null;
  midPrice: number | null;
  baseCardId: number | null;
  owned: boolean;
  relationTypes: string[];
  sources: string[];
  alternateArt: string | null;
  variantCategory: MasterSetVariantCategory;
};

export type MasterSetDetail = {
  character: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    aliases: string[];
  };
  totalCards: number;
  ownedCards: number;
  missingCards: number;
  completionPercent: number;
  totalMarketValue: number;
  averageMarketPrice: number;
  totalMidValue: number;
  averageMidPrice: number;
  cards: MasterSetDetailCard[];
  availableSetCodes: string[];
  availableRelationTypes: string[];
  availableSources: string[];
};

export type MasterSetBrowseOptions = {
  setCodes: string[];
  relationTypes: string[];
  sources: string[];
};

export type MasterSetSummariesPage = {
  items: MasterSetSummary[];
  nextCursor: number | null;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyCardVariantCategory(
  alternateArt: string | null | undefined
): MasterSetVariantCategory {
  const lower = (alternateArt ?? "").toLowerCase().trim();
  if (!lower) return "BASE";
  if (lower.includes("manga")) return "MANGA";
  if (lower === "pre-release") return "PRE_RELEASE";
  if (lower === "release event") return "RELEASE_EVENT";
  if (lower === "winner version") return "WINNER";
  if (lower === "finalist version") return "FINALIST";
  if (lower === "participation version") return "PARTICIPATION";
  if (lower === "top player version") return "TOP_PLAYER";
  if (lower === "judge") return "JUDGE";
  if (lower === "treasure cup") return "TREASURE_CUP";
  if (lower === "treasure rare") return "TREASURE_RARE";
  if (lower.includes("anniversary")) return "ANNIVERSARY";
  if (lower === "serial") return "SERIAL";
  if (
    lower === "special card" ||
    lower === "alternate art" ||
    lower === "event exclusive" ||
    lower === "promo" ||
    lower === "gold" ||
    lower === "holo"
  ) {
    return "SPECIAL";
  }
  return "OTHER";
}

async function getOwnedCardIndex(
  userId: number | null | undefined
): Promise<{ exact: Set<number>; bases: Set<number> }> {
  if (!userId) {
    return { exact: new Set(), bases: new Set() };
  }

  const collection = await prisma.collection.findUnique({
    where: { userId },
    select: {
      cards: {
        select: {
          cardId: true,
          card: {
            select: {
              baseCardId: true,
            },
          },
        },
      },
    },
  });

  const exact = new Set<number>();
  const bases = new Set<number>();

  for (const item of collection?.cards ?? []) {
    exact.add(item.cardId);
    bases.add(item.card.baseCardId ?? item.cardId);
  }

  return { exact, bases };
}

async function getOwnedCardIndexForCards(
  userId: number | null | undefined,
  cards: Array<{ id: number; baseCardId: number | null }>,
  variantMode: VariantMode
): Promise<{ exact: Set<number>; bases: Set<number> }> {
  if (!userId || cards.length === 0) {
    return { exact: new Set(), bases: new Set() };
  }

  const exactIds = Array.from(new Set(cards.map((card) => card.id)));
  const baseIds = Array.from(
    new Set(cards.map((card) => card.baseCardId ?? card.id))
  );

  const collectionCards = await prisma.collectionCard.findMany({
    where: {
      collection: { userId },
      OR: variantMode === "all"
        ? [{ cardId: { in: exactIds } }]
        : [
            { cardId: { in: exactIds } },
            { cardId: { in: baseIds } },
            { card: { baseCardId: { in: baseIds } } },
          ],
    },
    select: {
      cardId: true,
      card: {
        select: {
          baseCardId: true,
        },
      },
    },
  });

  const exact = new Set<number>();
  const bases = new Set<number>();

  for (const item of collectionCards) {
    exact.add(item.cardId);
    bases.add(item.card.baseCardId ?? item.cardId);
  }

  return { exact, bases };
}

type RawLinkedCard = {
  id: number;
  code: string;
  name: string;
  src: string;
  category: string;
  setCode: string;
  region: string | null;
  rarity: string | null;
  marketPrice: unknown;
  midPrice: unknown;
  baseCardId: number | null;
  alternateArt: string | null;
  relationTypes: string[];
  sources: string[];
};

function dedupeCardsByMode(cards: RawLinkedCard[], variantMode: VariantMode) {
  if (variantMode === "all") {
    return cards;
  }

  const byBase = new Map<number, RawLinkedCard>();

  for (const card of cards) {
    const baseKey = card.baseCardId ?? card.id;
    const existing = byBase.get(baseKey);

    if (!existing) {
      byBase.set(baseKey, card);
      continue;
    }

    const mergedRelationTypes = Array.from(
      new Set([...existing.relationTypes, ...card.relationTypes])
    );
    const mergedSources = Array.from(
      new Set([...existing.sources, ...card.sources])
    );

    const preferred =
      existing.baseCardId === null
        ? existing
        : card.baseCardId === null
        ? card
        : existing;

    byBase.set(baseKey, {
      ...preferred,
      relationTypes: mergedRelationTypes,
      sources: mergedSources,
    });
  }

  return Array.from(byBase.values());
}

function computeOwned(
  card: { id: number; baseCardId: number | null },
  variantMode: VariantMode,
  ownedIndex: { exact: Set<number>; bases: Set<number> }
) {
  if (variantMode === "all") {
    return ownedIndex.exact.has(card.id);
  }

  return ownedIndex.bases.has(card.baseCardId ?? card.id);
}

function buildRawLinkedCards(links: any[], region: RegionMode) {
  const grouped = new Map<number, RawLinkedCard>();

  for (const link of links) {
    const card = link.card;
    if (!card) continue;
    if (region !== "all" && card.region !== region) continue;

    const existing = grouped.get(card.id);
    if (!existing) {
      grouped.set(card.id, {
        id: card.id,
        code: card.code,
        name: card.name,
        src: card.src,
        category: card.category,
        setCode: card.setCode,
        region: card.region,
        rarity: card.rarity,
        marketPrice: card.marketPrice,
        midPrice: card.midPrice,
        baseCardId: card.baseCardId,
        alternateArt: card.alternateArt,
        relationTypes: [link.relationType],
        sources: [link.source],
      });
      continue;
    }

    existing.relationTypes = Array.from(
      new Set([...existing.relationTypes, link.relationType])
    );
    existing.sources = Array.from(new Set([...existing.sources, link.source]));
  }

  return Array.from(grouped.values());
}

function applyCardFilters(
  cards: RawLinkedCard[],
  filters: {
    relationType?: RelationFilterMode;
    source?: SourceFilterMode;
    setCode?: SetFilterMode;
  }
) {
  return cards.filter((card) => {
    if (
      filters.relationType &&
      filters.relationType !== "all" &&
      !card.relationTypes.includes(filters.relationType)
    ) {
      return false;
    }

    if (
      filters.source &&
      filters.source !== "all" &&
      !card.sources.includes(filters.source)
    ) {
      return false;
    }

    if (
      filters.setCode &&
      filters.setCode !== "all" &&
      card.setCode !== filters.setCode
    ) {
      return false;
    }

    return true;
  });
}

function buildCharacterSearchWhere(search?: string) {
  return {
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
            { aliases: { has: search } },
          ],
        }
      : {}),
  };
}

async function getCharacterRecords(search?: string) {
  const characterEntityClient = (prisma as any).characterEntity;

  return characterEntityClient.findMany({
    where: buildCharacterSearchWhere(search),
    orderBy: { name: "asc" },
    include: {
      links: {
        include: {
          card: {
            select: {
              id: true,
              code: true,
              name: true,
              src: true,
              category: true,
              setCode: true,
              region: true,
              rarity: true,
              marketPrice: true,
              midPrice: true,
              baseCardId: true,
              alternateArt: true,
            },
          },
        },
      },
    },
  });
}

async function getCharacterRecordsPage(options: {
  search?: string;
  cursor?: number | null;
  take: number;
}) {
  const characterEntityClient = (prisma as any).characterEntity;

  return characterEntityClient.findMany({
    where: buildCharacterSearchWhere(options.search),
    orderBy: [{ id: "asc" }],
    take: options.take,
    ...(options.cursor
      ? {
          skip: 1,
          cursor: { id: options.cursor },
        }
      : {}),
    include: {
      links: {
        include: {
          card: {
            select: {
              id: true,
              code: true,
              name: true,
              src: true,
              category: true,
              setCode: true,
              region: true,
              rarity: true,
              marketPrice: true,
              midPrice: true,
              baseCardId: true,
              alternateArt: true,
            },
          },
        },
      },
    },
  });
}

const getCachedMasterSetBrowseOptions = unstable_cache(
  async (): Promise<MasterSetBrowseOptions> => {
  const rows = await prisma.cardCharacterLink.findMany({
    select: {
      relationType: true,
      source: true,
      card: {
        select: {
          setCode: true,
        },
      },
    },
  });

  const setCodes = new Set<string>();
  const relationTypes = new Set<string>();
  const sources = new Set<string>();

  for (const row of rows) {
    if (row.card?.setCode) {
      setCodes.add(row.card.setCode);
    }
    if (row.relationType) {
      relationTypes.add(row.relationType);
    }
    if (row.source) {
      sources.add(row.source);
    }
  }

  return {
    setCodes: Array.from(setCodes).sort((a, b) => a.localeCompare(b)),
    relationTypes: Array.from(relationTypes).sort((a, b) => a.localeCompare(b)),
    sources: Array.from(sources).sort((a, b) => a.localeCompare(b)),
  };
  },
  ["master-set-browse-options"],
  {
    revalidate: 60 * 60,
  }
);

export async function getMasterSetBrowseOptions(): Promise<MasterSetBrowseOptions> {
  return getCachedMasterSetBrowseOptions();
}

export async function getMasterSetSummaries(options?: {
  userId?: number | null;
  search?: string;
  variantMode?: VariantMode;
  region?: RegionMode;
  relationType?: RelationFilterMode;
  source?: SourceFilterMode;
  setCode?: SetFilterMode;
}) {
  const variantMode = options?.variantMode ?? "base";
  const region = options?.region ?? "all";
  const ownedIndex = await getOwnedCardIndex(options?.userId);
  const characters = await getCharacterRecords(options?.search);

  const summaries: MasterSetSummary[] = characters.map((character: any) => {
    const rawCards = buildRawLinkedCards(character.links, region);
    const filteredCards = applyCardFilters(rawCards, {
      relationType: options?.relationType,
      source: options?.source,
      setCode: options?.setCode,
    });
    const cards = dedupeCardsByMode(filteredCards, variantMode);

    const ownedCards = cards.filter((card) =>
      computeOwned(card, variantMode, ownedIndex)
    ).length;
    const totalCards = cards.length;
    const missingCards = Math.max(0, totalCards - ownedCards);
    const completionPercent =
      totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;
    const totalMarketValue = cards.reduce(
      (sum, card) => sum + (toNumber(card.marketPrice) ?? 0),
      0
    );
    const averageMarketPrice =
      totalCards > 0 ? totalMarketValue / totalCards : 0;
    const totalMidValue = cards.reduce(
      (sum, card) => sum + (toNumber(card.midPrice) ?? 0),
      0
    );
    const averageMidPrice = totalCards > 0 ? totalMidValue / totalCards : 0;

    return {
      id: character.id,
      slug: character.slug,
      name: character.name,
      description: character.description,
      aliases: character.aliases,
      totalCards,
      ownedCards,
      missingCards,
      completionPercent,
      totalMarketValue,
      averageMarketPrice,
      totalMidValue,
      averageMidPrice,
      relationTypes: Array.from(
        new Set(cards.flatMap((card) => card.relationTypes))
      ),
      sources: Array.from(new Set(cards.flatMap((card) => card.sources))),
      setCodes: Array.from(
        new Set(cards.map((card) => card.setCode).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    };
  });

  return summaries.filter((summary) => summary.totalCards > 0);
}

export async function getMasterSetSummariesPage(options?: {
  userId?: number | null;
  search?: string;
  variantMode?: VariantMode;
  region?: RegionMode;
  relationType?: RelationFilterMode;
  source?: SourceFilterMode;
  setCode?: SetFilterMode;
  cursor?: number | null;
  limit?: number;
}): Promise<MasterSetSummariesPage> {
  const variantMode = options?.variantMode ?? "base";
  const region = options?.region ?? "all";
  const limit = Math.max(1, Math.min(options?.limit ?? 24, 60));
  const items: MasterSetSummary[] = [];
  let cursor = options?.cursor ?? null;
  let nextCursor: number | null = null;
  let exhausted = false;

  while (items.length < limit && !exhausted) {
    const characters = await getCharacterRecordsPage({
      search: options?.search,
      cursor,
      take: limit + 1,
    });

    const hasMore = characters.length > limit;
    const pageCharacters = hasMore ? characters.slice(0, limit) : characters;
    nextCursor = hasMore
      ? (pageCharacters[pageCharacters.length - 1]?.id ?? null)
      : null;
    exhausted = !hasMore;
    cursor = nextCursor;

    if (pageCharacters.length === 0) {
      break;
    }

    const prepared: Array<{ character: any; cards: RawLinkedCard[] }> =
      pageCharacters.map((character: any) => {
      const rawCards = buildRawLinkedCards(character.links, region);
      const filteredCards = applyCardFilters(rawCards, {
        relationType: options?.relationType,
        source: options?.source,
        setCode: options?.setCode,
      });
      const cards = dedupeCardsByMode(filteredCards, variantMode);

      return {
        character,
        cards,
      };
    });

    const scopedOwnedIndex = await getOwnedCardIndexForCards(
      options?.userId,
      prepared.flatMap((item) =>
        item.cards.map((card) => ({
          id: card.id,
          baseCardId: card.baseCardId,
        }))
      ),
      variantMode
    );

    for (const { character, cards } of prepared) {
      const totalCards = cards.length;
      if (totalCards === 0) continue;

      const ownedCards = cards.filter((card) =>
        computeOwned(card, variantMode, scopedOwnedIndex)
      ).length;
      const missingCards = Math.max(0, totalCards - ownedCards);
      const completionPercent =
        totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;
      const totalMarketValue = cards.reduce(
        (sum, card) => sum + (toNumber(card.marketPrice) ?? 0),
        0
      );
      const averageMarketPrice =
        totalCards > 0 ? totalMarketValue / totalCards : 0;
      const totalMidValue = cards.reduce(
        (sum, card) => sum + (toNumber(card.midPrice) ?? 0),
        0
      );
      const averageMidPrice = totalCards > 0 ? totalMidValue / totalCards : 0;

      items.push({
        id: character.id,
        slug: character.slug,
        name: character.name,
        description: character.description,
        aliases: Array.isArray(character.aliases) ? character.aliases : [],
        totalCards,
        ownedCards,
        missingCards,
        completionPercent,
        totalMarketValue,
        averageMarketPrice,
        totalMidValue,
        averageMidPrice,
        relationTypes: Array.from(
          new Set(cards.flatMap((card) => card.relationTypes))
        ),
        sources: Array.from(new Set(cards.flatMap((card) => card.sources))),
        setCodes: Array.from(
          new Set(
            cards
              .map((card) => card.setCode)
              .filter((value): value is string => Boolean(value))
          )
        ).sort((a, b) => a.localeCompare(b)),
      });

      if (items.length >= limit) {
        break;
      }
    }
  }

  return {
    items: items.slice(0, limit),
    nextCursor,
  };
}

export async function getMasterSetDetail(
  slug: string,
  options?: {
    userId?: number | null;
    variantMode?: VariantMode;
    region?: RegionMode;
    relationType?: RelationFilterMode;
    source?: SourceFilterMode;
    setCode?: SetFilterMode;
  }
): Promise<MasterSetDetail | null> {
  const variantMode = options?.variantMode ?? "base";
  const region = options?.region ?? "all";
  const characterEntityClient = (prisma as any).characterEntity;

  const character = await characterEntityClient.findUnique({
    where: { slug },
    include: {
      links: {
        include: {
          card: {
            select: {
              id: true,
              code: true,
              name: true,
              src: true,
              category: true,
              setCode: true,
              region: true,
              rarity: true,
              marketPrice: true,
              midPrice: true,
              baseCardId: true,
              alternateArt: true,
            },
          },
        },
      },
    },
  });

  if (!character) {
    return null;
  }

  const rawCards = buildRawLinkedCards(character.links, region);
  const availableSetCodes = Array.from(
    new Set(rawCards.map((card) => card.setCode).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const availableRelationTypes = Array.from(
    new Set(rawCards.flatMap((card) => card.relationTypes))
  ).sort((a, b) => a.localeCompare(b));
  const availableSources = Array.from(
    new Set(rawCards.flatMap((card) => card.sources))
  ).sort((a, b) => a.localeCompare(b));

  const filteredCards = applyCardFilters(rawCards, {
    relationType: options?.relationType,
    source: options?.source,
    setCode: options?.setCode,
  });

  const cards = dedupeCardsByMode(filteredCards, variantMode)
    .map((card) => ({
      id: card.id,
      code: card.code,
      name: card.name,
      src: card.src,
      category: card.category,
      setCode: card.setCode,
      region: card.region,
      rarity: card.rarity,
      marketPrice: toNumber(card.marketPrice),
      midPrice: toNumber(card.midPrice),
      baseCardId: card.baseCardId,
      owned: false,
      relationTypes: card.relationTypes,
      sources: card.sources,
      alternateArt: card.alternateArt,
      variantCategory: classifyCardVariantCategory(card.alternateArt),
    }))
    .sort((left, right) => left.code.localeCompare(right.code));

  const ownedIndex = await getOwnedCardIndexForCards(
    options?.userId,
    cards.map((card) => ({
      id: card.id,
      baseCardId: card.baseCardId,
    })),
    variantMode
  );

  for (const card of cards) {
    card.owned = computeOwned(card, variantMode, ownedIndex);
  }

  const ownedCards = cards.filter((card) => card.owned).length;
  const totalCards = cards.length;
  const missingCards = Math.max(0, totalCards - ownedCards);
  const completionPercent =
    totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;
  const totalMarketValue = cards.reduce(
    (sum, card) => sum + (card.marketPrice ?? 0),
    0
  );
  const averageMarketPrice =
    totalCards > 0 ? totalMarketValue / totalCards : 0;
  const totalMidValue = cards.reduce(
    (sum, card) => sum + (card.midPrice ?? 0),
    0
  );
  const averageMidPrice = totalCards > 0 ? totalMidValue / totalCards : 0;

  return {
    character: {
      id: character.id,
      slug: character.slug,
      name: character.name,
      description: character.description,
      aliases: character.aliases,
    },
    totalCards,
    ownedCards,
    missingCards,
    completionPercent,
    totalMarketValue,
    averageMarketPrice,
    totalMidValue,
    averageMidPrice,
    cards,
    availableSetCodes,
    availableRelationTypes,
    availableSources,
  };
}

export function getMasterSetRelationTypeLabel(value: string) {
  return relationTypeLabel(value);
}

export function getMasterSetSourceLabel(value: string) {
  return sourceLabel(value);
}

export function getMasterSetVariantLabel(category: MasterSetVariantCategory) {
  return variantLabel(category);
}
