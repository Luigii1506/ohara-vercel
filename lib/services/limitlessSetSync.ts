import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { findBestSetMatch, type SetMatchResult } from "@/lib/services/catalogSetResolver";
import {
  LimitlessDecisionStatus,
  LimitlessReviewItemKind,
  LimitlessReviewStatus,
} from "@prisma/client";

const LIMITLESS_BASE_URL = "https://onepiece.limitlesstcg.com";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

export type LimitlessPrintRow = {
  title: string;
  tcgUrl: string | null;
  productId: number | null;
  usdPrice: string | null;
};

export type LimitlessSetCard = {
  code: string;
  name: string;
  cardUrl: string;
  version: number | null;
  imageUrl: string | null;
  currentPrintTitle: string | null;
  currentPrintProductId: number | null;
  currentPrintTcgUrl: string | null;
  currentPrintUsdPrice: string | null;
  prints: LimitlessPrintRow[];
};

export type LimitlessSetSnapshot = {
  slug: string;
  sourceUrl: string;
  title: string;
  declaredCardCount: number;
  cards: LimitlessSetCard[];
};

export type LimitlessCatalogEntry = {
  slug: string;
  url: string;
  code: string | null;
  title: string;
  releaseLabel: string | null;
  cardCountLabel: string | null;
  category: "main" | "promo";
};

export type LimitlessCatalogFeedEntry = LimitlessCatalogEntry & {
  reviewId: number | null;
  reviewStatus: LimitlessReviewStatus | null;
  dbSetId: number | null;
  dbSetTitle: string | null;
  lastSyncedAt: string | null;
  issueCount: number;
  missingCount: number;
  wrongSetCount: number;
  extraCount: number;
  isTracked: boolean;
  isNew: boolean;
  needsSync: boolean;
};

export type DbSetCardRecord = {
  id: number;
  code: string;
  name: string;
  src: string | null;
  region: string | null;
  tcgplayerProductId: string | null;
  isFirstEdition: boolean;
  baseCardId: number | null;
  setIds: number[];
};

export type LimitlessMembershipMatch = {
  code: string;
  cardUrl: string;
  imageUrl: string | null;
  printTitle: string | null;
  productId: number | null;
  card: DbSetCardRecord;
};

export type LimitlessMissingMembership = {
  code: string;
  name: string;
  cardUrl: string;
  printTitle: string | null;
  productId: number | null;
  reason:
    | "missing-in-db"
    | "missing-in-set"
    | "ambiguous-product-id"
    | "ambiguous-code";
  candidateCardIds: number[];
};

export type LimitlessSetReconciliation = {
  snapshot: LimitlessSetSnapshot;
  dbSet: SetMatchResult | null;
  dbSetCardCount: number;
  matchedByProductId: LimitlessMembershipMatch[];
  matchedByCodeOnly: LimitlessMembershipMatch[];
  missing: LimitlessMissingMembership[];
  wrongSet: LimitlessMissingMembership[];
  extraInDbSet: DbSetCardRecord[];
};

export type ReconcileLimitlessSetOptions = {
  setUrlOrSlug: string;
  dbSetId?: number | null;
  region?: string | null;
};

export type SyncLimitlessCatalogOptions = {
  category?: "main" | "promo" | "all";
  region?: string | null;
  limit?: number | null;
  slugs?: string[] | null;
  newOnly?: boolean;
  staleHours?: number | null;
  forceAll?: boolean;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toAbsoluteUrl(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value, LIMITLESS_BASE_URL).toString();
  } catch {
    return null;
  }
}

function extractSetSlug(value: string) {
  try {
    const url = new URL(value, LIMITLESS_BASE_URL);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? value;
  } catch {
    return value
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean)
      .pop() as string;
  }
}

function buildSetUrl(setUrlOrSlug: string) {
  const slug = extractSetSlug(setUrlOrSlug);
  return `${LIMITLESS_BASE_URL}/cards/${encodeURIComponent(slug)}?display=full`;
}

