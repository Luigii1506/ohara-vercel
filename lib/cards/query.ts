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

const SEARCH_COLOR_MAP: Record<string, string> = {
  red: "red",
  rojo: "red",
  roja: "red",
  blue: "blue",
  azul: "blue",
  green: "green",
  verde: "green",
  yellow: "yellow",
  amarillo: "yellow",
  amrilla: "yellow",
  black: "black",
  negro: "black",
  negra: "black",
  purple: "purple",
  morado: "purple",
  morada: "purple",
  purpura: "purple",
};

const SEARCH_RARITY_MAP: Record<string, string> = {
  l: "Leader",
  leader: "Leader",
  lider: "Leader",
  r: "Rare",
  rare: "Rare",
  raro: "Rare",
  rara: "Rare",
  uc: "Uncommon",
  uncommon: "Uncommon",
  pococomun: "Uncommon",
  c: "Common",
  common: "Common",
  comun: "Common",
  sr: "Super Rare",
  superrare: "Super Rare",
  superrara: "Super Rare",
  sec: "Secret Rare",
  secret: "Secret Rare",
  secreta: "Secret Rare",
  secreto: "Secret Rare",
  p: "Promo",
  promo: "Promo",
};

const SEARCH_CATEGORY_MAP: Record<string, string> = {
  don: "DON",
  leader: "Leader",
  lider: "Leader",
  character: "Character",
  personaje: "Character",
  event: "Event",
  evento: "Event",
  stage: "Stage",
  escenario: "Stage",
};

const SEARCH_ALT_ART_MAP: Record<string, string> = {
  aa: "Alternate Art",
  alt: "Alternate Art",
  alternate: "Alternate Art",
  alternateart: "Alternate Art",
  alterna: "Alternate Art",
  manga: "Manga Art",
  mangaart: "Manga Art",
  fullart: "Full Art",
  full: "Full Art",
  artecompleto: "Full Art",
  completo: "Full Art",
  treasurecup: "Treasure Cup",
  treasurerare: "Treasure Rare",
  treasure: "Treasure Cup",
  sp: "Special Card",
  special: "Special Card",
  specialcard: "Special Card",
  judge: "Judge",
  jues: "Judge",
  textured: "Textured Foil",
  texturedfoil: "Textured Foil",
  texturizada: "Textured Foil",
  textura: "Textured Foil",
  texturisada: "Textured Foil",
  piratefoil: "Jolly Roger Foil",
  jollyroger: "Jolly Roger Foil",
  jollyrogerfoil: "Jolly Roger Foil",
  prerelease: "Pre-Release",
  pre: "Pre-Release",
  "1stanniversary": "1st Anniversary",
  "2ndanniversary": "2nd Anniversary",
  "3rdanniversary": "3rd Anniversary",
  "1st": "1st Anniversary",
  "2n": "2nd Anniversary",
  "3r": "3rd Anniversary",
  serial: "Serial",
  seriada: "Serial",
  reimpresion: "Reprint",
  copia: "reprint",
  reprint: "Reprint",
  winner: "Winner Version",
  ganador: "Winner Version",
  ganadora: "Winner Version",
  winnerversion: "Winner Version",
  finalist: "Finalist Version",
  finalista: "Finalist Version",
  finalistversion: "Finalist Version",
  topplayer: "Top Player Version",
  top: "Top Player Version",
  jugadortop: "Top Player Version",
  topplayerversion: "Top Player Version",
  participation: "Participation Version",
  participacion: "Participation Version",
  participasion: "Participation Version",
  participationversion: "Participation Version",
  preerrata: "Pre-Errata",
  errata: "Pre-Errata",
  demo: "Demo Version",
  demoversion: "Demo Version",
  notforsale: "Not for sale",
  nfs: "Not for sale",
};

const SEARCH_TRIGGER_MAP: Record<string, string> = {
  trigger: "Trigger",
  gatillo: "Trigger",
  notrigger: "No trigger",
  sintrigger: "No trigger",
  singatillo: "No trigger",
};

const normalizeSearchToken = (token: string) =>
  token.toLowerCase().replace(/[^a-z0-9-]/g, "");

