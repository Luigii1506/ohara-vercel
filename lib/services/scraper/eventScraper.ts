import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "../../prisma";
import {
  setCodes as rawSetCodes,
  standarDecks as rawStandardDecks,
} from "../../../helpers/constants";
import {
  EventRegion,
  EventStatus,
  EventType,
  EventCategory,
} from "@prisma/client";
import {
  HeadingTranslationService,
  TranslationConfig,
  TranslationStats,
} from "./translation";
import { translateWithDictionary } from "./localeDictionary";

type EventListSourceType = "current" | "past";

export type RenderMode = "static" | "auto" | "force";

export interface EventListSource {
  url: string;
  label?: string;
  type?: EventListSourceType;
  limit?: number;
  region?: EventRegion;
  locale?: string;
  requiresDynamicRendering?: boolean;
}

interface EventListEntry {
  url: string;
  thumbnail?: string | null;
}

export interface ScrapedEvent {
  title: string;
  description: string | null;
  content: string | null;
  originalContent: string | null;
  region: EventRegion;
  locale: string;
  status: EventStatus;
  eventType: EventType;
  category: EventCategory | null;
  startDate: Date | null;
  endDate: Date | null;
  rawDateText: string | null;
  location: string | null;
  sourceUrl: string;
  eventThumbnail: string | null;
  imageUrl: string | null;
  detectedSets: DetectedSetCandidate[];
  detectedCards: DetectedCardCandidate[];
}

interface RenderOptions {
  mode: RenderMode;
  waitMs: number;
}

interface DetectSetsOptions {
  locale?: string;
  translator?: HeadingTranslationService | null;
}

interface SetDetectionContext {
  locale: string;
  primaryKeywords: string[];
  bannedKeywords: string[];
  noisePrefixes: string[];
  localeBannedKeywords: string[];
}

interface CachedSet {
  id: number;
  title: string;
  code: string | null;
  normalizedTitle: string;
  versionSignature: string | null;
}

interface ScrapeEventDetailOptions {
  regionOverride?: EventRegion;
  locale: string;
  render: RenderOptions;
  translator?: HeadingTranslationService | null;
  listThumbnail?: string | null;
}

interface ScrapeResult {
  success: boolean;
  eventsProcessed: number;
  setsLinked: number;
  errors: string[];
  events: Array<{
    slug: string;
    title: string;
    isApproved?: boolean;
    sets: Array<{
      id: number;
      title: string;
      match: string;
    }>;
    dryRun?: boolean;
    region: EventRegion;
    locale?: string;
    status: EventStatus;
    eventType: EventType;
    category: EventCategory | null;
    startDate: string | null;
    endDate: string | null;
    rawDateText: string | null;
    location: string | null;
    sourceUrl: string;
    eventThumbnail?: string | null;
    imageUrl?: string | null;
    missingSets: Array<{
      title: string;
      translatedTitle?: string;
      images: string[];
      versionSignature?: string | null;
    }>;
    cards: Array<{
      code: string;
      title: string;
      image: string | null;
    }>;
  }>;
  translation?: TranslationStats;
  renderMode?: RenderMode;
}

interface MatchedSet {
  id: number;
  title: string;
  matchedText: string;
}

interface DetectedSetCandidate {
  title: string;
  images: string[];
  versionSignature: string | null;
  translatedTitle?: string;
}

interface DetectedCardCandidate {
  code: string;
  title: string;
  image: string | null;
  translatedTitle?: string;
}

export interface ScrapeEventsOptions {
  sources?: EventListSource[];
  maxEvents?: number;
  perSourceLimit?: number;
  delayMs?: number;
  dryRun?: boolean;
  renderMode?: RenderMode;
  renderWaitMs?: number;
  translation?: TranslationConfig;
}

// Palabras clave para detectar sets conocidos
const SET_KEYWORDS = [
  "Tournament Pack",
  "Promotion Pack",
  "Booster Pack",
  "Standard Battle Pack",
  "Premium Card Collection",
  "Starter Deck",
  "Event Pack",
  "Winner Pack",
  "Judge Pack",
  "Participation Pack",
  "Celebration Pack",
  "Card Set",
  "Sleeve",
  "OP-",
  "ST-",
  "PRB-",
  "P-",
];

const CURRENT_EVENTS_URL = "https://en.onepiece-cardgame.com/events/list.php";
const PAST_EVENTS_URL = "https://en.onepiece-cardgame.com/events/list_end.php";

const FRENCH_CURRENT_EVENTS_URL =
  "https://fr.onepiece-cardgame.com/events/list.php";
const FRENCH_PAST_EVENTS_URL =
  "https://fr.onepiece-cardgame.com/events/list_end.php";

const JAPANESE_CURRENT_EVENTS_URL =
  "https://www.onepiece-cardgame.com/events/list.php";
const JAPANESE_PAST_EVENTS_URL =
  "https://www.onepiece-cardgame.com/events/list_end.php";

export interface LanguageEventSourceConfig {
  locale: string;
  current?: EventListSource;
  past?: EventListSource;
  notes?: string;
  requiresDynamicRendering?: boolean;
}

const EVENT_LANGUAGE_SOURCE_MAP: Record<
  string,
  LanguageEventSourceConfig
> = {
  en: {
    locale: "en",
    current: {
      url: CURRENT_EVENTS_URL,
      label: "global-current",
      type: "current",
      region: EventRegion.NA,
    },
    past: {
      url: PAST_EVENTS_URL,
      label: "global-past",
      type: "past",
      limit: 20,
      region: EventRegion.NA,
    },
  },
  fr: {
    locale: "fr",
    current: {
      url: FRENCH_CURRENT_EVENTS_URL,
      label: "fr-current",
      type: "current",
      region: EventRegion.EU,
    },
    past: {
      url: FRENCH_PAST_EVENTS_URL,
      label: "fr-past",
      type: "past",
      limit: 20,
      region: EventRegion.EU,
    },
  },
  jp: {
    locale: "jp",
    current: {
      url: JAPANESE_CURRENT_EVENTS_URL,
      label: "jp-current",
      type: "current",
      region: EventRegion.JP,
    },
    past: {
      url: JAPANESE_PAST_EVENTS_URL,
      label: "jp-past",
      type: "past",
      limit: 20,
      region: EventRegion.JP,
    },
  },
  asia: {
    locale: "asia",
    current: {
      url: "https://asia-en.onepiece-cardgame.com/events/",
      label: "asia-current",
      type: "current",
      region: EventRegion.ASIA,
    },
    notes: "Asia region site does not expose a dedicated past-events list.",
  },
  cn: {
    locale: "cn",
    current: {
      url: "https://www.onepiece-cardgame.cn/activity",
      label: "cn-activity",
      type: "current",
      region: EventRegion.ASIA,
    },
    requiresDynamicRendering: true,
    notes:
      "Simplified Chinese site renders content via JavaScript. Static scraping may not capture events without headless browser support.",
  },
};

export const LANGUAGE_EVENT_SOURCES: Record<
  string,
  LanguageEventSourceConfig
> = EVENT_LANGUAGE_SOURCE_MAP;

Object.values(LANGUAGE_EVENT_SOURCES).forEach((config) => {
  if (config.current) {
    config.current.locale = config.locale;
    if (config.requiresDynamicRendering) {
      config.current.requiresDynamicRendering = true;
    }
  }
  if (config.past) {
    config.past.locale = config.locale;
    if (config.requiresDynamicRendering) {
      config.past.requiresDynamicRendering = true;
    }
  }
});

const DOMAIN_REGION_OVERRIDES = new Map<string, EventRegion>();
const DOMAIN_LOCALE_OVERRIDES = new Map<string, string>();
const HEADLESS_REQUIRED_HOSTS = new Set<string>();
const WARNED_RENDER_HOSTS = new Set<string>();

function registerDomainMetadata(source?: EventListSource) {
  if (!source) return;
  try {
    const host = new URL(source.url).hostname.toLowerCase();

    if (source.region && !DOMAIN_REGION_OVERRIDES.has(host)) {
      DOMAIN_REGION_OVERRIDES.set(host, source.region);
    }

    if (source.locale && !DOMAIN_LOCALE_OVERRIDES.has(host)) {
      DOMAIN_LOCALE_OVERRIDES.set(host, source.locale);
    }

    if (source.requiresDynamicRendering) {
      HEADLESS_REQUIRED_HOSTS.add(host);
    }
  } catch {
    // ignore invalid URLs
  }
}