function extractTcgplayerUrl(partnerUrl?: string | null) {
  if (!partnerUrl) return null;
  try {
    const outer = new URL(partnerUrl, LIMITLESS_BASE_URL);
    const encoded = outer.searchParams.get("u");
    if (encoded) {
      return decodeURIComponent(encoded);
    }
    return outer.toString();
  } catch {
    return null;
  }
}

function extractTcgplayerProductId(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/product\/(\d+)(?:\/|$)/i);
  return match ? Number(match[1]) : null;
}

function extractCurrentPrintTitle(pageTitle: string | null) {
  if (!pageTitle) return null;
  const match = pageTitle.match(/\)\s*[•·]\s*(.*?)\s*[–-]\s*Limitless One Piece/i);
  return match ? normalizeWhitespace(match[1]) : null;
}

async function fetchHtml(url: string) {
  const response = await axios.get<string>(url, {
    headers: DEFAULT_HEADERS,
    timeout: 30000,
  });
  return response.data;
}

function parseCatalogEntries(
  html: string,
  category: "main" | "promo"
): LimitlessCatalogEntry[] {
  const $ = cheerio.load(html);
  const entriesBySlug = new Map<string, LimitlessCatalogEntry>();

  $(".sets-table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) return;
    const titleAnchor = cells.find('a[href^="/cards/"]').first();
    const href = titleAnchor.attr("href");
    if (!href || href === "/cards/promos" || href === "/cards/advanced") return;

    const absoluteUrl = toAbsoluteUrl(href);
    if (!absoluteUrl) return;
    const slug = extractSetSlug(absoluteUrl);
    if (!slug || slug === "promos" || slug === "advanced") return;

    const code = normalizeWhitespace($(cells[0]).text()) || null;
    const title = normalizeWhitespace(titleAnchor.text());
    const releaseLabel = normalizeWhitespace($(cells[1]).text()) || null;
    const cardCountLabel = normalizeWhitespace($(cells[2]).text()) || null;

    entriesBySlug.set(slug, {
      slug,
      url: absoluteUrl,
      code,
      title,
      releaseLabel,
      cardCountLabel,
      category,
    });
  });

  return Array.from(entriesBySlug.values()).filter((entry) => entry.title);
}

export async function scrapeLimitlessSetCatalog(): Promise<LimitlessCatalogEntry[]> {
  const [mainHtml, promoHtml] = await Promise.all([
    fetchHtml(`${LIMITLESS_BASE_URL}/cards`),
    fetchHtml(`${LIMITLESS_BASE_URL}/cards/promos`),
  ]);

  const merged = [...parseCatalogEntries(mainHtml, "main"), ...parseCatalogEntries(promoHtml, "promo")];
  const deduped = new Map<string, LimitlessCatalogEntry>();
  for (const entry of merged) {
    if (!deduped.has(entry.slug)) {
      deduped.set(entry.slug, entry);
    }
  }
  return Array.from(deduped.values());
}

