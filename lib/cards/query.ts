import type { Prisma, Card } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  CardsFilters,
  CardsPage,
  FetchAllCardsOptions,
  FetchCardsPageOptions,
} from "./types";
import type { CardWithCollectionData } from "@/types";
import { DEFAULT_REGION } from "@/lib/regions";
import { parseSearchTokens } from "./searchTokens";
import {
  resolveSearchSetMatch,
  shouldForceEmptyForUnresolvedSetSearch,
} from "./setSearch";

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
  name: string;
  code: string;
  alias: string | null;
  order: string | null;
  alternateArt: string | null;
  rarity: string | null;
  illustrator: string | null;
  attribute: string | null;
  cost: string | null;
  power: string | null;
  triggerCard: string | null;
  isFirstEdition: boolean;
  tcgUrl: string | null;
  tcgplayerProductId?: string | null;
  tcgplayerLinkStatus?: boolean | null;
  marketPrice?: any;
  midPrice?: any;
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

const normalizeSetCodesParam = (value: string | null | undefined) =>
  splitParam(value).map((code) =>
    code.toUpperCase() === "PROMO" ? "P-" : code
  );

const normalizeRegion = (value?: string | null): string =>
  value && value.trim() ? value.trim() : DEFAULT_REGION;

const buildRegionScopeCondition = (region: string): Prisma.CardWhereInput => {
  if (region === DEFAULT_REGION) {
    return {
      OR: [{ region }, { region: null }, { region: "" }],
    };
  }
  return { region };
};

const buildBaseRegionCondition = (region: string): Prisma.CardWhereInput => {
  if (region === DEFAULT_REGION) {
    return {
      OR: [{ region }, { region: null }, { region: "" }],
    };
  }
  return { region };
};

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
    setCodes: normalizeSetCodesParam(params.get("codes")),
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
    region: normalizeRegion(params.get("region")),
    counter: params.get("counter") ?? undefined,
    trigger: params.get("trigger") ?? undefined,
    regulationMarks: splitParam(params.get("blocks"))
      ?.map((v) => parseInt(v, 10))
      .filter((n) => !Number.isNaN(n)),
    standardLegal: params.get("standardLegal") === "true" ? true : undefined,
    sortBy,
    baseOnly: params.get("baseOnly") === "true" ? true : undefined,
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

const buildContainsAllCondition = (
  values: string[],
  build: (value: string) => Prisma.CardWhereInput
): Prisma.CardWhereInput => {
  if (values.length === 1) {
    return build(values[0]);
  }
  return {
    AND: values.map((value) => build(value)),
  };
};

type SearchScope = "broad" | "name-first";

const hasStructuredSearchSignals = (parsed: ReturnType<typeof parseSearchTokens>) =>
  parsed.colors.length > 0 ||
  parsed.rarities.length > 0 ||
  parsed.categories.length > 0 ||
  parsed.altArts.length > 0 ||
  parsed.triggers.length > 0 ||
  parsed.costs.length > 0 ||
  parsed.powers.length > 0 ||
  parsed.codeTokens.length > 0 ||
  parsed.exactCodeTokens.length > 0 ||
  parsed.codeSuffixTokens.length > 0 ||
  parsed.illustratorTokens.length > 0;

const hasSpecificStructuredSearch = (filters: CardsFilters) => {
  if (!filters.search) return false;
  const parsed = parseSearchTokens(filters.search);
  return parsed.textTokens.length > 0 && hasStructuredSearchSignals(parsed);
};

const shouldSkipSearchTokenConditions = (filters: CardsFilters) =>
  Boolean(filters.searchSetIds?.length && filters.searchSetOnly);

const shouldIgnoreRegionForSearch = (filters: CardsFilters) =>
  Boolean(filters.skipRegionScope);