Object.values(LANGUAGE_EVENT_SOURCES).forEach((config) => {
  registerDomainMetadata(config.current);
  registerDomainMetadata(config.past);
});

function getRegionOverrideForUrl(
  eventUrl: string
): EventRegion | undefined {
  try {
    const host = new URL(eventUrl).hostname.toLowerCase();
    return DOMAIN_REGION_OVERRIDES.get(host);
  } catch {
    return undefined;
  }
}

function getLocaleOverrideForUrl(eventUrl: string): string | undefined {
  try {
    const host = new URL(eventUrl).hostname.toLowerCase();
    return DOMAIN_LOCALE_OVERRIDES.get(host);
  } catch {
    return undefined;
  }
}

function requiresHeadlessForUrl(eventUrl: string): boolean {
  try {
    const host = new URL(eventUrl).hostname.toLowerCase();
    return HEADLESS_REQUIRED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function warnIfRenderDisabled(url: string, render: RenderOptions) {
  if (render.mode !== "static") return;
  if (!requiresHeadlessForUrl(url)) return;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (WARNED_RENDER_HOSTS.has(host)) return;
    WARNED_RENDER_HOSTS.add(host);
    console.warn(
      `⚠️  Host "${host}" requires dynamic rendering. Re-run with --render to enable headless mode.`
    );
  } catch {
    // ignore
  }
}

function extractListThumbnail(
  $: cheerio.CheerioAPI,
  anchor: cheerio.Cheerio<any>,
  baseUrl: string
): string | null {
  const container =
    anchor.closest(".eventDetail").length > 0
      ? anchor.closest(".eventDetail")
      : anchor.parent();

  if (container && container.length > 0) {
    const img = container
      .find(".eventThumnail img, .eventThumbnail img, img.eventThumnail, img.eventThumbnail")
      .first();
    if (img.length) {
      const resolved = resolveImageUrl(img.attr("src"), baseUrl);
      if (resolved) {
        return resolved;
      }
    }
  }

  const fallbackImg = anchor.find("img").first();
  if (fallbackImg.length) {
    const resolved = resolveImageUrl(fallbackImg.attr("src"), baseUrl);
    if (resolved) return resolved;
  }

  return null;
}


async function fetchStaticHtml(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    timeout: 20000,
  });

  return response.data;
}

async function fetchDynamicHtml(
  url: string,
  waitMs: number
): Promise<string> {
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchPageHtml(
  url: string,
  render: RenderOptions
): Promise<string | null> {
  const shouldUseHeadless =
    render.mode === "force" ||
    (render.mode === "auto" && requiresHeadlessForUrl(url));

  if (shouldUseHeadless) {
    try {
      return await fetchDynamicHtml(url, render.waitMs);
    } catch (error) {
      console.warn(
        `⚠️  Headless fetch failed for ${url}. Falling back to static request.`,
        error
      );
    }
  } else {
    warnIfRenderDisabled(url, render);
  }

  try {
    return await fetchStaticHtml(url);
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error);
    return null;
  }
}

export const DEFAULT_EVENT_LIST_SOURCES: EventListSource[] = [
  EVENT_LANGUAGE_SOURCE_MAP.en.current!,
];

export const PAST_EVENT_LIST_SOURCE: EventListSource =
  EVENT_LANGUAGE_SOURCE_MAP.en.past!;

const DEFAULT_MAX_EVENTS = 25;
const DEFAULT_PER_SOURCE_LIMIT = 25;
const DEFAULT_REQUEST_DELAY_MS = 1000;
const DEFAULT_RENDER_MODE: RenderMode = "static";
const DEFAULT_RENDER_WAIT_MS = 2000;

let cachedSetsPromise: Promise<CachedSet[]> | null = null;
const SET_CODES: string[] = (rawSetCodes as string[]) || [];
const STANDARD_DECK_CODES: string[] = (rawStandardDecks as string[]) || [];
const PROMO_CODE_PREFIXES: string[] = ["P"];
const NORMALIZED_SET_CODES = SET_CODES.map((code) => code.toLowerCase());
const CARD_CODE_PREFIXES = [
  ...SET_CODES,
  ...STANDARD_DECK_CODES,
  ...PROMO_CODE_PREFIXES,
];
const MIN_MATCH_ABSOLUTE_LENGTH = 3;
const MIN_MATCH_RATIO = 0.6;

const PRIZE_SECTION_KEYWORDS = [
  "prize",
  "prizes",
  "participation",
  "winner",
  "distribution",
  "reward",
  "kit",
];

const JAPANESE_SET_KEYWORDS = [
  "パック",
  "配布",
  "記念品",
  "スリーブ",
  "カードセット",
  "セット",
  "プロモーション",
  "プレイマット",
  "カードコレクション",
  "プレミアム",
  "マット",
];

const BASE_SET_TEXT_HINTS = [
  "pack",
  "deck",
  "sleeve",
  "card set",
  "collection",
  "promotion",
  "celebration",
  "winner",
  "judge",
  "participation",
  "event",
  "trophy",
  "top player",
  "finalist",
  "set",
  "playmat",
  "uncut sheet",
  ...JAPANESE_SET_KEYWORDS,
];

const BASE_SET_INDICATOR_KEYWORDS = [
  "pack",
  "event",
  "judge",
  "top player",
  "finalist",
  "trophy",
  "set",
  "sleeve",
  "promotion",
  "playmat",
  "uncut sheet",
  ...JAPANESE_SET_KEYWORDS,
];

const ALL_SET_HINTS = Array.from(
  new Set([
    ...BASE_SET_TEXT_HINTS,
    ...BASE_SET_INDICATOR_KEYWORDS,
    ...JAPANESE_SET_KEYWORDS,
  ])
);

const BASE_SET_PRIMARY_KEYWORDS = [
  "pack",
  "set",
  "deck",
  "sleeve",
  "collection",
  "promotion",
  "trophy",
  "playmat",
  "uncut sheet",
  ...JAPANESE_SET_KEYWORDS,
];

const BASE_SET_BANNED_KEYWORDS = ["booster pack"];

const LOCALE_BANNED_KEYWORDS: Record<string, string[]> = {
  jp: ["ブースターパック"],
  ja: ["ブースターパック"],
  japan: ["ブースターパック"],
};

const LOCALE_SPECIFIC_SET_KEYWORDS: Record<string, string[]> = {
  jp: JAPANESE_SET_KEYWORDS,
  ja: JAPANESE_SET_KEYWORDS,
  japan: JAPANESE_SET_KEYWORDS,
};

const LOCALE_NOISE_PREFIXES: Record<string, string[]> = {
  jp: [
    "one pieceカードゲーム",
    "one piece カードゲーム",
    "ワンピースカードゲーム",
  ],
  ja: [
    "one pieceカードゲーム",
    "one piece カードゲーム",
    "ワンピースカードゲーム",
  ],
  japan: [
    "one pieceカードゲーム",
    "one piece カードゲーム",
    "ワンピースカードゲーム",
  ],
};

const SET_TEXT_STOP_PHRASES = [
  "featured card list",
  "this set will",
  "while supplies last",
  "kit contents change",
  "please note",
  "details",
  "includes",
  "card per pack",
];

const SET_NOISE_PREFIXES = [
  "participation",
  "winner",
  "judge",
  "compensation",
  "event",
  "celebration",
  "prize",
  "reward",
  "distribution",
  "kit",
];

// Mapeo de regiones
const REGION_MAP: Record<string, EventRegion> = {
  "north america": EventRegion.NA,
  na: EventRegion.NA,
  usa: EventRegion.NA,
  "united states": EventRegion.NA,
  europe: EventRegion.EU,
  eu: EventRegion.EU,
  "latin america": EventRegion.LA,
  la: EventRegion.LA,
  latam: EventRegion.LA,
  asia: EventRegion.ASIA,
  japan: EventRegion.JP,
  jp: EventRegion.JP,
};

// Mapeo de tipos de eventos
const EVENT_TYPE_MAP: Record<string, EventType> = {
  "store tournament": EventType.STORE_TOURNAMENT,
  championship: EventType.CHAMPIONSHIP,
  "release event": EventType.RELEASE_EVENT,
  online: EventType.ONLINE,
};