export async function getLimitlessCatalogFeed(options?: {
  region?: string | null;
  staleHours?: number | null;
}): Promise<{
  entries: LimitlessCatalogFeedEntry[];
  stats: {
    total: number;
    tracked: number;
    untracked: number;
    pending: number;
    reviewed: number;
    applied: number;
    needsSync: number;
    main: number;
    promo: number;
  };
}> {
  const region = (options?.region ?? "US").trim().toUpperCase();
  const staleHours =
    options?.staleHours != null && Number.isFinite(options.staleHours)
      ? Math.max(1, options.staleHours)
      : 24;

  const catalog = await scrapeLimitlessSetCatalog();
  const reviews = await prisma.limitlessSetReview.findMany({
    where: {
      region,
      slug: {
        in: catalog.map((entry) => entry.slug),
      },
    },
    select: {
      id: true,
      slug: true,
      status: true,
      dbSetId: true,
      lastSyncedAt: true,
      wrongSetCount: true,
      missingCount: true,
      extraCount: true,
      dbSet: {
        select: {
          title: true,
        },
      },
    },
  });

  const reviewsBySlug = new Map(reviews.map((review) => [review.slug, review]));
  const staleThreshold = Date.now() - staleHours * 60 * 60 * 1000;

  const entries = catalog.map((entry) => {
    const review = reviewsBySlug.get(entry.slug);
    const issueCount =
      (review?.wrongSetCount ?? 0) +
      (review?.missingCount ?? 0) +
      (review?.extraCount ?? 0);
    const lastSyncedAt = review?.lastSyncedAt?.toISOString() ?? null;
    const needsSync =
      !review ||
      !review.dbSetId ||
      !review.lastSyncedAt ||
      review.lastSyncedAt.getTime() < staleThreshold;

    return {
      ...entry,
      reviewId: review?.id ?? null,
      reviewStatus: review?.status ?? null,
      dbSetId: review?.dbSetId ?? null,
      dbSetTitle: review?.dbSet?.title ?? null,
      lastSyncedAt,
      issueCount,
      missingCount: review?.missingCount ?? 0,
      wrongSetCount: review?.wrongSetCount ?? 0,
      extraCount: review?.extraCount ?? 0,
      isTracked: Boolean(review),
      isNew: !review,
      needsSync,
    };
  });

  return {
    entries,
    stats: {
      total: entries.length,
      tracked: entries.filter((entry) => entry.isTracked).length,
      untracked: entries.filter((entry) => !entry.isTracked).length,
      pending: entries.filter((entry) => entry.reviewStatus === LimitlessReviewStatus.PENDING).length,
      reviewed: entries.filter((entry) => entry.reviewStatus === LimitlessReviewStatus.REVIEWED).length,
      applied: entries.filter((entry) => entry.reviewStatus === LimitlessReviewStatus.APPLIED).length,
      needsSync: entries.filter((entry) => entry.needsSync).length,
      main: entries.filter((entry) => entry.category === "main").length,
      promo: entries.filter((entry) => entry.category === "promo").length,
    },
  };
}

async function scrapeCardPrintDetails(
  cardUrl: string,
  version: number | null
): Promise<{
  imageUrl: string | null;
  currentPrintTitle: string | null;
  currentPrintProductId: number | null;
  currentPrintTcgUrl: string | null;
  currentPrintUsdPrice: string | null;
  prints: LimitlessPrintRow[];
}> {
  const html = await fetchHtml(cardUrl);
  const $ = cheerio.load(html);
  const pageTitle = normalizeWhitespace($("title").first().text()) || null;
  const imageUrl = toAbsoluteUrl($('meta[property="og:image"]').attr("content") ?? null);
  const currentPrintTitle = extractCurrentPrintTitle(pageTitle);
  const prints: LimitlessPrintRow[] = [];
  const seen = new Set<string>();

  $("a.card-price.usd").each((_, element) => {
    const priceLink = $(element);
    const row = priceLink.closest("tr");
    const cells = row.find("td");
    if (cells.length < 2) return;
    const titleCell = $(cells[0]);
    const titleAnchor = titleCell.find("a").first();
    const titleClone = titleAnchor.clone();
    titleClone.find(".prints-table-card-number").remove();
    const title = normalizeWhitespace(titleClone.text());
    const usdPrice = normalizeWhitespace($(cells[1]).text()) || null;
    const tcgUrl = extractTcgplayerUrl(priceLink.attr("href"));
    const productId = extractTcgplayerProductId(tcgUrl);
    const key = `${title}::${productId ?? "none"}`;
    if (!title || seen.has(key)) return;
    seen.add(key);

    prints.push({
      title,
      tcgUrl,
      productId,
      usdPrice,
    });
  });

  const versionPrint =
    version !== null &&
    Number.isFinite(version) &&
    version >= 0 &&
    version < prints.length
      ? prints[version]
      : null;

  const currentPrint =
    versionPrint ??
    (currentPrintTitle
      ? prints.find(
          (print) => normalizeTitle(print.title) === normalizeTitle(currentPrintTitle)
        )
      : null) ??
    prints[0] ??
    null;

  return {
    imageUrl,
    currentPrintTitle,
    currentPrintProductId: currentPrint?.productId ?? null,
    currentPrintTcgUrl: currentPrint?.tcgUrl ?? null,
    currentPrintUsdPrice: currentPrint?.usdPrice ?? null,
    prints,
  };
}