const buildTokenSearchCondition = (
  search: string,
  scope: SearchScope = "broad"
): Prisma.CardWhereInput => {
  const baseConditions: Prisma.CardWhereInput[] =
    scope === "name-first"
      ? [
          // Búsqueda compuesta (nombre + poder/color/…): el texto matchea SOLO
          // nombre y código, NO el título del set (si no, cartas en un set con
          // el término — ej. "EX Luffy & Ace" — colaban por "ace").
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ]
      : [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { rarity: { contains: search, mode: "insensitive" } },
          {
            sets: {
              some: {
                set: {
                  OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { code: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ];

  if (scope === "broad") {
    baseConditions.push({
      effects: {
        some: { effect: { contains: search, mode: "insensitive" } },
      },
    });
  }

  return { OR: baseConditions };
};

const buildExactPhraseSearchCondition = (
  phrase: string
): Prisma.CardWhereInput => ({
  OR: [
    { name: { contains: phrase, mode: "insensitive" } },
    {
      effects: {
        some: { effect: { contains: phrase, mode: "insensitive" } },
      },
    },
    {
      texts: {
        some: { text: { contains: phrase, mode: "insensitive" } },
      },
    },
  ],
});

const hasAltArtSearch = (filters: CardsFilters) => {
  if (filters.altArts?.length) return true;
  if (!filters.search) return false;
  const parsed = parseSearchTokens(filters.search);
  return parsed.altArts.length > 0 || parsed.illustratorTokens.length > 0;
};

const enrichFiltersWithResolvedSearchSet = async (filters: CardsFilters) => {
  const resolvedSearchSet = await resolveSearchSetMatch(filters.search);
  const forceEmpty =
    !resolvedSearchSet &&
    shouldForceEmptyForUnresolvedSetSearch(filters.search);

  const enrichedFilters = resolvedSearchSet?.ids?.length
    ? {
        ...filters,
        searchSetIds: resolvedSearchSet.ids,
        searchSetOnly: resolvedSearchSet.exclusive,
        searchSetAnyRegion: resolvedSearchSet.exclusive,
      }
    : filters;

  return {
    resolvedSearchSet,
    enrichedFilters,
    forceEmpty,
  };
};

const buildWhere = (
  filters: CardsFilters,
  includeAlternates: boolean = false
): Prisma.CardWhereInput => {
  const ignoreRegion = shouldIgnoreRegionForSearch(filters);
  const selectedRegion = normalizeRegion(filters.region);
  const alternateRegionCondition = ignoreRegion
    ? {}
    : buildRegionScopeCondition(selectedRegion);
  const where: Prisma.CardWhereInput = {
    // Solo filtrar por baseCardId: null si NO incluimos alternativas
    // o si el caller solicita solo cartas base.
    ...(includeAlternates ? {} : { baseCardId: null }),
    ...(filters.baseOnly ? { baseCardId: null } : {}),
    AND: [],
  };

  const andConditions = where.AND as Prisma.CardWhereInput[];

  if (!ignoreRegion) {
    andConditions.push(buildBaseRegionCondition(selectedRegion));
  }

  const withAlternates = (
    baseCondition: Prisma.CardWhereInput,
    alternateCondition?: Prisma.CardWhereInput
  ): Prisma.CardWhereInput => ({
    OR: [
      baseCondition,
      {
        alternateCards: {
          some: {
            AND: [alternateRegionCondition, alternateCondition ?? baseCondition],
          },
        },
      },
    ],
  });

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      const parsed = parseSearchTokens(search);
      if (!shouldSkipSearchTokenConditions(filters)) {
        const tokenSearchScope: SearchScope = hasStructuredSearchSignals(parsed)
          ? "name-first"
          : "broad";

        parsed.textTokens.forEach((token) => {
          andConditions.push({
            OR: [
              buildTokenSearchCondition(token, tokenSearchScope),
              {
                alternateCards: {
                  some: buildTokenSearchCondition(token, tokenSearchScope),
                },
              },
            ],
          });
        });

        parsed.exactPhrases.forEach((phrase) => {
          andConditions.push({
            OR: [
              buildExactPhraseSearchCondition(phrase),
              {
                alternateCards: {
                  some: buildExactPhraseSearchCondition(phrase),
                },
              },
            ],
          });
        });

        if (parsed.categories.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.categories, (value) => ({
                category: { equals: value, mode: "insensitive" },
              }))
            )
          );
        }

        if (parsed.rarities.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.rarities, (value) => ({
                rarity: { equals: value, mode: "insensitive" },
              }))
            )
          );
        }

        if (parsed.colors.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.colors, (value) => ({
                colors: {
                  some: { color: { equals: value, mode: "insensitive" } },
                },
              }))
            )
          );
        }

        if (parsed.costs.length > 0) {
          const costVariants = parsed.costs.flatMap((value) => [
            `${value} Cost`,
            value,
          ]);
          andConditions.push(
            withAlternates({
              OR: costVariants.map((value) => ({ cost: value })),
            })
          );
        }

        if (parsed.powers.length > 0) {
          const powerVariants = parsed.powers.flatMap((value) => [
            `${value} Power`,
            value,
          ]);
          andConditions.push(
            withAlternates({
              OR: powerVariants.map((value) => ({ power: value })),
            })
          );
        }

        if (parsed.altArts.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.altArts, (value) => ({
                alternateArt: { equals: value, mode: "insensitive" },
              }))
            )
          );
        }

        if (parsed.triggers.length > 0) {
          const normalizedTriggers = Array.from(new Set(parsed.triggers));
          normalizedTriggers.forEach((trigger) => {
            if (trigger === "No trigger") {
              andConditions.push(
                withAlternates({
                  triggerCard: null,
                })
              );
            } else {
              andConditions.push(
                withAlternates({
                  triggerCard: { contains: trigger },
                })
              );
            }
          });
        }

        if (parsed.codeTokens.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.codeTokens, (value) => ({
                code: parsed.exactCodeTokens.includes(value)
                  ? { equals: value, mode: "insensitive" }
                  : { contains: value, mode: "insensitive" },
              }))
            )
          );
        }

        if (parsed.codeSuffixTokens.length > 0) {
          andConditions.push(
            withAlternates(
              buildInsensitiveListCondition(parsed.codeSuffixTokens, (value) => ({
                code: { endsWith: value, mode: "insensitive" },
              }))
            )
          );
        }

        if (parsed.illustratorTokens.length > 0) {
          andConditions.push(
            withAlternates(
              buildContainsAllCondition(parsed.illustratorTokens, (value) => ({
                illustrator: { contains: value, mode: "insensitive" },
              }))
            )
          );
        }
      }
    }
  }

  if (filters.searchSetIds?.length) {
    andConditions.push({
      OR: [
        { sets: { some: { setId: { in: filters.searchSetIds } } } },
        {
          alternateCards: {
            some: {
              AND: [
                alternateRegionCondition,
                { sets: { some: { setId: { in: filters.searchSetIds } } } },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.sets?.length) {
    andConditions.push({
      OR: [
        { sets: { some: { set: { code: { in: filters.sets } } } } },
        {
          alternateCards: {
            some: {
              AND: [
                alternateRegionCondition,
                {
                  OR: [
                    { sets: { some: { set: { code: { in: filters.sets } } } } },
                  ],
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
              some: {
                AND: [
                  alternateRegionCondition,
                  { code: { contains: code, mode: "insensitive" } },
                ],
              },
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

  if (filters.regulationMarks?.length) {
    andConditions.push(
      withAlternates({
        regulationMark: { in: filters.regulationMarks },
      })
    );
  }

  if (filters.standardLegal) {
    andConditions.push(withAlternates({ standardLegal: true }));
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

  // Base cards only (exclude alternates)
  if (filters.baseOnly) {
    andConditions.push({
      baseCardId: null, // Base cards have null baseCardId
    });
  }

  if (Array.isArray(where.AND) && where.AND.length === 0) {
    delete where.AND;
  }

  return where;
};

const buildAlternateSelect = (includeRelations: boolean) => ({
  id: true,
  src: true,
  name: true,
  code: true,
  alias: true,
  order: true,
  alternateArt: true,
  disclaimer: true,
  rarity: true,
  illustrator: true,
  attribute: true,
  cost: true,
  power: true,
  triggerCard: true,
  isFirstEdition: true,
  tcgUrl: true,
  tcgplayerProductId: true,
  tcgplayerLinkStatus: true,
  marketPrice: true,
  midPrice: true,
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
            region: true,
          },
        },
      },
    },
  }),
});

const buildInclude = (
  includeRelations: boolean,
  includeAlternates: boolean,
  region?: string,
  ignoreRegion: boolean = false
): Prisma.CardInclude | undefined => {
  const include: Prisma.CardInclude = {};
  const selectedRegion = normalizeRegion(region);
  const alternateRegionCondition = ignoreRegion
    ? {}
    : buildRegionScopeCondition(selectedRegion);

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
            region: true,
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
      where: alternateRegionCondition,
      orderBy: { order: "asc" },
      select: buildAlternateSelect(includeRelations),
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
// Usa offset-based pagination porque cursor-based no funciona correctamente con orderBy precio
const fetchCardsPageByPrice = async (
  options: FetchCardsPageOptions
): Promise<CardsPage> => {
  const {
    filters,
    limit,
    cursor = null, // En este caso, cursor actúa como offset (número de items a saltar)
    includeRelations = false,
    includeAlternates = true,
  } = options;
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);

  if (forceEmpty) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
    };
  }

  // Para ordenamiento por precio, usamos buildDirectWhere que NO usa withAlternates
  // Esto asegura que solo traemos cartas que coinciden directamente con los filtros
  // (ej: solo Leaders, no cartas cuyas alternativas sean Leaders)
  const priceWhere = buildDirectWhere(enrichedFilters);
  const take = Math.min(Math.max(limit, 1), 200);
  const isHighToLow = enrichedFilters.sortBy === "price_high";

  // Ordenar por precio directamente en la consulta
  // Para ambos casos (high to low y low to high), los nulls van al final
  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];
  if (isHighToLow) {
    // High to low: precio más alto primero, nulls al final
    orderBy.push({ marketPrice: { sort: "desc", nulls: "last" } });
  } else {
    // Low to high: precio más bajo primero, nulls al final
    // Usamos nulls: "last" para que las cartas sin precio no aparezcan primero
    orderBy.push({ marketPrice: { sort: "asc", nulls: "last" } });
  }
  orderBy.push({ id: "asc" }); // Desempate por ID

  // Calcular offset: cursor representa cuántos items ya se han cargado
  const offset = cursor ? cursor : 0;

  const args: Prisma.CardFindManyArgs = {
    where: priceWhere,
    orderBy,
    take: take + 1, // +1 para saber si hay más páginas
    skip: offset,
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

  // Debug log para verificar query
  console.log("[fetchCardsPageByPrice] filters:", {
    sortBy: filters.sortBy,
    categories: filters.categories,
    baseOnly: filters.baseOnly,
  });
  console.log("[fetchCardsPageByPrice] orderBy:", JSON.stringify(orderBy));

  const [allCards, totalCount] = await Promise.all([
    prisma.card.findMany(args),
    prisma.card.count({ where: priceWhere }),
  ]);

  // Debug: ver los primeros 5 resultados con sus precios
  console.log(
    "[fetchCardsPageByPrice] first 5 results:",
    allCards.slice(0, 5).map((c: any) => ({
      name: c.name,
      code: c.code,
      marketPrice: c.marketPrice,
      category: c.category,
    }))
  );

  const hasMore = allCards.length > take;
  const trimmed = hasMore ? allCards.slice(0, take) : allCards;

  // Mapear las cartas - cada carta es independiente (base o alternativa)
  const mapped = trimmed.map((card) => ({
    ...card,
    alternates: [], // Sin alternativas anidadas en modo precio
    numOfVariations: 0,
  })) as unknown as CardWithCollectionData[];

  // El siguiente "cursor" es el nuevo offset (items actuales + nuevos)
  const nextCursor = hasMore ? offset + take : null;

  return {
    items: mapped,
    nextCursor,
    hasMore,
    totalCount,
  };
};

const fetchCardsPageWithAlternates = async (
  options: FetchCardsPageOptions
): Promise<CardsPage> => {
  const { filters, limit, cursor = null, includeRelations = false } = options;
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);

  if (forceEmpty) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
    };
  }

  const where = buildDirectWhere(enrichedFilters);
  const take = Math.min(Math.max(limit, 1), 200);

  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];
  switch (enrichedFilters.sortBy) {
    case "code_asc":
      orderBy.push({ code: "asc" }, { id: "asc" });
      break;
    case "code_desc":
      orderBy.push({ code: "desc" }, { id: "asc" });
      break;
    case "name_asc":
      orderBy.push({ name: "asc" }, { id: "asc" });
      break;
    case "name_desc":
      orderBy.push({ name: "desc" }, { id: "asc" });
      break;
    default:
      orderBy.push({ collectionOrder: "asc" }, { code: "asc" }, { id: "asc" });
      break;
  }

  const args: Prisma.CardFindManyArgs = {
    where,
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
      baseCard: {
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
      },
    },
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
  const mapped = trimmed.map((card) => ({
    ...card,
    alternates: [],
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
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);

  if (forceEmpty) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
    };
  }

  const isPriceSorting =
    enrichedFilters.sortBy === "price_high" || enrichedFilters.sortBy === "price_low";
  const hasResolvedSearchSet = Boolean(enrichedFilters.searchSetIds?.length);
  const shouldUngroupSearchResults = hasSpecificStructuredSearch(enrichedFilters);

  // Para ordenamiento por precio, necesitamos traer base + alternativas juntas
  if (isPriceSorting) {
    return fetchCardsPageByPrice({ ...options, filters: enrichedFilters });
  }

  if (
    hasResolvedSearchSet ||
    hasAltArtSearch(enrichedFilters) ||
    shouldUngroupSearchResults
  ) {
    return fetchCardsPageWithAlternates({ ...options, filters: enrichedFilters });
  }

  // Ordenamiento normal (solo cartas base)
  const where = buildWhere(enrichedFilters);
  const include = buildInclude(
    includeRelations,
    includeAlternates,
    enrichedFilters.region,
    shouldIgnoreRegionForSearch(enrichedFilters)
  );

  const take = Math.min(Math.max(limit, 1), 200);

  // Build orderBy based on sortBy filter
  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];

  switch (enrichedFilters.sortBy) {
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
      orderBy.push({ collectionOrder: "asc" }, { code: "asc" }, { id: "asc" });
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
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);

  if (forceEmpty) {
    return [];
  }

  const hasResolvedSearchSet = Boolean(enrichedFilters.searchSetIds?.length);
  const shouldUngroupSearchResults = hasSpecificStructuredSearch(enrichedFilters);

  if (
    hasResolvedSearchSet ||
    hasAltArtSearch(enrichedFilters) ||
    shouldUngroupSearchResults
  ) {
    const where = buildDirectWhere(enrichedFilters);
    const args: Prisma.CardFindManyArgs = {
      where,
      orderBy: [{ collectionOrder: "asc" }, { code: "asc" }, { id: "asc" }],
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
        baseCard: {
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
        },
      },
    };

    if (limit && Number.isFinite(limit)) {
      args.take = Math.min(Math.max(limit, 1), 5000);
    }

    const cards = await prisma.card.findMany(args);

    return cards.map((card) => ({
      ...card,
      alternates: [],
      numOfVariations: 0,
    })) as unknown as CardWithCollectionData[];
  }

  const where = buildWhere(enrichedFilters);
  const include = buildInclude(
    includeRelations,
    includeAlternates,
    enrichedFilters.region,
    shouldIgnoreRegionForSearch(enrichedFilters)
  );

  const args: Prisma.CardFindManyArgs = {
    where,
    orderBy: [{ collectionOrder: "asc" }, { code: "asc" }, { id: "asc" }],
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
export const buildDirectWhere = (filters: CardsFilters): Prisma.CardWhereInput => {
  const ignoreRegion = shouldIgnoreRegionForSearch(filters);
  const selectedRegion = normalizeRegion(filters.region);
  const regionCondition = ignoreRegion
    ? {}
    : buildRegionScopeCondition(selectedRegion);
  const where: Prisma.CardWhereInput = {
    AND: [],
  };

  const andConditions = where.AND as Prisma.CardWhereInput[];

  if (!ignoreRegion) {
    andConditions.push(regionCondition);
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      const parsed = parseSearchTokens(search);
      if (!shouldSkipSearchTokenConditions(filters)) {
        const tokenSearchScope: SearchScope = hasStructuredSearchSignals(parsed)
          ? "name-first"
          : "broad";

        parsed.textTokens.forEach((token) => {
          andConditions.push(buildTokenSearchCondition(token, tokenSearchScope));
        });

        parsed.exactPhrases.forEach((phrase) => {
          andConditions.push(buildExactPhraseSearchCondition(phrase));
        });

        if (parsed.categories.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.categories, (value) => ({
              category: { equals: value, mode: "insensitive" as const },
            }))
          );
        }

        if (parsed.rarities.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.rarities, (value) => ({
              rarity: { equals: value, mode: "insensitive" as const },
            }))
          );
        }

        if (parsed.colors.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.colors, (value) => ({
              colors: {
                some: { color: { equals: value, mode: "insensitive" as const } },
              },
            }))
          );
        }

        if (parsed.costs.length > 0) {
          const costVariants = parsed.costs.flatMap((value) => [
            `${value} Cost`,
            value,
          ]);
          andConditions.push({
            OR: costVariants.map((value) => ({ cost: value })),
          });
        }

        if (parsed.powers.length > 0) {
          const powerVariants = parsed.powers.flatMap((value) => [
            `${value} Power`,
            value,
          ]);
          andConditions.push({
            OR: powerVariants.map((value) => ({ power: value })),
          });
        }

        if (parsed.altArts.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.altArts, (value) => ({
              alternateArt: { equals: value, mode: "insensitive" as const },
            }))
          );
        }

        if (parsed.triggers.length > 0) {
          const normalizedTriggers = Array.from(new Set(parsed.triggers));
          normalizedTriggers.forEach((trigger) => {
            if (trigger === "No trigger") {
              andConditions.push({ triggerCard: null });
            } else {
              andConditions.push({ triggerCard: { contains: trigger } });
            }
          });
        }

        if (parsed.codeTokens.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.codeTokens, (value) => ({
              code: parsed.exactCodeTokens.includes(value)
                ? { equals: value, mode: "insensitive" as const }
                : { contains: value, mode: "insensitive" as const },
            }))
          );
        }

        if (parsed.codeSuffixTokens.length > 0) {
          andConditions.push(
            buildInsensitiveListCondition(parsed.codeSuffixTokens, (value) => ({
              code: { endsWith: value, mode: "insensitive" as const },
            }))
          );
        }

        if (parsed.illustratorTokens.length > 0) {
          andConditions.push(
            buildContainsAllCondition(parsed.illustratorTokens, (value) => ({
              illustrator: { contains: value, mode: "insensitive" as const },
            }))
          );
        }
      }
    }
  }

  if (filters.searchSetIds?.length) {
    andConditions.push({
      sets: { some: { setId: { in: filters.searchSetIds } } },
    });
  }

  if (filters.sets?.length) {
    andConditions.push({
      OR: [
        { sets: { some: { set: { code: { in: filters.sets } } } } },
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

  // Base cards only (exclude alternates)
  if (filters.baseOnly) {
    andConditions.push({
      baseCardId: null, // Base cards have null baseCardId
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
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);
  if (forceEmpty) return 0;
  const shouldCountBaseOnly = Boolean(enrichedFilters.baseOnly);
  const shouldCountDirect =
    !shouldCountBaseOnly &&
    (Boolean(enrichedFilters.searchSetIds?.length) ||
      hasAltArtSearch(enrichedFilters) ||
      hasSpecificStructuredSearch(enrichedFilters));

  const where = shouldCountBaseOnly
    ? buildWhere(enrichedFilters, false)
    : shouldCountDirect
    ? buildDirectWhere(enrichedFilters)
    : buildWhere(enrichedFilters, false);

  return prisma.card.count({ where });
};

/** Suma el marketPrice de las cartas que matchean el filtro (mismo where que
 *  el conteo). Devuelve el total en USD y cuántas tienen precio. */
export const sumCardsValueByFilters = async (
  filters: CardsFilters
): Promise<{ value: number; withPrice: number }> => {
  const { enrichedFilters, forceEmpty } =
    await enrichFiltersWithResolvedSearchSet(filters);
  if (forceEmpty) {
    return { value: 0, withPrice: 0 };
  }
  const shouldCountBaseOnly = Boolean(filters.baseOnly);
  const where = shouldCountBaseOnly
    ? buildWhere(enrichedFilters, false)
    : buildDirectWhere(enrichedFilters);

  const agg = await prisma.card.aggregate({
    where,
    _sum: { marketPrice: true },
    _count: { marketPrice: true },
  });

  return {
    value: Number(agg._sum.marketPrice ?? 0),
    withPrice: agg._count.marketPrice ?? 0,
  };
};
