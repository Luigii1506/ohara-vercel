import type { Prisma, Card } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  CardsFilters,
  CardsPage,
  FetchAllCardsOptions,
  FetchCardsPageOptions,
} from "./types";
import type { CardWithCollectionData } from "@/types";

type AlternateRelation = {
  id: number;
  type?: string;
  color?: string;
  effect?: string;
  condition?: string;
  text?: string;
};

type AlternateWithRelations = {
  id: number;
  src: string | null;
  code: string;
  alias: string | null;
  order: string | null;
  alternateArt: string | null;
  isFirstEdition: boolean;
  tcgUrl: string | null;
  tcgplayerProductId?: string | null;
  tcgplayerLinkStatus?: boolean | null;
  marketPrice?: any;
  lowPrice?: any;
  highPrice?: any;
  priceCurrency?: string | null;
  priceUpdatedAt?: Date | null;
  isPro: boolean;
  region: string | null;
  setCode: string;
  baseCardId: number | null;
  types?: AlternateRelation[];
  colors?: AlternateRelation[];
  effects?: AlternateRelation[];
  texts?: AlternateRelation[];
  sets?: {
    set: {
      id: number;
      title: string;
      code?: string | null;
    };
  }[];
};

export type BaseCardWithRelations = Card & {
  alternates: AlternateWithRelations[];
  numOfVariations?: number;
  types?: AlternateRelation[];
  colors?: AlternateRelation[];
  effects?: AlternateRelation[];
  conditions?: AlternateRelation[];
  texts?: AlternateRelation[];
  sets?: {
    set: {
      id: number;
      title: string;
      code?: string | null;
    };
  }[];
  rulings?: {
    id: number;
    question: string;
    answer: string;
  }[];
};

const prefixIndexCache: Record<string, number> = {};

function getPrefixIndex(code: string): number {
  if (prefixIndexCache[code]) return prefixIndexCache[code];

  let index = 4;
  if (code.startsWith("OP")) index = 0;
  else if (code.startsWith("EB")) index = 1;
  else if (code.startsWith("ST")) index = 2;
  else if (code.startsWith("P")) index = 3;

  prefixIndexCache[code] = index;
  return index;
}