const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
  beginner: EventCategory.BEGINNER,
  beginners: EventCategory.BEGINNER,
  rookie: EventCategory.ROOKIES,
  rookies: EventCategory.ROOKIES,
  intermediate: EventCategory.INTERMEDIATE,
  competitive: EventCategory.COMPETITIVE,
  competetive: EventCategory.COMPETITIVE,
};

/**
 * Genera un slug único basado en el título y región
 */
function generateSlug(
  title: string,
  region: EventRegion,
  sourceUrl: string
): string {
  const urlSlug = sourceUrl.split("/").pop()?.replace(".php", "") || "";
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);

  return `${region.toLowerCase()}-${titleSlug}-${urlSlug}`.replace(/--+/g, "-");
}

/**
 * Detecta la región del evento basado en el texto
 */
function detectRegion(text: string): EventRegion {
  const lowerText = text.toLowerCase();

  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (lowerText.includes(key)) {
      return region;
    }
  }

  return EventRegion.GLOBAL;
}

/**
 * Detecta el tipo de evento basado en el texto
 */
function detectEventType(text: string): EventType {
  const lowerText = text.toLowerCase();

  for (const [key, type] of Object.entries(EVENT_TYPE_MAP)) {
    if (lowerText.includes(key)) {
      return type;
    }
  }

  return EventType.OTHER;
}

function detectEventCategory(text: string | null): EventCategory | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  for (const [key, value] of Object.entries(EVENT_CATEGORY_MAP)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * Detecta el estado del evento basado en fechas
 */
function detectEventStatus(
  startDate: Date | null,
  endDate: Date | null
): EventStatus {
  const now = new Date();

  if (!startDate) return EventStatus.UPCOMING;

  if (startDate > now) return EventStatus.UPCOMING;

  if (endDate && endDate < now) return EventStatus.COMPLETED;

  if (startDate <= now && (!endDate || endDate >= now)) {
    return EventStatus.ONGOING;
  }

  return EventStatus.UPCOMING;
}

function applySetSemanticReplacements(value: string): string {
  let result = value.toLowerCase().replace(/[–—−]/g, "-");

  result = result.replace(/season\s*(\d+)/g, "vol$1");
  result = result.replace(/vol\.\s*(\d+)/g, "vol$1");

  result = result.replace(/(\d{2})-(\d{2})/g, (_, start) => {
    const startNum = parseInt(start, 10);
    if (Number.isNaN(startNum)) return start;
    const year = startNum >= 70 ? 1900 + startNum : 2000 + startNum;
    return year.toString();
  });

  return result;
}

function normalizeString(value: string | null | undefined): string {
  if (!value) return "";
  const semanticNormalized = applySetSemanticReplacements(value);
  return semanticNormalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9]+/g, "");
}

function stripVersionSuffix(value: string): string {
  if (!value) return "";
  let result = value;
  result = result.replace(
    /(season|ver|version|vol|volume|series|round)(\d{1,3})$/i,
    ""
  );
  result = result.replace(/(pack|set)(\d{1,3})$/i, "$1");
  result = result.replace(/(season|ver|version|vol|volume|series|round)$/i, "");
  result = result.replace(/([a-z])(\d{1,2})$/i, "$1");
  return result;
}

function isKnownSetCodeKeyword(value: string): boolean {
  const normalized = value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return NORMALIZED_SET_CODES.includes(normalized);
}

function hasSufficientOverlap(
  shorterLength: number,
  longerLength: number
): boolean {
  if (shorterLength < MIN_MATCH_ABSOLUTE_LENGTH) return false;
  if (longerLength === 0) return false;
  return shorterLength / longerLength >= MIN_MATCH_RATIO;
}

async function loadSetsCache(): Promise<CachedSet[]> {
  if (!cachedSetsPromise) {
    cachedSetsPromise = prisma.set
      .findMany({
        select: {
          id: true,
          title: true,
          code: true,
        },
      })
      .then((sets) =>
        sets.map((set) => ({
          id: set.id,
          title: set.title,
          code: set.code,
          normalizedTitle: normalizeString(set.title),
          versionSignature: extractVersionSignature(set.title),
        }))
      );
  }

  return cachedSetsPromise;
}

/**
 * Parsea fechas del texto del evento
 */
function parseDates(text: string | null | undefined): {
  startDate: Date | null;
  endDate: Date | null;
} {
  if (!text) return { startDate: null, endDate: null };

  const normalized = text
    .replace(/[\u2013\u2014–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return { startDate: null, endDate: null };

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const monthMap = monthNames.reduce<Record<string, number>>((acc, month, idx) => {
    acc[month] = idx;
    return acc;
  }, {});

  const monthRegex = monthNames.join("|");
  const ordinalRegex = /(?:st|nd|rd|th)/i;
  const parseDay = (value: string | undefined, fallback = 1) =>
    value ? parseInt(value.replace(ordinalRegex, ""), 10) : fallback;
  const getLastDay = (year: number, monthIndex: number) =>
    new Date(year, monthIndex + 1, 0).getDate();
  const createDate = (
    year: number | null,
    monthIndex: number | undefined,
    day: number | null
  ) => {
    if (year == null || monthIndex == null || day == null) return null;
    return new Date(year, monthIndex, day);
  };

  const lower = normalized.toLowerCase();

  // Case: "January 1 - March 31, 2026"
  const rangeSingleYear = new RegExp(
    `(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*-\\s*(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})`,
    "i"
  );
  const singleYearMatch = lower.match(rangeSingleYear);
  if (singleYearMatch) {
    const [, startMonth, startDay, endMonth, endDay, yearStr] = singleYearMatch;
    const year = parseInt(yearStr, 10);
    const startDate = createDate(year, monthMap[startMonth], parseDay(startDay));
    const endDate = createDate(year, monthMap[endMonth], parseDay(endDay));
    return { startDate, endDate };
  }

  // Case: "January 2025 - March 2025" (month/year range)
  const monthYearRange = new RegExp(
    `(${monthRegex})\\s+(\\d{4})\\s*-\\s*(${monthRegex})\\s+(\\d{4})`,
    "i"
  );
  const monthYearMatch = lower.match(monthYearRange);
  if (monthYearMatch) {
    const [, startMonth, startYearStr, endMonth, endYearStr] = monthYearMatch;
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);
    const startDate = createDate(startYear, monthMap[startMonth], 1);
    const endMonthIndex = monthMap[endMonth];
    const endDate = createDate(
      endYear,
      endMonthIndex,
      getLastDay(endYear, endMonthIndex)
    );
    return { startDate, endDate };
  }

  // Case: "January 1, 2026 - March 31, 2027"
  const fullRangePattern = new RegExp(
    `(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\s*-\\s*(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`,
    "i"
  );
  const fullRangeMatch = lower.match(fullRangePattern);
  if (fullRangeMatch) {
    const [,
      startMonth,
      startDay,
      startYearStr,
      endMonth,
      endDay,
      endYearStr,
    ] = fullRangeMatch;
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);
    const startDate = createDate(
      startYear,
      monthMap[startMonth],
      parseDay(startDay)
    );
    const endDate = createDate(
      endYear,
      monthMap[endMonth],
      parseDay(endDay)
    );
    return { startDate, endDate };
  }

  // Case: "January 2025 onwards" or "January 1, 2025 onwards"
  const onwardsPattern = new RegExp(
    `(${monthRegex})(?:\\s+(\\d{1,2})(?:st|nd|rd|th)?)?,?\\s+(\\d{4})\\s+(onwards|and beyond|~|to be continued)`,
    "i"
  );
  const onwardsMatch = lower.match(onwardsPattern);
  if (onwardsMatch) {
    const [, monthName, dayValue, yearValue] = onwardsMatch;
    const year = parseInt(yearValue, 10);
    const monthIndex = monthMap[monthName];
    const startDate = createDate(year, monthIndex, parseDay(dayValue));
    return { startDate, endDate: null };
  }

  // Fallback regexes used previously
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY
    /(\d{4})-(\d{2})-(\d{2})/g, // YYYY-MM-DD
    new RegExp(`(${monthRegex})\s+(\d{1,2}),?\s+(\d{4})`, "gi"),
  ];

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  for (const pattern of datePatterns) {
    const matches = normalized.match(pattern);
    if (matches && matches.length > 0) {
      startDate = new Date(matches[0]);
      if (matches.length > 1) {
        endDate = new Date(matches[1]);
      }
      break;
    }
  }

  return { startDate, endDate };
}