export async function scrapeLimitlessSetMembership(
  setUrlOrSlug: string
): Promise<LimitlessSetSnapshot> {
  const slug = extractSetSlug(setUrlOrSlug);
  const sourceUrl = buildSetUrl(setUrlOrSlug);
  const html = await fetchHtml(sourceUrl);
  const $ = cheerio.load(html);
  const titleText = normalizeWhitespace($("title").first().text());
  const title = titleText.replace(/\s*[–-]\s*Limitless One Piece$/i, "").trim();
  const cards: Array<{ code: string; name: string; cardUrl: string; version: number | null }> = [];
  const seenCardUrls = new Set<string>();

  $(".card-profile").each((_, element) => {
    const profile = $(element);
    const code = normalizeWhitespace(profile.find(".card-text-id").first().text());
    const name = normalizeWhitespace(profile.find(".card-text-name").first().text());
    const href = profile.find('a[href*="/cards/"]').first().attr("href");
    const cardUrl = toAbsoluteUrl(href);
    if (!code || !name || !cardUrl || seenCardUrls.has(cardUrl)) return;
    seenCardUrls.add(cardUrl);
    let version: number | null = null;
    try {
      const parsed = new URL(cardUrl);
      const rawVersion = parsed.searchParams.get("v");
      version = rawVersion ? Number.parseInt(rawVersion, 10) : null;
      if (version !== null && !Number.isFinite(version)) {
        version = null;
      }
    } catch {
      version = null;
    }
    cards.push({ code, name, cardUrl, version });
  });

  const resolvedCards: LimitlessSetCard[] = [];
  for (const card of cards) {
    const details = await scrapeCardPrintDetails(card.cardUrl, card.version);
    resolvedCards.push({
      ...card,
      ...details,
    });
  }

  return {
    slug,
    sourceUrl,
    title,
    declaredCardCount: cards.length,
    cards: resolvedCards,
  };
}

async function resolveDbSet(
  snapshot: LimitlessSetSnapshot,
  dbSetId?: number | null
): Promise<SetMatchResult | null> {
  if (dbSetId) {
    const set = await prisma.set.findUnique({
      where: { id: dbSetId },
      select: { id: true, title: true, code: true },
    });
    if (!set) return null;
    return {
      setId: set.id,
      title: set.title,
      code: set.code,
      matchedBy: "title",
    };
  }

  // Si algún Set ya tiene guardada esta URL/slug de Limitless (SetSource),
  // usarlo directo en vez de adivinar por similitud de título — esto es lo
  // que hace confiable el batch-sync sobre todo el catálogo sin que un
  // admin pegue la URL de cada set a mano.
  const linkedSource = await prisma.setSource.findFirst({
    where: { source: "limitless", sourceSlug: snapshot.slug },
    select: { set: { select: { id: true, title: true, code: true } } },
  });
  if (linkedSource?.set) {
    return {
      setId: linkedSource.set.id,
      title: linkedSource.set.title,
      code: linkedSource.set.code,
      matchedBy: "sourceLink",
    };
  }

  return findBestSetMatch(snapshot.title, null);
}