function getAliasNumber(value: string | null): number {
  if (!value) return 0;
  const match = value.trim().match(/^\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const splitParam = (value: string | null | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const VALID_SORT_VALUES = [
  "price_high",
  "price_low",
  "code_asc",
  "code_desc",
  "name_asc",
  "name_desc",
  "collection",
] as const;

export const buildFiltersFromSearchParams = (
  params: URLSearchParams
): CardsFilters => {
  const sortByParam = params.get("sortBy");
  const sortBy = VALID_SORT_VALUES.includes(sortByParam as any)
    ? (sortByParam as CardsFilters["sortBy"])
    : undefined;

  return {
    search: params.get("search") ?? undefined,
    sets: splitParam(params.get("sets")),
    setCodes: splitParam(params.get("codes")),
    colors: splitParam(params.get("colors")),
    rarities: splitParam(params.get("rarities")),
    categories: splitParam(params.get("categories")),
    excludeCategories: splitParam(params.get("excludeCategories")),
    costs: splitParam(params.get("costs")),
    power: splitParam(params.get("power")),
    attributes: splitParam(params.get("attributes")),
    types: splitParam(params.get("types")),
    effects: splitParam(params.get("effects")),
    altArts: splitParam(params.get("altArts")),
    region: params.get("region") ?? undefined,
    counter: params.get("counter") ?? undefined,
    trigger: params.get("trigger") ?? undefined,
    sortBy,
  };
};

const buildInsensitiveListCondition = (
  values: string[],
  build: (value: string) => Prisma.CardWhereInput
): Prisma.CardWhereInput => {
  if (values.length === 1) {
    return build(values[0]);
  }
  return {
    OR: values.map((value) => build(value)),
  };
};

const buildWhere = (
  filters: CardsFilters,
  includeAlternates: boolean = false
): Prisma.CardWhereInput => {
  const where: Prisma.CardWhereInput = {
    // Solo filtrar por baseCardId: null si NO incluimos alternativas
    ...(includeAlternates ? {} : { baseCardId: null }),
    AND: [],
  };

  const andConditions = where.AND as Prisma.CardWhereInput[];

  const withAlternates = (
    baseCondition: Prisma.CardWhereInput,
    alternateCondition?: Prisma.CardWhereInput
  ): Prisma.CardWhereInput => ({
    OR: [
      baseCondition,
      {
        alternateCards: {
          some: alternateCondition ?? baseCondition,
        },
      },
    ],
  });

  const buildSearchCondition = (search: string): Prisma.CardWhereInput => ({
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { alias: { contains: search, mode: "insensitive" } },
      {
        effects: {
          some: { effect: { contains: search, mode: "insensitive" } },
        },
      },
      {
        texts: {
          some: { text: { contains: search, mode: "insensitive" } },
        },
      },
      {
        sets: {
          some: {
            set: { title: { contains: search, mode: "insensitive" } },
          },
        },
      },
    ],
  });

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      andConditions.push({
        OR: [
          buildSearchCondition(search),
          {
            alternateCards: {
              some: buildSearchCondition(search),
            },
          },
        ],
      });
    }
  }

  if (filters.sets?.length) {
    andConditions.push({
      OR: [
        { setCode: { in: filters.sets } },
        {
          sets: {
            some: { set: { code: { in: filters.sets } } },
          },
        },
        {
          alternateCards: {
            some: {
              OR: [
                { setCode: { in: filters.sets } },
                {
                  sets: {
                    some: { set: { code: { in: filters.sets } } },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.setCodes?.length) {
    andConditions.push({
      OR: filters.setCodes.map((code) => ({
        OR: [
          { code: { contains: code, mode: "insensitive" } },
          {
            alternateCards: {
              some: { code: { contains: code, mode: "insensitive" } },
            },
          },
        ],
      })),
    });
  }

  if (filters.colors?.length) {
    andConditions.push(
      withAlternates(
        buildInsensitiveListCondition(filters.colors, (value) => ({
          colors: {
            some: { color: { equals: value, mode: "insensitive" } },
          },
        }))
      )
    );
  }

  if (filters.rarities?.length) {
    andConditions.push(
      withAlternates(
        buildInsensitiveListCondition(filters.rarities, (value) => ({
          rarity: { equals: value, mode: "insensitive" },
        }))
      )
    );
  }

  if (filters.categories?.length) {
    andConditions.push(
      withAlternates(
        buildInsensitiveListCondition(filters.categories, (value) => ({
          category: { equals: value, mode: "insensitive" },
        }))
      )
    );
  }

  if (filters.costs?.length) {
    andConditions.push(
      withAlternates({
        cost: { in: filters.costs },
      })
    );
  }

  if (filters.power?.length) {
    andConditions.push(
      withAlternates({
        power: { in: filters.power },
      })
    );
  }

  if (filters.attributes?.length) {
    andConditions.push(
      withAlternates({
        attribute: { in: filters.attributes },
      })
    );
  }

  if (filters.types?.length) {
    andConditions.push(
      withAlternates({
        types: { some: { type: { in: filters.types } } },
      })
    );
  }

  if (filters.effects?.length) {
    andConditions.push(
      withAlternates({
        effects: { some: { effect: { in: filters.effects } } },
      })
    );
  }

  if (filters.altArts?.length) {
    andConditions.push(
      withAlternates(
        buildInsensitiveListCondition(filters.altArts, (value) => ({
          alternateArt: { equals: value, mode: "insensitive" },
        }))
      )
    );
  }

  if (filters.region) {
    andConditions.push(
      withAlternates({
        region: filters.region,
      })
    );
  }

  if (filters.counter) {
    if (filters.counter === "No counter") {
      andConditions.push(
        withAlternates({
          counter: null,
        })
      );
    } else {
      andConditions.push(
        withAlternates({
          counter: { contains: filters.counter },
        })
      );
    }
  }

  if (filters.trigger) {
    if (filters.trigger === "No trigger") {
      andConditions.push(
        withAlternates({
          triggerCard: null,
        })
      );
    } else {
      andConditions.push(
        withAlternates({
          triggerCard: filters.trigger,
        })
      );
    }
  }

  // Exclude categories (e.g., DON cards)
  if (filters.excludeCategories?.length) {
    andConditions.push({
      NOT: {
        category: { in: filters.excludeCategories },
      },
    });
  }

  if (Array.isArray(where.AND) && where.AND.length === 0) {
    delete where.AND;
  }

  return where;
};

const buildInclude = (
  includeRelations: boolean,
  includeAlternates: boolean
): Prisma.CardInclude | undefined => {
  const include: Prisma.CardInclude = {};

  if (includeRelations) {
    include.types = { select: { id: true, type: true } };
    include.colors = { select: { id: true, color: true } };
    include.effects = { select: { id: true, effect: true } };
    include.conditions = { select: { id: true, condition: true } };
    include.texts = { select: { id: true, text: true } };
    include.sets = {
      select: {
        set: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
      },
    };
    include.rulings = {
      select: {
        id: true,
        question: true,
        answer: true,
      },
    };
  }

  if (includeAlternates) {
    include.alternateCards = {
      orderBy: { order: "asc" },
      select: {
        id: true,
        src: true,
        code: true,
        alias: true,
        order: true,
        alternateArt: true,
        isFirstEdition: true,
        tcgUrl: true,
        tcgplayerProductId: true,
        tcgplayerLinkStatus: true,
        marketPrice: true,
        lowPrice: true,
        highPrice: true,
        priceCurrency: true,
        priceUpdatedAt: true,
        isPro: true,
        region: true,
        setCode: true,
        baseCardId: true,
        ...(includeRelations && {
          types: { select: { id: true, type: true } },
          colors: { select: { id: true, color: true } },
          effects: { select: { id: true, effect: true } },
          texts: { select: { id: true, text: true } },
          sets: {
            select: {
              set: {
                select: {
                  id: true,
                  title: true,
                  code: true,
                },
              },
            },
          },
        }),
      },
    };
  }

  return Object.keys(include).length ? include : undefined;
};

const normalizeAlternates = (
  alternates: AlternateWithRelations[] | undefined
) => {
  if (!alternates?.length) return [];

  const mapped = alternates.map((alternate) => ({
    ...alternate,
    order: alternate.order ?? "0",
  }));

  return mapped.sort((a, b) => {
    const numA = getAliasNumber(a.order);
    const numB = getAliasNumber(b.order);
    if (numA !== numB) return numA - numB;
    return a.order.localeCompare(b.order);
  });
};

export const mapCard = (
  card: Card & { alternateCards?: AlternateWithRelations[] },
  includeAlternates: boolean,
  includeCounts: boolean
): BaseCardWithRelations => {
  const { alternateCards, ...rest } = card;

  const alternates = includeAlternates
    ? normalizeAlternates(alternateCards)
    : [];

  const mapped: BaseCardWithRelations = {
    ...rest,
    alternates,
  };

  if (includeCounts) {
    mapped.numOfVariations = alternates.length;
  }

  return mapped;
};

// Función especial para ordenamiento por precio (incluye base + alternativas)
// Muestra TODAS las cartas (base y alternativas) como items individuales, ordenadas por precio
const fetchCardsPageByPrice = async (
  options: FetchCardsPageOptions
): Promise<CardsPage> => {
  const {
    filters,
    limit,
    cursor = null,
    includeRelations = false,
    includeAlternates = true,
  } = options;

  // Construir where INCLUYENDO alternativas
  const priceWhere = buildWhere(filters, true);
  const take = Math.min(Math.max(limit, 1), 200);
  const isHighToLow = filters.sortBy === "price_high";

  // Ordenar por precio directamente en la consulta
  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];
  if (isHighToLow) {
    orderBy.push({ marketPrice: { sort: "desc", nulls: "last" } });
  } else {
    orderBy.push({ marketPrice: { sort: "asc", nulls: "last" } });
  }
  orderBy.push({ id: "asc" }); // Desempate por ID

  const args: Prisma.CardFindManyArgs = {
    where: priceWhere,
    orderBy,
    include: {
      ...(includeRelations && {
        types: { select: { id: true, type: true } },
        colors: { select: { id: true, color: true } },
        effects: { select: { id: true, effect: true } },
        conditions: { select: { id: true, condition: true } },
        texts: { select: { id: true, text: true } },
        sets: {
          select: {
            set: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },
          },
        },
        rulings: {
          select: {
            id: true,
            question: true,
            answer: true,
          },
        },
      }),
      // Incluir la referencia a la carta base para alternativas
      baseCard: includeAlternates
        ? {
            select: {
              id: true,
              name: true,
              code: true,
              src: true,
              category: true,
              rarity: true,
              marketPrice: true,
              lowPrice: true,
              highPrice: true,
              priceCurrency: true,
              tcgUrl: true,
              tcgplayerProductId: true,
              tcgplayerLinkStatus: true,
            },
          }
        : false,
    },
  };

  if (take) {
    args.take = take + 1;
  }

  if (cursor) {
    args.cursor = { id: cursor };
    args.skip = 1;
  }

  const [allCards, totalCount] = await Promise.all([
    prisma.card.findMany(args),
    prisma.card.count({ where: priceWhere }),
  ]);

  const hasMore = allCards.length > take;
  const trimmed = hasMore ? allCards.slice(0, take) : allCards;

  // Mapear las cartas - cada carta es independiente (base o alternativa)
  const mapped = trimmed.map((card) => ({
    ...card,
    alternates: [], // Sin alternativas anidadas en modo precio
    numOfVariations: 0,
  })) as unknown as CardWithCollectionData[];

  const nextCursor =
    hasMore && trimmed.length ? trimmed[trimmed.length - 1].id : null;

  return {
    items: mapped,
    nextCursor,
    hasMore,
    totalCount,
  };
};

export const fetchCardsPageFromDb = async (
  options: FetchCardsPageOptions
): Promise<CardsPage> => {
  const {
    filters,
    limit,
    cursor = null,
    includeRelations = false,
    includeAlternates = true,
    includeCounts = false,
  } = options;

  const isPriceSorting = filters.sortBy === "price_high" || filters.sortBy === "price_low";

  // Para ordenamiento por precio, necesitamos traer base + alternativas juntas
  if (isPriceSorting) {
    return fetchCardsPageByPrice(options);
  }

  // Ordenamiento normal (solo cartas base)
  const where = buildWhere(filters);
  const include = buildInclude(includeRelations, includeAlternates);

  const take = Math.min(Math.max(limit, 1), 200);

  // Build orderBy based on sortBy filter
  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];

  switch (filters.sortBy) {
    case "code_asc":
      orderBy.push({ code: "asc" }, { id: "asc" });
      break;
    case "code_desc":
      orderBy.push({ code: "desc" }, { id: "desc" });
      break;
    case "name_asc":
      orderBy.push({ name: "asc" }, { id: "asc" });
      break;
    case "name_desc":
      orderBy.push({ name: "desc" }, { id: "desc" });
      break;
    case "collection":
    default:
      // Default: collection order
      orderBy.push(
        { collectionOrder: "asc" },
        { code: "asc" },
        { id: "asc" }
      );
      break;
  }

  const args: Prisma.CardFindManyArgs = {
    where,
    orderBy,
    include,
  };

  if (take) {
    args.take = take + 1;
  }

  if (cursor) {
    args.cursor = { id: cursor };
    args.skip = 1;
  }

  const [cards, totalCount] = await Promise.all([
    prisma.card.findMany(args),
    prisma.card.count({ where }),
  ]);

  const hasMore = cards.length > take;
  const trimmed = hasMore ? cards.slice(0, take) : cards;
  const mapped = trimmed.map((card) =>
    mapCard(card, includeAlternates, includeCounts)
  );

  const nextCursor =
    hasMore && trimmed.length ? trimmed[trimmed.length - 1].id : null;

  return {
    items: mapped as unknown as CardWithCollectionData[],
    nextCursor,
    hasMore,
    totalCount,
  };
};

export const fetchAllCardsFromDb = async (
  options: FetchAllCardsOptions
): Promise<CardWithCollectionData[]> => {
  const {
    filters,
    includeRelations = false,
    includeAlternates = true,
    includeCounts = false,
    limit = null,
  } = options;

  const where = buildWhere(filters);
  const include = buildInclude(includeRelations, includeAlternates);

  const args: Prisma.CardFindManyArgs = {
    where,
    orderBy: [
      { collectionOrder: "asc" },
      { code: "asc" },
      { id: "asc" },
    ],
    include,
  };

  if (limit && Number.isFinite(limit)) {
    args.take = Math.min(Math.max(limit, 1), 5000);
  }

  const cards = await prisma.card.findMany(args);

  const mapped = cards.map((card) =>
    mapCard(card, includeAlternates, includeCounts)
  );

  return mapped as unknown as CardWithCollectionData[];
};

// Build WHERE conditions for direct matching (without the "withAlternates" OR logic)
// Used for counting individual cards that match filters
const buildDirectWhere = (filters: CardsFilters): Prisma.CardWhereInput => {
  const where: Prisma.CardWhereInput = {
    AND: [],
  };

  const andConditions = where.AND as Prisma.CardWhereInput[];

  const buildSearchCondition = (search: string): Prisma.CardWhereInput => ({
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { alias: { contains: search, mode: "insensitive" } },
      {
        effects: {
          some: { effect: { contains: search, mode: "insensitive" } },
        },
      },
      {
        texts: {
          some: { text: { contains: search, mode: "insensitive" } },
        },
      },
      {
        sets: {
          some: {
            set: { title: { contains: search, mode: "insensitive" } },
          },
        },
      },
    ],
  });

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      andConditions.push(buildSearchCondition(search));
    }
  }

  if (filters.sets?.length) {
    andConditions.push({
      OR: [
        { setCode: { in: filters.sets } },
        {
          sets: {
            some: { set: { code: { in: filters.sets } } },
          },
        },
      ],
    });
  }

  if (filters.setCodes?.length) {
    andConditions.push({
      OR: filters.setCodes.map((code) => ({
        code: { contains: code, mode: "insensitive" as const },
      })),
    });
  }

  if (filters.colors?.length) {
    andConditions.push({
      OR: filters.colors.map((value) => ({
        colors: {
          some: { color: { equals: value, mode: "insensitive" as const } },
        },
      })),
    });
  }

  if (filters.rarities?.length) {
    andConditions.push({
      OR: filters.rarities.map((value) => ({
        rarity: { equals: value, mode: "insensitive" as const },
      })),
    });
  }

  if (filters.categories?.length) {
    andConditions.push({
      OR: filters.categories.map((value) => ({
        category: { equals: value, mode: "insensitive" as const },
      })),
    });
  }

  if (filters.costs?.length) {
    andConditions.push({ cost: { in: filters.costs } });
  }

  if (filters.power?.length) {
    andConditions.push({ power: { in: filters.power } });
  }

  if (filters.attributes?.length) {
    andConditions.push({ attribute: { in: filters.attributes } });
  }

  if (filters.types?.length) {
    andConditions.push({
      types: { some: { type: { in: filters.types } } },
    });
  }

  if (filters.effects?.length) {
    andConditions.push({
      effects: { some: { effect: { in: filters.effects } } },
    });
  }

  if (filters.altArts?.length) {
    andConditions.push({
      OR: filters.altArts.map((value) => ({
        alternateArt: { equals: value, mode: "insensitive" as const },
      })),
    });
  }

  if (filters.region) {
    andConditions.push({ region: filters.region });
  }

  if (filters.counter) {
    if (filters.counter === "No counter") {
      andConditions.push({ counter: null });
    } else {
      andConditions.push({ counter: { contains: filters.counter } });
    }
  }

  if (filters.trigger) {
    if (filters.trigger === "No trigger") {
      andConditions.push({ triggerCard: null });
    } else {
      andConditions.push({ triggerCard: filters.trigger });
    }
  }

  // Exclude categories (e.g., DON cards)
  if (filters.excludeCategories?.length) {
    andConditions.push({
      NOT: {
        category: { in: filters.excludeCategories },
      },
    });
  }

  if (Array.isArray(where.AND) && where.AND.length === 0) {
    delete where.AND;
  }

  return where;
};

export const countCardsByFilters = async (
  filters: CardsFilters
): Promise<number> => {
  // Count cards that directly match the filters (both base and alternates individually)
  // This avoids the "withAlternates" OR pattern that counts base cards when only alternates match
  const directWhere = buildDirectWhere(filters);

  return prisma.card.count({ where: directWhere });
};