function extractLabeledText(
  $: cheerio.CheerioAPI,
  label: string
): string | null {
  const normalizedLabel = label.toLowerCase();
  const heading = $("h2, h3, h4, h5, h6")
    .filter(
      (_, element) => $(element).text().trim().toLowerCase() === normalizedLabel
    )
    .first();

  if (heading.length > 0) {
    const text = heading.nextAll("p").first().text().trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function cleanPeriodText(text: string | null): string | null {
  if (!text) return null;
  return text
    .replace(/^\s*period[:\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPeriodText($: cheerio.CheerioAPI): string | null {
  const inlinePeriod = $(".eventDate").first().text().trim();
  if (inlinePeriod) {
    return cleanPeriodText(inlinePeriod);
  }

  const labeledPeriod = extractLabeledText($, "Period");
  if (labeledPeriod) {
    return cleanPeriodText(labeledPeriod);
  }

  return null;
}

function extractLocationText($: cheerio.CheerioAPI): string | null {
  const inlineLocation = $(".eventPlace, .location, .venue")
    .first()
    .text()
    .trim();
  if (inlineLocation) {
    return inlineLocation;
  }

  return extractLabeledText($, "Location");
}

function buildSetDetectionContext(
  locale?: string
): SetDetectionContext {
  const normalized = (locale || "en").toLowerCase();
  const localeKey =
    normalized in LOCALE_SPECIFIC_SET_KEYWORDS
      ? normalized
      : normalized.split("-")[0];
  const localeKeywords =
    LOCALE_SPECIFIC_SET_KEYWORDS[localeKey] || [];
  const noisePrefixes =
    LOCALE_NOISE_PREFIXES[localeKey] || [];
  const localeBannedKeywords =
    LOCALE_BANNED_KEYWORDS[localeKey] || [];

  return {
    locale: normalized,
    primaryKeywords: Array.from(
      new Set([...BASE_SET_PRIMARY_KEYWORDS, ...localeKeywords])
    ),
    bannedKeywords: BASE_SET_BANNED_KEYWORDS,
    noisePrefixes,
    localeBannedKeywords,
  };
}

function shouldConsiderSetText(
  text: string,
  context: SetDetectionContext
): boolean {
  const lower = text.toLowerCase();
  if (
    context.bannedKeywords.some((keyword) => lower.includes(keyword))
  ) {
    return false;
  }
  if (
    context.localeBannedKeywords.some((keyword) =>
      lower.includes(keyword.toLowerCase())
    )
  ) {
    return false;
  }
  return context.primaryKeywords.some((keyword) =>
    lower.includes(keyword)
  );
}

function extractHeadingText($heading: cheerio.Cheerio<any>): string {
  const headingClone = $heading.clone();
  headingClone.find("span, ul, li, p").remove();
  headingClone.find("br").replaceWith(" ");
  return headingClone.text().replace(/\s+/g, " ").trim();
}

function cleanSetCandidate(
  value: string | null | undefined,
  context: SetDetectionContext
): string | null {
  if (!value) return null;
  let result = value.replace(/[•·・]/g, " ");
  result = result.replace(/\s+/g, " ");
  result = result.replace(/^[−–—\s·•・]+/, "");
  result = result.replace(/\b(x|×)\s*\d+\b/gi, "");
  result = result.replace(/[\u200B-\u200D\uFEFF]/g, "");
  result = result.replace(/(trophy)\s+card.*$/i, "$1");

  if (context.noisePrefixes.length > 0) {
    for (const prefix of context.noisePrefixes) {
      const trimmed = prefix.trim();
      if (!trimmed) continue;
      const regex = new RegExp(`^${escapeRegExp(trimmed)}\\s*`, "i");
      result = result.replace(regex, "");
    }
  }

  for (const phrase of SET_TEXT_STOP_PHRASES) {
    const regex = new RegExp(`${phrase}.*$`, "i");
    result = result.replace(regex, "");
  }

  result = result.replace(/\s+/g, " ").trim();

  const tokens = result.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    while (tokens.length > 1) {
      const first = tokens[0];
      const second = tokens[1];
      const firstLower = first.toLowerCase();
      const secondLower = second.toLowerCase();
      const secondIsPrimary = context.primaryKeywords.some((keyword) =>
        secondLower.includes(keyword)
      );

      if (firstLower === secondLower) {
        tokens.shift();
        continue;
      }

      if (SET_NOISE_PREFIXES.includes(firstLower) && !secondIsPrimary) {
        tokens.shift();
        continue;
      }

      break;
    }
  }

  result = canonicalizeSetDisplay(tokens.join(" "));

  if (result.startsWith("*")) {
    return null;
  }

  if (!result || result.length < 4) {
    return null;
  }

  return result.trim();
}

function canonicalizeSetDisplay(value: string): string {
  let result = value.normalize("NFKC");

  result = result.replace(/[\u2010-\u2015\u2212\uFF0D]/g, "-");
  result = result.replace(/\uFF70/g, "-");
  result = result.replace(/([0-9A-Za-z])ー([0-9A-Za-z])/g, "$1-$2");
  result = result.replace(/\s*-\s*/g, "-");
  result = result.replace(/\s*\(\s*/g, " (");
  result = result.replace(/\s*\)/g, ")");
  result = result.replace(
    /\(\s*([^)]+?)\s*\)/g,
    (_, inner) => `(${inner.replace(/\s+/g, " ").trim()})`
  );
  result = result.replace(/\)\(/g, ") (");
  result = result.replace(/(\d+)\s*pcs/gi, "$1 pcs");
  if ((result.match(/\(/g)?.length || 0) > (result.match(/\)/g)?.length || 0)) {
    result = result.replace(/\([^)]*$/, "");
  }
  result = result.replace(/\(\s*\d+\s*\)$/g, "");
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeCountParentheses(value: string): string {
  return value
    .replace(/\(\s*\d+\s*pcs?\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeTrailingParenPack(value: string): string {
  if (/\)\s+pack$/i.test(value)) {
    return value.replace(/\)\s+pack$/i, ")").trim();
  }
  return value;
}

function removeTrailingPackArtifacts(value: string): string {
  let result = value.replace(/-?pack$/i, "").trim();
  result = result.replace(/-$/, "").trim();
  return result;
}

function extractCardCode(
  text: string | undefined
): { code: string; match: string } | null {
  if (!text) return null;
  for (const setCode of CARD_CODE_PREFIXES) {
    const escaped = setCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b(${escaped})[-–—]?(\\d{2,3})\\b`, "i");
    const match = text.match(regex);
    if (match) {
      const prefix = match[1].toUpperCase();
      const number = match[2].padStart(2, "0");
      return {
        code: `${prefix}-${number}`,
        match: match[0],
      };
    }
  }
  return null;
}

function extractCardTitle(
  rawText: string,
  codeMatch: string,
  fallback?: string
): string {
  const cleaned = rawText
    .replace(codeMatch, "")
    .replace(/[\s:–-]+$/, "")
    .trim();
  if (cleaned.length > 0) {
    return cleaned;
  }
  return fallback?.trim() || "";
}

function dedupeMissingCandidates(
  candidates: DetectedSetCandidate[]
): DetectedSetCandidate[] {
  const map = new Map<string, DetectedSetCandidate>();
  const registerKeys = (candidate: DetectedSetCandidate, keys: string[]) => {
    keys.forEach((key) => {
      if (!map.has(key)) {
        map.set(key, candidate);
      } else if (map.get(key) !== candidate) {
        map.set(key, candidate);
      }
    });
  };

  const mergedCandidates: DetectedSetCandidate[] = [];

  for (const candidate of candidates) {
    const canonicalTitle = canonicalizeSetDisplay(candidate.title);
    const canonicalKey = canonicalTitle.toLowerCase();
    const countNormalized =
      removeCountParentheses(canonicalTitle).toLowerCase();
    const parenPackNormalized =
      removeTrailingParenPack(canonicalTitle).toLowerCase();
    const packArtifactNormalized =
      removeTrailingPackArtifacts(canonicalTitle).toLowerCase();
    const keys = [
      canonicalKey,
      countNormalized,
      parenPackNormalized,
      packArtifactNormalized,
    ];

    const existing =
      map.get(canonicalKey) ||
      map.get(countNormalized) ||
      map.get(parenPackNormalized) ||
      map.get(packArtifactNormalized);

    if (existing) {
      const images = new Set(existing.images);
      candidate.images.forEach((image) => images.add(image));
      existing.images = Array.from(images);
      existing.title = existing.title || canonicalTitle;
      if (!existing.versionSignature && candidate.versionSignature) {
        existing.versionSignature = candidate.versionSignature;
      }
      if (!existing.translatedTitle && candidate.translatedTitle) {
        existing.translatedTitle = candidate.translatedTitle;
      }
      registerKeys(existing, keys);
      continue;
    }

    const normalizedCandidate: DetectedSetCandidate = {
      title: canonicalTitle,
      images: Array.from(new Set(candidate.images)),
      versionSignature:
        candidate.versionSignature ?? extractVersionSignature(canonicalTitle),
      translatedTitle: candidate.translatedTitle,
    };

    registerKeys(normalizedCandidate, keys);
    mergedCandidates.push(normalizedCandidate);
  }

  return mergedCandidates;
}

function dedupeCardCandidates(
  candidates: DetectedCardCandidate[]
): DetectedCardCandidate[] {
  const map = new Map<string, DetectedCardCandidate>();
  for (const candidate of candidates) {
    const canonicalTitle = canonicalizeSetDisplay(
      candidate.title || ""
    ).toLowerCase();
    const key = `${candidate.code.toUpperCase()}|${canonicalTitle}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      if (!existing.image && candidate.image) {
        existing.image = candidate.image;
      }
      if (!existing.title && candidate.title) {
        existing.title = candidate.title;
      }
    } else {
      map.set(key, {
        code: candidate.code.toUpperCase(),
        title: candidate.title,
        image: candidate.image || null,
      });
    }
  }
  return Array.from(map.values());
}

async function syncEventMissingSetsInDb(
  eventId: number,
  candidates: DetectedSetCandidate[]
) {
  const titles = candidates.map((candidate) => candidate.title);

  if (titles.length === 0) {
    await prisma.eventMissingSet.deleteMany({
      where: { eventId },
    });
    await prisma.missingSet.deleteMany({
      where: {
        isApproved: false,
        events: { none: {} },
      },
    });
    return;
  }

  await prisma.eventMissingSet.deleteMany({
    where: {
      eventId,
      missingSet: {
        title: { notIn: titles },
      },
    },
  });

  for (const candidate of candidates) {
    const missingSet = await prisma.missingSet.upsert({
      where: { title: candidate.title },
      create: {
        title: candidate.title,
        translatedTitle: candidate.translatedTitle,
        versionSignature: candidate.versionSignature,
        imagesJson: candidate.images,
      },
      update: {
        translatedTitle: candidate.translatedTitle ?? undefined,
        versionSignature: candidate.versionSignature ?? undefined,
        imagesJson: candidate.images ?? undefined,
      },
    });

    if (missingSet.isApproved) {
      await prisma.eventMissingSet.deleteMany({
        where: {
          eventId,
          missingSetId: missingSet.id,
        },
      });
      continue;
    }

    await prisma.eventMissingSet.upsert({
      where: {
        eventId_missingSetId: {
          eventId,
          missingSetId: missingSet.id,
        },
      },
      create: {
        eventId,
        missingSetId: missingSet.id,
      },
      update: {},
    });
  }

  await prisma.missingSet.deleteMany({
    where: {
      isApproved: false,
      events: { none: {} },
    },
  });
}

async function syncEventMissingCardsInDb(
  eventId: number,
  candidates: DetectedCardCandidate[]
) {
  const codeTitlePairs = candidates.map(
    (candidate) => `${candidate.code}|${candidate.title}`
  );

  if (codeTitlePairs.length === 0) {
    await prisma.eventMissingCard.deleteMany({
      where: { eventId },
    });
    await prisma.missingCard.deleteMany({
      where: {
        isApproved: false,
        events: { none: {} },
      },
    });
    return;
  }

  // Delete EventMissingCard entries for cards no longer detected
  await prisma.eventMissingCard.deleteMany({
    where: {
      eventId,
      missingCard: {
        OR: [
          {
            code: {
              notIn: candidates.map((c) => c.code),
            },
          },
          {
            title: {
              notIn: candidates.map((c) => c.title),
            },
          },
        ],
      },
    },
  });

  for (const candidate of candidates) {
    const missingCard = await prisma.missingCard.upsert({
      where: {
        code_title: {
          code: candidate.code,
          title: candidate.title,
        },
      },
      create: {
        code: candidate.code,
        title: candidate.title,
        imageUrl: candidate.image || "",
      },
      update: {
        imageUrl: candidate.image || undefined,
      },
    });

    if (missingCard.isApproved) {
      await prisma.eventMissingCard.deleteMany({
        where: {
          eventId,
          missingCardId: missingCard.id,
        },
      });
      continue;
    }

    await prisma.eventMissingCard.upsert({
      where: {
        eventId_missingCardId: {
          eventId,
          missingCardId: missingCard.id,
        },
      },
      create: {
        eventId,
        missingCardId: missingCard.id,
      },
      update: {},
    });
  }

  await prisma.missingCard.deleteMany({
    where: {
      isApproved: false,
      events: { none: {} },
    },
  });
}

async function syncEventSetsInDb(
  eventId: number,
  matchedSets: MatchedSet[]
): Promise<number> {
  const matchedIds = matchedSets.map((set) => set.id);

  if (matchedIds.length === 0) {
    await prisma.eventSet.deleteMany({ where: { eventId } });
    return 0;
  }

  await prisma.eventSet.deleteMany({
    where: {
      eventId,
      setId: {
        notIn: matchedIds,
      },
    },
  });

  for (const matchedSet of matchedSets) {
    await prisma.eventSet.upsert({
      where: {
        eventId_setId: {
          eventId,
          setId: matchedSet.id,
        },
      },
      create: {
        eventId,
        setId: matchedSet.id,
      },
      update: {},
    });
  }

  return matchedSets.length;
}

function resolveImageUrl(
  src: string | undefined,
  baseUrl: string
): string | null {
  if (!src) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

function collectImagesAroundHeading(
  $heading: cheerio.Cheerio<any>,
  $scope: cheerio.Cheerio<any>,
  baseUrl: string
): { images: string[]; firstAlt?: string } {
  const imagesSet = new Set<string>();
  let firstAlt: string | undefined;
  const siblingRange = $heading.nextUntil("h5, h6");

  const scopedImages = siblingRange.find("img").add(siblingRange.filter("img"));

  let imageElements = scopedImages;

  if (imageElements.length === 0) {
    const nextPackCol = $heading
      .nextAll(".eventPackCol, .cardPackCol, .includecardBox")
      .first();

    if (nextPackCol.length > 0) {
      imageElements = nextPackCol.find("img");
    }
  }

  if (imageElements.length === 0) {
    imageElements = $scope.find("img").first();
  }

  imageElements.each((__, img) => {
    const attribs = (img as any)?.attribs || {};
    const resolved = resolveImageUrl(
      attribs.src as string | undefined,
      baseUrl
    );
    if (resolved) {
      imagesSet.add(resolved);
      if (
        !firstAlt &&
        typeof attribs.alt === "string" &&
        attribs.alt.trim().length
      ) {
        firstAlt = attribs.alt.trim();
      }
    }
  });

  return { images: Array.from(imagesSet), firstAlt };
}

async function detectSetsAndCards(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  options: DetectSetsOptions = {}
): Promise<{
  sets: DetectedSetCandidate[];
  cards: DetectedCardCandidate[];
}> {
  const setCandidates: DetectedSetCandidate[] = [];
  const cardCandidates: DetectedCardCandidate[] = [];
  const setContext = buildSetDetectionContext(options.locale);
  const translator = options.translator;

  const translateHeading = async (text: string): Promise<string> => {
    if (!translator) return text;
    const translated = await translator.translateHeading(
      text,
      setContext.locale
    );
    return translated || text;
  };

  const sections = $("section").toArray();

  for (const section of sections) {
    const classAttr = ($(section).attr("class") || "").toLowerCase();
    if (
      !classAttr.includes("contentsmcol") &&
      !classAttr.includes("contentslcol") &&
      !classAttr.includes("mtl")
    ) {
      continue;
    }

    const $section = $(section);
    const headings = $section.find("h5, h6");
    if (headings.length === 0) {
      continue;
    }

    const headingNodes = headings.toArray() as any[];
    const h6Nodes = headingNodes.filter((node) => {
      const tag = (
        $(node).prop("tagName") as string | undefined
      )?.toLowerCase();
      return tag === "h6";
    });

    const processNodes = async (nodes: any[]): Promise<boolean> => {
      let pushed = false;
      for (const node of nodes) {
        const $heading = $(node);
        const rawText = extractHeadingText($heading);

        const codeInfo =
          extractCardCode(rawText) || extractCardCode($section.attr("id"));

        const imageData = collectImagesAroundHeading(
          $heading,
          $section,
          baseUrl
        );

        if (codeInfo) {
          let cardTitle = extractCardTitle(
            rawText,
            codeInfo.match,
            imageData.firstAlt
          );
          if (!cardTitle && imageData.firstAlt) {
            cardTitle = imageData.firstAlt;
          } else if (!cardTitle && translator) {
            const translatedFallback = await translator.translateHeading(
              rawText,
              setContext.locale
            );
            if (translatedFallback) {
              cardTitle = translatedFallback;
            }
          }
          const dictionaryCardTitle = translateWithDictionary(
            cardTitle,
            setContext.locale
          );
          cardCandidates.push({
            code: codeInfo.code,
            title: cardTitle || codeInfo.code,
            image: imageData.images[0] || null,
            translatedTitle: dictionaryCardTitle || undefined,
          });
          pushed = true;
          continue;
        }

        const containsDon = /don!!|ドン!!/i.test(rawText);
        if (containsDon && !/pack/i.test(rawText)) {
          const donTitle = canonicalizeSetDisplay(rawText) || "DON!! Card";
          cardCandidates.push({
            code: "DON!!",
            title: donTitle,
            image: imageData.images[0] || null,
          });
          pushed = true;
          continue;
        }

        const processedHeading = await translateHeading(rawText);
        const titleText = cleanSetCandidate(processedHeading, setContext);
        if (!titleText || !shouldConsiderSetText(titleText, setContext)) {
          continue;
        }

        const lowerTitle = titleText.toLowerCase();
        if (
          lowerTitle.includes("uncut sheet") &&
          !/\[[^\]]+\]/.test(titleText)
        ) {
          continue;
        }

        const dictionaryTitle = translateWithDictionary(
          titleText,
          setContext.locale
        );

        setCandidates.push({
          title: titleText,
          images: imageData.images,
          versionSignature: extractVersionSignature(titleText),
          translatedTitle: dictionaryTitle || undefined,
        });
        pushed = true;
      }

      return pushed;
    };

    let processed = false;
    if (h6Nodes.length > 0) {
      processed = await processNodes(h6Nodes);
    }

    if (!processed) {
      await processNodes(headingNodes);
    }
  }

  return { sets: setCandidates, cards: cardCandidates };
}

/**
 * Busca sets en la base de datos que coincidan con el texto detectado
 */
async function findMatchingSets(
  detectedTexts: DetectedSetCandidate[]
): Promise<{
  matches: MatchedSet[];
  unmatchedCandidates: DetectedSetCandidate[];
}> {
  const setsCache = await loadSetsCache();
  const matchedMap = new Map<number, MatchedSet>();
  const unmatchedCandidates: DetectedSetCandidate[] = [];

  for (const candidate of detectedTexts) {
    const candidateVersionSignature =
      candidate.versionSignature ?? extractVersionSignature(candidate.title);
    const candidateTitles = [
      candidate.title,
      candidate.translatedTitle,
    ].filter((value): value is string => Boolean(value));
    if (candidateTitles.length === 0) {
      continue;
    }

    let matched = false;

    for (const text of candidateTitles) {
      const normalizedDetected = normalizeString(text);
      const baseNormalizedDetected =
        stripVersionSuffix(normalizedDetected);

      if (!normalizedDetected || normalizedDetected.length < 4) {
        continue;
      }

      const matches = setsCache.filter((set) => {
        if (!set.normalizedTitle) return false;
        const baseNormalizedSet = stripVersionSuffix(set.normalizedTitle);
        if (
          set.normalizedTitle === normalizedDetected &&
          versionSignaturesCompatible(
            candidateVersionSignature,
            set.versionSignature
          )
        ) {
          return true;
        }

        if (
          baseNormalizedSet &&
          baseNormalizedDetected &&
          baseNormalizedSet === baseNormalizedDetected &&
          versionSignaturesCompatible(
            candidateVersionSignature,
            set.versionSignature
          )
        ) {
          return true;
        }

        if (
          set.normalizedTitle.includes(normalizedDetected) &&
          versionSignaturesCompatible(
            candidateVersionSignature,
            set.versionSignature
          )
        ) {
          return hasSufficientOverlap(
            normalizedDetected.length,
            set.normalizedTitle.length
          );
        }

        if (
          normalizedDetected.includes(set.normalizedTitle) &&
          versionSignaturesCompatible(
            candidateVersionSignature,
            set.versionSignature
          )
        ) {
          return hasSufficientOverlap(
            set.normalizedTitle.length,
            normalizedDetected.length
          );
        }

        return false;
      });

      if (matches.length > 0) {
        console.log(
          `✓ Normalized match "${text}" -> ${matches
            .map((m) => m.title)
            .join(", ")}`
        );
        matches.forEach((match) => {
          if (!matchedMap.has(match.id)) {
            matchedMap.set(match.id, {
              id: match.id,
              title: match.title,
              matchedText: text,
            });
          }
        });
        matched = true;
        break;
      }

      const keywordMatches = text.match(
        /\b(OP-?\d+|ST-?\d+|Tournament Pack Vol\.\s*\d+|Promotion Pack \d+)\b/gi
      );

      if (keywordMatches) {
        for (const keyword of keywordMatches) {
          if (isKnownSetCodeKeyword(keyword)) {
            continue;
          }
          const normalizedKeyword = normalizeString(keyword);
          const setsByKeyword = setsCache.filter((set) => {
            if (
              set.normalizedTitle &&
              set.normalizedTitle.includes(normalizedKeyword) &&
              versionSignaturesCompatible(
                candidateVersionSignature,
                set.versionSignature
              )
            ) {
              return true;
            }

            return false;
          });

          if (setsByKeyword.length > 0) {
            console.log(
              `✓ Keyword match "${keyword}" -> ${setsByKeyword
                .map((s) => s.title)
                .join(", ")}`
            );
            setsByKeyword.forEach((match) => {
              if (!matchedMap.has(match.id)) {
                matchedMap.set(match.id, {
                  id: match.id,
                  title: match.title,
                  matchedText: keyword,
                });
              }
            });
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        break;
      }
    }

    if (!matched) {
      unmatchedCandidates.push(candidate);
    }
  }

  return {
    matches: Array.from(matchedMap.values()),
    unmatchedCandidates,
  };
}

/**
 * Scrapea un evento individual
 */
function cleanPageTitle(title: string): string {
  return title
    .replace(
      /\s*[–−-]\s*EVENTS｜ONE PIECE CARD GAME - Official Web Site\s*$/i,
      ""
    )
    .trim();
}

async function scrapeEventDetail(
  eventUrl: string,
  options: ScrapeEventDetailOptions
): Promise<ScrapedEvent | null> {
  const { regionOverride, locale, render, translator, listThumbnail } =
    options;
  try {
    console.log(`\n🔍 Scraping event: ${eventUrl}`);

    const html = await fetchPageHtml(eventUrl, render);
    if (!html) {
      console.warn(`⚠️  Unable to load event detail: ${eventUrl}`);
      return null;
    }

    const $ = cheerio.load(html);

    // Extrae información básica
    const structuredTitle = $(".eventTit").first().text().trim();
    const fallbackTitle =
      $("h1").first().text().trim() || $("title").text().trim();
    const title = cleanPageTitle(structuredTitle || fallbackTitle);
    const description = $('meta[name="description"]').attr("content") || null;
    const categoryText =
      $(".pageTitCategory").first().text().trim() ||
      $(".eventCategory").first().text().trim() ||
      null;

    // Extrae el contenido completo
    const contentElement = $(".event-content, .content, main, article").first();
    const content = contentElement.text().trim() || $("body").text().trim();
    const originalContent = contentElement.html() || null;
    const dateText = extractPeriodText($);

    // Extrae imagen
    const heroSrc =
      $(".mvImgCol img").first().attr("src") ||
      $(".heroImg img").first().attr("src") ||
      null;
    const listThumbSrc =
      $(".eventThumnail img, .eventThumbnail img").first().attr("src") || null;
    const resolvedHero = resolveImageUrl(heroSrc || undefined, eventUrl);
    const resolvedListThumb = resolveImageUrl(
      listThumbSrc || undefined,
      eventUrl
    );
    const eventThumbnail = listThumbnail || resolvedListThumb || null;

    const ogImage = $('meta[property="og:image"]').attr("content") || null;
    const resolvedOg = resolveImageUrl(ogImage || undefined, eventUrl);
    const resolvedFallback = resolveImageUrl(
      $("img").first().attr("src") || undefined,
      eventUrl
    );
    const imageUrl =
      (resolvedOg && !/\/ogp\./i.test(resolvedOg) && resolvedOg) ||
      resolvedHero ||
      eventThumbnail ||
      resolvedFallback ||
      null;

    // Detecta región, tipo y fechas
    const fullText = `${title} ${description || ""} ${categoryText || ""} ${
      dateText || ""
    } ${content}`;
    const region = regionOverride ?? detectRegion(fullText);
    const eventType = detectEventType(fullText);
    const { startDate, endDate } = parseDates(dateText || fullText);
    const category = detectEventCategory(categoryText);
    const status = detectEventStatus(startDate, endDate);

    // Extrae ubicación
    const location = extractLocationText($);

    // Detecta sets y cartas mencionados
    const { sets: detectedSets, cards: detectedCards } =
      await detectSetsAndCards($, eventUrl, {
        locale,
        translator,
      });

    console.log(`  Title: ${title}`);
    console.log(`  Region: ${region}`);
    console.log(`  Type: ${eventType}`);
    if (categoryText) {
      console.log(`  Category text: ${categoryText}`);
    }
    if (category) {
      console.log(`  Category enum: ${category}`);
    }
    if (dateText) {
      console.log(`  Date text: ${dateText}`);
    }
    console.log(`  Sets detected: ${detectedSets.length}`);

    return {
      title,
      description,
      content,
      originalContent,
      region,
      locale,
      status,
      eventType,
      category,
      startDate,
      endDate,
      rawDateText: dateText,
      location,
      sourceUrl: eventUrl,
      eventThumbnail,
      imageUrl,
      detectedSets,
      detectedCards,
    };
  } catch (error) {
    console.error(`❌ Error scraping ${eventUrl}:`, error);
    return null;
  }
}

/**
 * Scrapea la lista de eventos
 */
function isValidEventDetailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();

    if (!pathname.startsWith("/events/")) return false;

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return false; // descarta /events/ o /events

    const basename = segments[segments.length - 1];
    if (basename.startsWith("list")) return false;

    return true;
  } catch {
    return false;
  }
}

async function scrapeEventsList(
  source: EventListSource,
  render: RenderOptions
): Promise<EventListEntry[]> {
  const baseUrl = source.url;
  try {
    console.log(`\n📋 Fetching events list from: ${baseUrl}`);

    const html = await fetchPageHtml(baseUrl, render);
    if (!html) {
      return [];
    }

    const $ = cheerio.load(html);
    const eventEntries: EventListEntry[] = [];
    const seen = new Set<string>();

    // Busca enlaces a eventos usando la grilla oficial
    $('.eventDetail a[href], a[href*="event"]').each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        const fullUrl = href.startsWith("http")
          ? href
          : new URL(href, baseUrl).toString();

        // Evita duplicados
        if (!isValidEventDetailUrl(fullUrl)) {
          return;
        }

        if (seen.has(fullUrl)) {
          return;
        }

        seen.add(fullUrl);
        const thumbnail = extractListThumbnail($, $(element), baseUrl);
        eventEntries.push({
          url: fullUrl,
          thumbnail,
        });
      }
    });

    console.log(`  Found ${eventEntries.length} potential event URLs`);

    return eventEntries;
  } catch (error) {
    console.error("❌ Error fetching events list:", error);
    return [];
  }
}

async function collectEventUrlsFromSources(
  sources: EventListSource[],
  perSourceLimit: number,
  maxEvents: number,
  render: RenderOptions
): Promise<EventListEntry[]> {
  const collected: EventListEntry[] = [];
  const seen = new Map<string, EventListEntry>();

  for (const source of sources) {
    if (collected.length >= maxEvents) break;

    const entries = await scrapeEventsList(source, render);
    if (entries.length === 0) {
      console.warn(
        `⚠️  No events returned for source: ${source.label || source.url}`
      );
      continue;
    }

    const limit = source.limit ?? perSourceLimit;
    const limitedEntries = limit > 0 ? entries.slice(0, limit) : entries;

    console.log(
      `  Source ${source.label || source.url} (${source.type || "current"}): ` +
        `${limitedEntries.length} URLs considered`
    );

    for (const entry of limitedEntries) {
      if (collected.length >= maxEvents) break;
      if (seen.has(entry.url)) {
        const existing = seen.get(entry.url)!;
        if (!existing.thumbnail && entry.thumbnail) {
          existing.thumbnail = entry.thumbnail;
        }
        continue;
      }
      seen.set(entry.url, entry);
      collected.push(entry);
    }
  }

  return collected;
}

/**
 * Función principal de scraping
 */
export async function scrapeEvents(
  options: ScrapeEventsOptions = {}
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: true,
    eventsProcessed: 0,
    setsLinked: 0,
    errors: [],
    events: [],
  };

  const {
    sources = DEFAULT_EVENT_LIST_SOURCES,
    maxEvents = DEFAULT_MAX_EVENTS,
    perSourceLimit = DEFAULT_PER_SOURCE_LIMIT,
    delayMs = DEFAULT_REQUEST_DELAY_MS,
    dryRun = false,
    renderMode = DEFAULT_RENDER_MODE,
    renderWaitMs = DEFAULT_RENDER_WAIT_MS,
    translation,
  } = options;

  const translator =
    translation && translation.enabled
      ? new HeadingTranslationService(translation)
      : null;

  const render: RenderOptions = {
    mode: renderMode,
    waitMs: renderWaitMs,
  };

  result.renderMode = render.mode;

  try {
    console.log("🚀 Starting event scraper...\n");

    // 1. Obtiene lista de eventos desde las fuentes configuradas
    const eventEntries = await collectEventUrlsFromSources(
      sources,
      perSourceLimit,
      maxEvents,
      render
    );

    if (eventEntries.length === 0) {
      result.success = false;
      result.errors.push("No events found to scrape");
      return result;
    }

    console.log(`\n📌 Processing ${eventEntries.length} unique event URLs`);

    // 2. Procesa cada evento con límite global
    for (const entry of eventEntries) {
      const eventUrl = entry.url;
      const regionOverride = getRegionOverrideForUrl(eventUrl);
      const localeOverride =
        getLocaleOverrideForUrl(eventUrl) ?? "en";
      const scrapedEvent = await scrapeEventDetail(eventUrl, {
        regionOverride,
        locale: localeOverride,
        render,
        translator,
        listThumbnail: entry.thumbnail ?? null,
      });

      if (!scrapedEvent) {
        result.errors.push(`Failed to scrape: ${eventUrl}`);
        continue;
      }

      try {
        // Genera slug único
        const slug = generateSlug(
          scrapedEvent.title,
          scrapedEvent.region,
          scrapedEvent.sourceUrl
        );

        // 3. Busca sets coincidentes
        const { matches: matchedSets, unmatchedCandidates } =
          await findMatchingSets(scrapedEvent.detectedSets);

        const dedupedMissingSets = dedupeMissingCandidates(unmatchedCandidates);
        const dedupedCards = dedupeCardCandidates(scrapedEvent.detectedCards);

        if (dedupedMissingSets.length > 0) {
          console.warn(
            `⚠️  ${dedupedMissingSets.length} detected set references without match for ${slug}:`,
            dedupedMissingSets.map((candidate) => candidate.title)
          );
        }

        // 4. Crea o actualiza el evento
        let persistedEventId: number | null = null;
        let persistedEventIsApproved: boolean | null = null;
        if (dryRun) {
          console.log(
            `📝 Dry run: ${slug} would link ${matchedSets.length} sets`
          );
        } else {
          const event = await prisma.event.upsert({
            where: { slug },
            create: {
              slug,
              title: scrapedEvent.title,
              description: scrapedEvent.description,
              content: scrapedEvent.content,
              originalContent: scrapedEvent.originalContent,
              locale: scrapedEvent.locale,
              region: scrapedEvent.region,
              status: scrapedEvent.status,
              eventType: scrapedEvent.eventType,
              category: scrapedEvent.category,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              rawDateText: scrapedEvent.rawDateText,
              location: scrapedEvent.location,
              sourceUrl: scrapedEvent.sourceUrl,
              imageUrl: scrapedEvent.imageUrl,
              eventThumbnail: scrapedEvent.eventThumbnail,
              isApproved: false,
            },
            update: {
              title: scrapedEvent.title,
              description: scrapedEvent.description,
              content: scrapedEvent.content,
              originalContent: scrapedEvent.originalContent,
              locale: scrapedEvent.locale,
              region: scrapedEvent.region,
              status: scrapedEvent.status,
              eventType: scrapedEvent.eventType,
              category: scrapedEvent.category,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              rawDateText: scrapedEvent.rawDateText,
              location: scrapedEvent.location,
              sourceUrl: scrapedEvent.sourceUrl,
              imageUrl: scrapedEvent.imageUrl,
              eventThumbnail: scrapedEvent.eventThumbnail,
            },
          });

          // 5. Vincula sets
          const linkedCount = await syncEventSetsInDb(event.id, matchedSets);
          result.setsLinked += linkedCount;

          console.log(
            `✅ Saved event: ${slug} (${matchedSets.length} sets linked)`
          );
          persistedEventId = event.id;
          persistedEventIsApproved = event.isApproved;
        }

        result.eventsProcessed++;
        if (!dryRun && persistedEventId) {
          await syncEventMissingSetsInDb(
            persistedEventId,
            dedupedMissingSets
          );
          await syncEventMissingCardsInDb(persistedEventId, dedupedCards);
        }
        result.events.push({
          slug,
          title: scrapedEvent.title,
          locale: scrapedEvent.locale,
          isApproved: persistedEventIsApproved ?? false,
          sets: matchedSets.map((matchedSet) => ({
            id: matchedSet.id,
            title: matchedSet.title,
            match: matchedSet.matchedText,
          })),
          dryRun: dryRun || undefined,
          region: scrapedEvent.region,
          status: scrapedEvent.status,
          eventType: scrapedEvent.eventType,
          category: scrapedEvent.category,
          startDate: scrapedEvent.startDate
            ? scrapedEvent.startDate.toISOString()
            : null,
          endDate: scrapedEvent.endDate
            ? scrapedEvent.endDate.toISOString()
            : null,
          rawDateText: scrapedEvent.rawDateText,
          location: scrapedEvent.location,
          sourceUrl: scrapedEvent.sourceUrl,
          eventThumbnail: scrapedEvent.eventThumbnail,
          imageUrl: scrapedEvent.imageUrl,
          missingSets: dedupedMissingSets,
          cards: dedupedCards,
        });
      } catch (dbError) {
        const error = dbError as Error;
        result.errors.push(
          `Database error for ${scrapedEvent.title}: ${error.message}`
        );
        console.error("❌ Database error:", error);
      }

      // Pequeña pausa entre requests para no sobrecargar el servidor
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`\n✅ Scraping completed!`);
    console.log(`   Events processed: ${result.eventsProcessed}`);
    console.log(`   Sets linked: ${result.setsLinked}`);
    console.log(`   Errors: ${result.errors.length}`);
  } catch (error) {
    const err = error as Error;
    result.success = false;
    result.errors.push(`Fatal error: ${err.message}`);
    console.error("❌ Fatal error:", error);
  } finally {
    if (translator) {
      await translator.flush();
      result.translation = translator.getStats();
    }
  }

  return result;
}
interface VersionEntry {
  value: string;
  position: number;
  keywordPosition: number;
  isKeyword: boolean;
}