async function loadDbCardsForSet(
  setId: number,
  region?: string | null
): Promise<DbSetCardRecord[]> {
  const where = {
    sets: { some: { setId } },
    ...(region ? { region } : {}),
  };

  const cards = await prisma.card.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      src: true,
      region: true,
      tcgplayerProductId: true,
      isFirstEdition: true,
      baseCardId: true,
      sets: {
        select: {
          setId: true,
        },
      },
    },
    orderBy: [{ code: "asc" }, { id: "asc" }],
  });

  return cards.map((card) => ({
    id: card.id,
    code: card.code,
    name: card.name,
    src: card.src,
    region: card.region,
    tcgplayerProductId: card.tcgplayerProductId,
    isFirstEdition: card.isFirstEdition,
    baseCardId: card.baseCardId,
    setIds: card.sets.map((entry) => entry.setId),
  }));
}

async function loadDbCandidates(
  snapshot: LimitlessSetSnapshot,
  region?: string | null
): Promise<DbSetCardRecord[]> {
  const productIds = snapshot.cards
    .map((card) => card.currentPrintProductId)
    .filter((value): value is number => Number.isFinite(value));
  const codes = Array.from(new Set(snapshot.cards.map((card) => card.code)));

  const cards = await prisma.card.findMany({
    where: {
      ...(region ? { region } : {}),
      OR: [
        ...(productIds.length
          ? [{ tcgplayerProductId: { in: productIds.map(String) } }]
          : []),
        ...(codes.length ? [{ code: { in: codes } }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      src: true,
      region: true,
      tcgplayerProductId: true,
      isFirstEdition: true,
      baseCardId: true,
      sets: {
        select: {
          setId: true,
        },
      },
    },
    orderBy: [{ code: "asc" }, { id: "asc" }],
  });

  return cards.map((card) => ({
    id: card.id,
    code: card.code,
    name: card.name,
    src: card.src,
    region: card.region,
    tcgplayerProductId: card.tcgplayerProductId,
    isFirstEdition: card.isFirstEdition,
    baseCardId: card.baseCardId,
    setIds: card.sets.map((entry) => entry.setId),
  }));
}

function groupByKey<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }
  return map;
}

export async function reconcileLimitlessSetMembership(
  options: ReconcileLimitlessSetOptions
): Promise<LimitlessSetReconciliation> {
  const snapshot = await scrapeLimitlessSetMembership(options.setUrlOrSlug);
  const dbSet = await resolveDbSet(snapshot, options.dbSetId);
  if (!dbSet?.setId) {
    return {
      snapshot,
      dbSet,
      dbSetCardCount: 0,
      matchedByProductId: [],
      matchedByCodeOnly: [],
      missing: snapshot.cards.map((card) => ({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "missing-in-db",
        candidateCardIds: [],
      })),
      wrongSet: [],
      extraInDbSet: [],
    };
  }

  const [dbSetCards, dbCandidates] = await Promise.all([
    loadDbCardsForSet(dbSet.setId, options.region),
    loadDbCandidates(snapshot, options.region),
  ]);

  const setByProductId = groupByKey(dbSetCards, (card) => card.tcgplayerProductId);
  const setByCode = groupByKey(dbSetCards, (card) => card.code);
  const globalByProductId = groupByKey(dbCandidates, (card) => card.tcgplayerProductId);
  const globalByCode = groupByKey(dbCandidates, (card) => card.code);

  const matchedByProductId: LimitlessMembershipMatch[] = [];
  const matchedByCodeOnly: LimitlessMembershipMatch[] = [];
  const missing: LimitlessMissingMembership[] = [];
  const wrongSet: LimitlessMissingMembership[] = [];
  const matchedSetCardIds = new Set<number>();
  const consumedCandidateCardIds = new Set<number>();

  for (const card of snapshot.cards) {
    const productKey = card.currentPrintProductId
      ? String(card.currentPrintProductId)
      : null;
    const inSetByProductId = (productKey ? setByProductId.get(productKey) ?? [] : []).filter(
      (entry) => !consumedCandidateCardIds.has(entry.id)
    );
    const globalByProduct = (productKey ? globalByProductId.get(productKey) ?? [] : []).filter(
      (entry) => !consumedCandidateCardIds.has(entry.id)
    );
    const inSetByCode = (setByCode.get(card.code) ?? []).filter(
      (entry) => !consumedCandidateCardIds.has(entry.id)
    );
    const globalByCodeMatches = (globalByCode.get(card.code) ?? []).filter(
      (entry) => !consumedCandidateCardIds.has(entry.id)
    );

    if (inSetByProductId.length === 1) {
      matchedByProductId.push({
        code: card.code,
        cardUrl: card.cardUrl,
        imageUrl: card.imageUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        card: inSetByProductId[0],
      });
      matchedSetCardIds.add(inSetByProductId[0].id);
      consumedCandidateCardIds.add(inSetByProductId[0].id);
      continue;
    }

    if (inSetByProductId.length > 1) {
      missing.push({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "ambiguous-product-id",
        candidateCardIds: inSetByProductId.map((entry) => entry.id),
      });
      continue;
    }

    if (inSetByCode.length === 1) {
      matchedByCodeOnly.push({
        code: card.code,
        cardUrl: card.cardUrl,
        imageUrl: card.imageUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        card: inSetByCode[0],
      });
      matchedSetCardIds.add(inSetByCode[0].id);
      consumedCandidateCardIds.add(inSetByCode[0].id);
      continue;
    }

    if (inSetByCode.length > 1) {
      missing.push({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "ambiguous-code",
        candidateCardIds: inSetByCode.map((entry) => entry.id),
      });
      continue;
    }

    if (globalByProduct.length === 1) {
      wrongSet.push({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "missing-in-set",
        candidateCardIds: globalByProduct.map((entry) => entry.id),
      });
      continue;
    }

    if (globalByProduct.length > 1) {
      wrongSet.push({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "ambiguous-product-id",
        candidateCardIds: globalByProduct.map((entry) => entry.id),
      });
      continue;
    }

    if (globalByCodeMatches.length > 0) {
      wrongSet.push({
        code: card.code,
        name: card.name,
        cardUrl: card.cardUrl,
        printTitle: card.currentPrintTitle,
        productId: card.currentPrintProductId,
        reason: "missing-in-set",
        candidateCardIds: globalByCodeMatches.map((entry) => entry.id),
      });
      continue;
    }

    missing.push({
      code: card.code,
      name: card.name,
      cardUrl: card.cardUrl,
      printTitle: card.currentPrintTitle,
      productId: card.currentPrintProductId,
      reason: "missing-in-db",
      candidateCardIds: [],
    });
  }

  // Extras que el usuario YA aceptó/ignoró para este set no se vuelven a listar.
  const ignoredExtraCardIds = new Set<number>();
  try {
    const existingReview = await prisma.limitlessSetReview.findUnique({
      where: { slug_region: { slug: snapshot.slug, region: "US" } },
      select: {
        items: {
          where: {
            kind: LimitlessReviewItemKind.EXTRA,
            decisionStatus: LimitlessDecisionStatus.IGNORED,
          },
          select: { matchedCardId: true },
        },
      },
    });
    for (const item of existingReview?.items ?? []) {
      if (item.matchedCardId != null) ignoredExtraCardIds.add(item.matchedCardId);
    }
  } catch {
    // sin review previo: nada que ignorar
  }

  const extraInDbSet = dbSetCards.filter(
    (card) => !matchedSetCardIds.has(card.id) && !ignoredExtraCardIds.has(card.id)
  );

  return {
    snapshot,
    dbSet,
    dbSetCardCount: dbSetCards.length,
    matchedByProductId,
    matchedByCodeOnly,
    missing,
    wrongSet,
    extraInDbSet,
  };
}

export async function persistLimitlessMembershipSources(
  report: LimitlessSetReconciliation
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const matches = report.matchedByProductId;

  for (const match of matches) {
    const source = "limitless";
    const sourceId = `${report.snapshot.slug}:${match.code}:v${match.productId ?? "unknown"}`;
    const sourceImageUrl = match.cardUrl;
    const existing = await prisma.cardSource.findFirst({
      where: {
        source,
        sourceId,
        sourceImageUrl,
      },
      select: {
        id: true,
        cardId: true,
      },
    });

    if (existing) {
      if (existing.cardId !== match.card.id) {
        await prisma.cardSource.update({
          where: { id: existing.id },
          data: {
            cardId: match.card.id,
            offerType: "set-membership",
          },
        });
      }
      updated += 1;
      continue;
    }

    await prisma.cardSource.create({
      data: {
        cardId: match.card.id,
        source,
        sourceId,
        sourceImageUrl,
        offerType: "set-membership",
      },
    });
    created += 1;
  }

  return { created, updated };
}

export async function persistLimitlessSetReview(
  report: LimitlessSetReconciliation,
  category?: string | null
) {
  const review = await prisma.limitlessSetReview.upsert({
    where: {
      slug_region: {
        slug: report.snapshot.slug,
        region: "US",
      },
    },
    update: {
      sourceUrl: report.snapshot.sourceUrl,
      sourceTitle: report.snapshot.title,
      sourceCategory: category ?? null,
      dbSetId: report.dbSet?.setId ?? null,
      declaredCount: report.snapshot.declaredCardCount,
      dbSetCardCount: report.dbSetCardCount,
      matchedCount:
        report.matchedByProductId.length + report.matchedByCodeOnly.length,
      wrongSetCount: report.wrongSet.length,
      missingCount: report.missing.length,
      extraCount: report.extraInDbSet.length,
      snapshotJson: report.snapshot as unknown as object,
      status:
        report.wrongSet.length || report.missing.length || report.extraInDbSet.length
          ? LimitlessReviewStatus.PENDING
          : LimitlessReviewStatus.REVIEWED,
      lastSyncedAt: new Date(),
    },
    create: {
      slug: report.snapshot.slug,
      sourceUrl: report.snapshot.sourceUrl,
      sourceTitle: report.snapshot.title,
      sourceCategory: category ?? null,
      region: "US",
      dbSetId: report.dbSet?.setId ?? null,
      declaredCount: report.snapshot.declaredCardCount,
      dbSetCardCount: report.dbSetCardCount,
      matchedCount:
        report.matchedByProductId.length + report.matchedByCodeOnly.length,
      wrongSetCount: report.wrongSet.length,
      missingCount: report.missing.length,
      extraCount: report.extraInDbSet.length,
      snapshotJson: report.snapshot as unknown as object,
      status:
        report.wrongSet.length || report.missing.length || report.extraInDbSet.length
          ? LimitlessReviewStatus.PENDING
          : LimitlessReviewStatus.REVIEWED,
      lastSyncedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
      status: true,
    },
  });

  // Conserva los EXTRA que el usuario aceptó/ignoró (para que no reaparezcan);
  // el reconcile ya los excluye del reporte, así que no se duplican.
  await prisma.limitlessSetReviewItem.deleteMany({
    where: {
      reviewId: review.id,
      NOT: {
        kind: LimitlessReviewItemKind.EXTRA,
        decisionStatus: LimitlessDecisionStatus.IGNORED,
      },
    },
  });

  const items = [
    ...report.matchedByProductId.map((item) => ({
      reviewId: review.id,
      kind: LimitlessReviewItemKind.MATCH_PRODUCT,
      decisionStatus: LimitlessDecisionStatus.APPLIED,
      code: item.code,
      name: item.card.name,
      printTitle: item.printTitle,
      cardUrl: item.cardUrl,
      productId: item.productId,
      matchedCardId: item.card.id,
      candidateCardIds: [item.card.id],
      metadataJson: item as unknown as object,
    })),
    ...report.matchedByCodeOnly.map((item) => ({
      reviewId: review.id,
      kind: LimitlessReviewItemKind.MATCH_CODE,
      decisionStatus: LimitlessDecisionStatus.PENDING,
      code: item.code,
      name: item.card.name,
      printTitle: item.printTitle,
      cardUrl: item.cardUrl,
      productId: item.productId,
      matchedCardId: item.card.id,
      candidateCardIds: [item.card.id],
      metadataJson: item as unknown as object,
    })),
    ...report.missing.map((item) => ({
      reviewId: review.id,
      kind: LimitlessReviewItemKind.MISSING,
      decisionStatus: LimitlessDecisionStatus.PENDING,
      code: item.code,
      name: item.name,
      printTitle: item.printTitle,
      cardUrl: item.cardUrl,
      productId: item.productId,
      matchedCardId: null,
      candidateCardIds: item.candidateCardIds,
      metadataJson: item as unknown as object,
    })),
    ...report.wrongSet.map((item) => ({
      reviewId: review.id,
      kind: LimitlessReviewItemKind.WRONG_SET,
      decisionStatus: LimitlessDecisionStatus.PENDING,
      code: item.code,
      name: item.name,
      printTitle: item.printTitle,
      cardUrl: item.cardUrl,
      productId: item.productId,
      matchedCardId:
        item.candidateCardIds.length === 1 ? item.candidateCardIds[0] : null,
      candidateCardIds: item.candidateCardIds,
      metadataJson: item as unknown as object,
    })),
    ...report.extraInDbSet.map((item) => ({
      reviewId: review.id,
      kind: LimitlessReviewItemKind.EXTRA,
      decisionStatus: LimitlessDecisionStatus.PENDING,
      code: item.code,
      name: item.name,
      printTitle: null,
      cardUrl: null,
      productId: item.tcgplayerProductId ? Number(item.tcgplayerProductId) : null,
      matchedCardId: item.id,
      candidateCardIds: [item.id],
      metadataJson: item as unknown as object,
    })),
  ];

  if (items.length) {
    await prisma.limitlessSetReviewItem.createMany({
      data: items,
    });
  }

  return review;
}

export async function syncLimitlessCatalogReviews(
  options: SyncLimitlessCatalogOptions = {}
) {
  const feed = await getLimitlessCatalogFeed({
    region: options.region ?? "US",
    staleHours: options.staleHours ?? 24,
  });
  const filtered = feed.entries.filter((entry) => {
    if (options.category && options.category !== "all" && entry.category !== options.category) {
      return false;
    }
    if (options.slugs?.length && !options.slugs.includes(entry.slug)) {
      return false;
    }
    if (options.forceAll) {
      return true;
    }
    if (options.newOnly && !entry.isNew) {
      return false;
    }
    if (!options.newOnly && options.staleHours != null && !entry.needsSync) {
      return false;
    }
    return true;
  });

  const limited =
    options.limit && Number.isFinite(options.limit)
      ? filtered.slice(0, Math.max(1, options.limit))
      : filtered;

  const results: Array<{
    slug: string;
    ok: boolean;
    reviewId?: number;
    error?: string;
    wrongSetCount?: number;
    missingCount?: number;
    extraCount?: number;
  }> = [];

  for (const entry of limited) {
    try {
      const report = await reconcileLimitlessSetMembership({
        setUrlOrSlug: entry.url,
        region: options.region ?? "US",
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
    } catch (error: any) {
      results.push({
        slug: entry.slug,
        ok: false,
        error: error?.message ?? "Unknown error",
      });
    }
  }

  return {
    discovered: feed.stats.total,
    eligible: filtered.length,
    total: limited.length,
    synced: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}