const parseSearchTokens = (search: string) => {
  const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const compactSearch = normalizedSearch.replace(/\s+/g, "");
  const rawTokens = normalizedSearch.match(/[a-z0-9-]+/gi) ?? [];
  const colors = new Set<string>();
  const rarities = new Set<string>();
  const categories = new Set<string>();
  const altArts = new Set<string>();
  const triggers = new Set<string>();
  const costs = new Set<string>();
  const powers = new Set<string>();
  const codeTokens = new Set<string>();
  const codeSuffixTokens = new Set<string>();
  const textTokens: string[] = [];

  if (compactSearch.includes("notforsale")) {
    altArts.add("Not for sale");
  }
  if (compactSearch.includes("prerelease")) {
    altArts.add("Pre-Release");
  }
  if (compactSearch.includes("preerrata")) {
    altArts.add("Pre-Errata");
  }
  if (compactSearch.includes("1stanniversary")) {
    altArts.add("1st Anniversary");
  }
  if (compactSearch.includes("2ndanniversary")) {
    altArts.add("2nd Anniversary");
  }
  if (compactSearch.includes("3rdanniversary")) {
    altArts.add("3rd Anniversary");
  }
  if (
    compactSearch.includes("notrigger") ||
    compactSearch.includes("sintrigger") ||
    compactSearch.includes("singatillo")
  ) {
    triggers.add("No trigger");
  }

  rawTokens.forEach((raw) => {
    const token = normalizeSearchToken(raw);
    if (!token) return;

    const mappedRarity = SEARCH_RARITY_MAP[token];
    if (mappedRarity) {
      rarities.add(mappedRarity);
      return;
    }

    const mappedCategory = SEARCH_CATEGORY_MAP[token];
    if (mappedCategory) {
      categories.add(mappedCategory);
      return;
    }

    const mappedAltArt = SEARCH_ALT_ART_MAP[token];
    if (mappedAltArt) {
      altArts.add(mappedAltArt);
      return;
    }

    const mappedTrigger = SEARCH_TRIGGER_MAP[token];
    if (mappedTrigger) {
      triggers.add(mappedTrigger);
      return;
    }

    const mappedColor = SEARCH_COLOR_MAP[token];
    if (mappedColor) {
      colors.add(mappedColor);
      return;
    }

    if (/^\d+$/.test(token)) {
      if (token.length <= 2) {
        costs.add(String(parseInt(token, 10)));
        return;
      }
      if (token.length === 3) {
        codeSuffixTokens.add(token);
        return;
      }
      if (token.length >= 4 && token.length <= 5) {
        powers.add(String(parseInt(token, 10)));
        return;
      }
    }

    const normalizedCodeToken = token.replace(/-/g, "");
    if (/^(op|st|eb|prb|p)\d+$/i.test(normalizedCodeToken)) {
      codeTokens.add(normalizedCodeToken.toUpperCase());
      return;
    }

    textTokens.push(token);
  });

  return {
    textTokens,
    colors: Array.from(colors),
    rarities: Array.from(rarities),
    categories: Array.from(categories),
    altArts: Array.from(altArts),
    triggers: Array.from(triggers),
    costs: Array.from(costs),
    powers: Array.from(powers),
    codeTokens: Array.from(codeTokens),
    codeSuffixTokens: Array.from(codeSuffixTokens),
  };
};

const hasAltArtSearch = (filters: CardsFilters) => {
  if (filters.altArts?.length) return true;
  if (!filters.search) return false;
  const parsed = parseSearchTokens(filters.search);
  return parsed.altArts.length > 0;
};

const buildWhere = (
  filters: CardsFilters,
  includeAlternates: boolean = false
): Prisma.CardWhereInput => {
  const where: Prisma.CardWhereInput = {
    // Solo filtrar por baseCardId: null si NO incluimos alternativas
    // o si el caller solicita solo cartas base.
    ...(includeAlternates ? {} : { baseCardId: null }),
    ...(filters.baseOnly ? { baseCardId: null } : {}),
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

  const buildSearchCondition = (search: string): Prisma.CardWhereInput => {
    return {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { rarity: { contains: search, mode: "insensitive" } },
        {
          effects: {
            some: { effect: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    };
  };

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      const parsed = parseSearchTokens(search);

      parsed.textTokens.forEach((token) => {
        andConditions.push({
          OR: [
            buildSearchCondition(token),
            {
              alternateCards: {
                some: buildSearchCondition(token),
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
                trigger: null,
              })
            );
          } else {
            andConditions.push(
              withAlternates({
                trigger: { contains: trigger },
              })
            );
          }
        });
      }

      if (parsed.codeTokens.length > 0) {
        andConditions.push(
          withAlternates(
            buildInsensitiveListCondition(parsed.codeTokens, (value) => ({
              code: { contains: value, mode: "insensitive" },
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

  // Para ordenamiento por precio, usamos buildDirectWhere que NO usa withAlternates
  // Esto asegura que solo traemos cartas que coinciden directamente con los filtros
  // (ej: solo Leaders, no cartas cuyas alternativas sean Leaders)
  const priceWhere = buildDirectWhere(filters);
  const take = Math.min(Math.max(limit, 1), 200);
  const isHighToLow = filters.sortBy === "price_high";

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

  const where = buildDirectWhere(filters);
  const take = Math.min(Math.max(limit, 1), 200);

  const orderBy: Prisma.CardOrderByWithRelationInput[] = [];
  switch (filters.sortBy) {
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

  const isPriceSorting =
    filters.sortBy === "price_high" || filters.sortBy === "price_low";

  // Para ordenamiento por precio, necesitamos traer base + alternativas juntas
  if (isPriceSorting) {
    return fetchCardsPageByPrice(options);
  }

  if (hasAltArtSearch(filters)) {
    return fetchCardsPageWithAlternates(options);
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

  const where = buildWhere(filters);
  const include = buildInclude(includeRelations, includeAlternates);

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
const buildDirectWhere = (filters: CardsFilters): Prisma.CardWhereInput => {
  const where: Prisma.CardWhereInput = {
    AND: [],
  };

  const andConditions = where.AND as Prisma.CardWhereInput[];

  const buildSearchCondition = (search: string): Prisma.CardWhereInput => {
    return {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { rarity: { contains: search, mode: "insensitive" } },
        {
          effects: {
            some: { effect: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    };
  };

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length) {
      const parsed = parseSearchTokens(search);

      parsed.textTokens.forEach((token) => {
        andConditions.push(buildSearchCondition(token));
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
            andConditions.push({ trigger: null });
          } else {
            andConditions.push({ trigger: { contains: trigger } });
          }
        });
      }

      if (parsed.codeTokens.length > 0) {
        andConditions.push(
          buildInsensitiveListCondition(parsed.codeTokens, (value) => ({
            code: { contains: value, mode: "insensitive" as const },
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
  // Count cards that directly match the filters (both base and alternates individually)
  // This avoids the "withAlternates" OR pattern that counts base cards when only alternates match
  const directWhere = buildDirectWhere(filters);

  return prisma.card.count({ where: directWhere });
};