function getDigitBounds(
  match: RegExpExecArray,
  digits: string
): {
  start: number;
  end: number;
} {
  const matchIndex = match.index ?? 0;
  const full = match[0];
  const offset = full.lastIndexOf(digits);
  const relativeOffset = offset >= 0 ? offset : full.length - digits.length;
  const start = matchIndex + relativeOffset;
  return { start, end: start + digits.length };
}

function shouldSkipHyphenatedRange(
  canonical: string,
  endIndex: number
): boolean {
  let idx = endIndex;
  while (idx < canonical.length && canonical[idx] === " ") {
    idx++;
  }
  return canonical[idx] === "-" && /\d/.test(canonical[idx + 1] || "");
}

function extractVersionNumbers(text: string): string[] {
  const canonical = canonicalizeSetDisplay(text).toLowerCase();
  const entries: VersionEntry[] = [];

  const addEntry = (
    value: string,
    start: number,
    end: number,
    keywordPosition: number,
    isKeyword: boolean
  ) => {
    if (!value) return;
    if (start < 0 || end <= start) return;
    if (shouldSkipHyphenatedRange(canonical, end)) return;
    entries.push({ value, position: start, keywordPosition, isKeyword });
  };

  const standardPattern =
    /(vol(?:ume)?|season|ver(?:sion)?|set|series|round|pack)[\s.\-]*(\d{1,3})/gi;
  let match: RegExpExecArray | null;
  while ((match = standardPattern.exec(canonical))) {
    const digits = match[2];
    const bounds = getDigitBounds(match, digits);
    addEntry(
      digits,
      bounds.start,
      bounds.end,
      match.index ?? bounds.start,
      true
    );
  }

  const placePattern = /(1st|2nd|3rd|4th|5th)\s+place/gi;
  while ((match = placePattern.exec(canonical))) {
    const raw = match[1];
    const num = raw.replace(/(st|nd|rd|th)/i, "");
    if (!num) continue;
    const start = match.index ?? 0;
    const end = start + num.length;
    addEntry(num, start, end, match.index ?? start, true);
  }

  const trophyPattern = /(?:trophy|rank)\s*(\d{1,2})/gi;
  while ((match = trophyPattern.exec(canonical))) {
    const digits = match[1];
    const bounds = getDigitBounds(match, digits);
    addEntry(
      digits,
      bounds.start,
      bounds.end,
      match.index ?? bounds.start,
      true
    );
  }

  const packNumberPattern = /pack(?:\s+|\-)?(\d{1,2})(?!\d)/gi;
  while ((match = packNumberPattern.exec(canonical))) {
    const digits = match[1];
    const bounds = getDigitBounds(match, digits);
    addEntry(
      digits,
      bounds.start,
      bounds.end,
      match.index ?? bounds.start,
      true
    );
  }

  const trailingPattern =
    /(vol|season|ver|version|set|series|round|place|pack)[\s.\-]*(\d{1,3})\s*$/i;
  const trailingMatch = trailingPattern.exec(canonical);
  if (trailingMatch) {
    const digits = trailingMatch[2];
    const bounds = getDigitBounds(trailingMatch as RegExpExecArray, digits);
    addEntry(
      digits,
      bounds.start,
      bounds.end,
      trailingMatch.index ?? bounds.start,
      true
    );
  }

  const barePattern = /(\d{1,3})\s*$/;
  const bareMatch = barePattern.exec(canonical);
  if (bareMatch) {
    const digits = bareMatch[1];
    const start = bareMatch.index ?? canonical.length - digits.length;
    const end = start + digits.length;
    addEntry(digits, start, end, start, false);
  }

  if (entries.length === 0) {
    return [];
  }

  const keywordEntries = entries.filter((entry) => entry.isKeyword);
  let relevantEntries: VersionEntry[];
  if (keywordEntries.length > 0) {
    const maxKeywordPos = Math.max(
      ...keywordEntries.map((entry) => entry.keywordPosition)
    );
    relevantEntries = keywordEntries.filter(
      (entry) => entry.keywordPosition >= maxKeywordPos
    );
  } else {
    relevantEntries = entries;
  }

  const normalizedValues = Array.from(
    new Set(
      relevantEntries.map((entry) => entry.value.replace(/^0+/, "") || "0")
    )
  );

  return normalizedValues;
}

function extractVersionSignature(
  text: string | null | undefined
): string | null {
  if (!text) return null;
  const numbers = extractVersionNumbers(text);
  if (numbers.length === 0) return null;
  return numbers
    .map((num) => num.replace(/^0+/, "") || "0")
    .sort((a, b) => parseInt(a) - parseInt(b))
    .join("-");
}

function versionSignaturesCompatible(
  candidateSignature: string | null,
  setSignature: string | null
): boolean {
  if (!candidateSignature && !setSignature) return true;
  if (!candidateSignature || !setSignature) return false;
  return candidateSignature === setSignature;
}
