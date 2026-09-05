import axios from "axios";
import * as cheerio from "cheerio";
import { createHash } from "crypto";
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
import { buildCardIdentityKey } from "../tcgplayerCardData";

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
  eventTxt?: string | null;
  rawDateText?: string | null;
  listOrder?: number | null;
  sourceType?: EventListSourceType;
}

export interface ScrapedEvent {
  title: string;
  description: string | null;
  content: string | null;
  originalContent: string | null;
  eventTxt: string | null;
  listOrder: number | null;
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

const UNWANTED_EVENT_SECTION_SELECTORS = [
  ".categoryTitle",
  ".pageFooterBackBtn",
  ".pageContentsRelated",
  ".relatedPageList",
  ".relatedLinks",
  ".linksList",
  ".linkList",
  ".pageLinks",
  ".pageLinksCol",
  ".mvImgCol",
  ".pageTitCol",
  ".pageTitInner",
  ".pageTitInfoCol",
  ".btnBack",
  ".commonBackBtn",
];

const UNWANTED_EVENT_HEADING_KEYWORDS = ["related page", "related pages", "links"];

const stripUnwantedEventSections = ($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) => {
  UNWANTED_EVENT_SECTION_SELECTORS.forEach((selector) => {
    if (root.is(selector)) {
      root.remove();
      return;
    }
    root.find(selector).remove();
  });

  root.find("h2, h3, h4, h5, h6").each((_, element) => {
    const text = $(element).text().trim().toLowerCase();
    if (!text) return;
    const shouldRemove = UNWANTED_EVENT_HEADING_KEYWORDS.some((keyword) =>
      text.includes(keyword)
    );
    if (!shouldRemove) {
      return;
    }
    const container = $(element).closest("section, article, div, ul, ol").first();
    if (container.length) {
      container.remove();
    } else {
      $(element).remove();
    }
  });

  root.find("a").each((_, element) => {
    const text = $(element).text().trim().toLowerCase();
    if (text === "back" || text === "back to list" || text === "back to page") {
      const container = $(element).closest(".pageFooterBackBtn");
      if (container.length) {
        container.remove();
      } else {
        $(element).remove();
      }
    }
  });

  root.find(".mvImgCol").remove();
};

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
  aliases: Array<{
    title: string;
    normalizedTitle: string;
    versionSignature: string | null;
  }>;
}

interface ScrapeEventDetailOptions {
  regionOverride?: EventRegion;
  locale: string;
  render: RenderOptions;
  translator?: HeadingTranslationService | null;
  listThumbnail?: string | null;
  listEventTxt?: string | null;
  listRawDateText?: string | null;
  listOrder?: number | null;
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
      images: string[];
      cards: Array<{
        id: number;
        title: string;
        code: string | null;
        image: string | null;
      }>;
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
    eventTxt?: string | null;
    listOrder?: number | null;
    missingSets: Array<{
      title: string;
      translatedTitle?: string;
      images: string[];
      versionSignature?: string | null;
    }>;
    cards: Array<{
      code: string;
      title: string;
      image?: string | null;
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
  "Storage Box",
  "Deck Box",
  "Devil Fruit",
  "Collector Set",
  "Double Pack",
  "Sleeve",
  "OP-",
  "ST-",
  "PRB-",
  "P-",
];

const CURRENT_EVENTS_URL = "https://en.onepiece-cardgame.com/events/";
const PAST_EVENTS_URL = "https://en.onepiece-cardgame.com/events/list_end.php";
const ARCHIVE_EVENTS_URL =
  "https://en.onepiece-cardgame.com/events/list_archive.php";

const FRENCH_CURRENT_EVENTS_URL =
  "https://fr.onepiece-cardgame.com/events/list.php";
const FRENCH_PAST_EVENTS_URL =
  "https://fr.onepiece-cardgame.com/events/list_end.php";

const JAPANESE_CURRENT_EVENTS_URL =
  "https://www.onepiece-cardgame.com/events/list.php";
const JAPANESE_PAST_EVENTS_URL =
  "https://www.onepiece-cardgame.com/events/list_end.php";

type EventSourceCollection = EventListSource | EventListSource[];

export interface LanguageEventSourceConfig {
  locale: string;
  current?: EventSourceCollection;
  past?: EventSourceCollection;
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
    past: [
      {
        url: PAST_EVENTS_URL,
        label: "global-past-recent",
        type: "past",
        region: EventRegion.NA,
      },
      {
        url: ARCHIVE_EVENTS_URL,
        label: "global-past-archive",
        type: "past",
        region: EventRegion.NA,
      },
    ],
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

const normalizeEventSources = (
  source?: EventSourceCollection
): EventListSource[] => {
  if (!source) return [];
  return Array.isArray(source) ? source : [source];
};

Object.values(LANGUAGE_EVENT_SOURCES).forEach((config) => {
  normalizeEventSources(config.current).forEach((source) => {
    source.locale = config.locale;
    if (config.requiresDynamicRendering) {
      source.requiresDynamicRendering = true;
    }
  });
  normalizeEventSources(config.past).forEach((source) => {
    source.locale = config.locale;
    if (config.requiresDynamicRendering) {
      source.requiresDynamicRendering = true;
    }
  });
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
  normalizeEventSources(config.current).forEach((source) => {
    registerDomainMetadata(source);
  });
  normalizeEventSources(config.past).forEach((source) => {
    registerDomainMetadata(source);
  });
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
    const linkCardImg = container.find(".linkCardThumb img").first();
    if (linkCardImg.length) {
      const resolved = resolveImageUrl(
        linkCardImg.attr("data-src") || linkCardImg.attr("src"),
        baseUrl
      );
      if (resolved) {
        return resolved;
      }
    }

    const img = container
      .find(
        ".eventThumnail img, .eventThumbnail img, img.eventThumnail, img.eventThumbnail, .linkCardThumb img"
      )
      .first();
    if (img.length) {
      const resolved = resolveImageUrl(
        img.attr("src") || img.attr("data-src"),
        baseUrl
      );
      if (resolved) {
        return resolved;
      }
    }
  }

  const fallbackImg = anchor.find("img").first();
  if (fallbackImg.length) {
    const resolved = resolveImageUrl(
      fallbackImg.attr("src") || fallbackImg.attr("data-src"),
      baseUrl
    );
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

export const DEFAULT_EVENT_LIST_SOURCES: EventListSource[] =
  normalizeEventSources(EVENT_LANGUAGE_SOURCE_MAP.en.current);

export const PAST_EVENT_LIST_SOURCES: EventListSource[] =
  normalizeEventSources(EVENT_LANGUAGE_SOURCE_MAP.en.past);

export const PAST_EVENT_LIST_SOURCE: EventListSource =
  PAST_EVENT_LIST_SOURCES[0] ??
  normalizeEventSources(EVENT_LANGUAGE_SOURCE_MAP.en.current)[0]!;

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

const CHINESE_SET_KEYWORDS = [
  "卡套",
  "保护套",
  "桌垫",
  "对战桌垫",
  "游戏垫",
  "收纳盒",
  "卡盒",
  "卡组盒",
  "补充包",
  "基本卡组",
  "起始牌组",
  "宣传卡",
  "限定商品",
  "收藏套装",
  "双包",
  "卡牌收藏",
  "卡牌套装",
  "卡组",
  "卡包",
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
  ...CHINESE_SET_KEYWORDS,
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
  ...CHINESE_SET_KEYWORDS,
];

const ALL_SET_HINTS = Array.from(
  new Set([
    ...BASE_SET_TEXT_HINTS,
    ...BASE_SET_INDICATOR_KEYWORDS,
    ...JAPANESE_SET_KEYWORDS,
    ...CHINESE_SET_KEYWORDS,
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
  ...CHINESE_SET_KEYWORDS,
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
  cn: CHINESE_SET_KEYWORDS,
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
  cn: ["海贼王卡牌游戏", "海贼王 卡牌游戏", "航海王卡牌游戏", "航海王 卡牌游戏"],
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
  "products below",
  "products listed below",
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
export function generateSlug(
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
          aliasesJson: true,
        },
      })
      .then((sets) =>
        sets.map((set) => ({
          id: set.id,
          title: set.title,
          code: set.code,
          normalizedTitle: normalizeString(set.title),
          versionSignature: extractVersionSignature(set.title),
          aliases: (Array.isArray(set.aliasesJson) ? set.aliasesJson : [])
            .map((alias) => (typeof alias === "string" ? alias.trim() : ""))
            .filter((alias) => alias.length > 0)
            .map((alias) => ({
              title: alias,
              normalizedTitle: normalizeString(alias),
              versionSignature: extractVersionSignature(alias),
            }))
            .filter((alias) => alias.normalizedTitle.length > 0),
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
  const inlinePeriodNode = $(".eventDate").first();
  if (inlinePeriodNode.length) {
    const cloned = inlinePeriodNode.clone();
    cloned.find("span").remove();
    const inlinePeriod = cloned.text().trim();
    if (inlinePeriod) {
      return cleanPeriodText(inlinePeriod);
    }
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

  const wordCount = result ? result.split(/\s+/).length : 0;
  if (wordCount > 12) {
    return "";
  }

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

/**
 * El texto que sigue al código DENTRO del nombre de archivo de imagen suele
 * ser un marcador real de variante (no un id random — eso vive en la carpeta,
 * no en el filename): "_1/_2/_3" = trophy card por lugar, "_win" = versión
 * ganador, "_p1/_p2" = numeración de alterna estilo JP. Cuando el heading/alt
 * de la página no dice nada útil, este sufijo es la única pista de que dos
 * imágenes con el MISMO código son en realidad objetos distintos — ej.
 * batch_OP14-069_1.webp vs _2.webp vs _3.webp (3 trophy cards, 1 por lugar).
 */
export function extractImageVariantSuffix(
  fileName: string,
  code: string
): string | null {
  const withoutExt = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
  const [prefix, number] = code.split("-");
  if (!prefix || !number) return null;
  const escapedPrefix = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(`${escapedPrefix}[-_]?${number}[-_]?(.*)$`, "i");
  const match = withoutExt.match(pattern);
  const suffix = match?.[1]?.replace(/^[-_]+/, "").trim();
  return suffix || null;
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

export function dedupeMissingCandidates(
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

export function dedupeCardCandidates(
  candidates: DetectedCardCandidate[]
): DetectedCardCandidate[] {
  const map = new Map<string, DetectedCardCandidate>();
  for (const candidate of candidates) {
    const canonicalTitle = canonicalizeSetDisplay(
      candidate.title || ""
    ).toLowerCase();
    const imageKey = candidate.image ? candidate.image.trim().toLowerCase() : "";
    const key = `${candidate.code.toUpperCase()}|${canonicalTitle}|${imageKey}`;

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

export async function syncEventMissingSetsInDb(
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

export async function syncEventMissingCardsInDb(
  eventId: number,
  candidates: DetectedCardCandidate[]
) {
  // Sin imagen no hay nada que un admin pueda comparar contra el catálogo
  // para aprobar/vincular — no tiene sentido meterla a la cola de revisión.
  // Se filtra ANTES de todo lo demás: ni siquiera compite por una llave
  // canónica con una carta real que sí tenga foto.
  const withImage = candidates.filter((candidate) => !!candidate.image);

  // El título del evento da contexto de variante ("Treasure Cup" → variante
  // "Treasure Cup") para construir la identidad canónica de cada carta.
  const eventRow = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true },
  });
  const eventTitle = eventRow?.title ?? "";

  // Enriquece cada candidato con imagen + llave canónica (independiente del evento).
  // El sufijo del archivo de imagen (batch_OP14-069_3.webp → "3") entra como
  // último respaldo de variante — solo pesa cuando ni el texto de la carta ni
  // el del evento supieron nombrar una (ver buildCardIdentityKey).
  const enriched = withImage.map((candidate) => {
    const imageFileName = (candidate.image || "").split("/").pop() || "";
    const variantHint = extractImageVariantSuffix(imageFileName, candidate.code);
    return {
      code: candidate.code,
      title: candidate.title,
      imageUrl: candidate.image || "",
      canonicalKey: buildCardIdentityKey(
        candidate.code,
        candidate.title,
        eventTitle,
        variantHint
      ),
    };
  });

  if (enriched.length === 0) {
    await prisma.eventMissingCard.deleteMany({ where: { eventId } });
    await prisma.missingCard.deleteMany({
      where: { isApproved: false, events: { none: {} } },
    });
    return;
  }

  // FASE 0 — reuso por identidad de imagen, la única señal 100% confiable.
  // Bandai a veces re-sube la MISMA carta bajo una carpeta random distinta
  // (y a veces sin el prefijo "batch_" que sí trae la subida "oficial") para
  // un evento diferente — confirmado real: el mismo "Top 64 Nami" de
  // Regionals y de Finals, imagen idéntica, pero la llave de texto salía
  // distinta por evento y terminaba duplicada. Si el nombre de archivo
  // (ignorando el prefijo "batch_") ya existe para este código, se adopta
  // ESA identidad tal cual — sin importar qué llave de texto/evento le
  // hubiera tocado a esta carta — y se prefiere la URL con "batch_" si solo
  // una de las dos la tiene.
  const normalizeImageIdentity = (imageUrl: string): string =>
    (imageUrl.split("/").pop() || "").replace(/^batch_/i, "").toLowerCase();
  const byCode = new Map<string, typeof enriched>();
  for (const cand of enriched) {
    const list = byCode.get(cand.code);
    if (list) list.push(cand);
    else byCode.set(cand.code, [cand]);
  }
  for (const [code, group] of Array.from(byCode.entries())) {
    const existingRows = await prisma.missingCard.findMany({ where: { code } });
    for (const cand of group) {
      const candIdentity = normalizeImageIdentity(cand.imageUrl);
      const candFileName = cand.imageUrl.split("/").pop() || "";
      const candSuffix = extractImageVariantSuffix(candFileName, cand.code);
      // Guarda de seguridad: algunos eventos viejos usan nombres GENÉRICOS
      // ("card_01.png") repetidos en carpetas propias por evento — ese nombre
      // NO identifica la carta, solo coincide por casualidad. Y un archivo que
      // es SOLO el código sin nada más (ej. "OP13-002.webp") TAMPOCO es
      // confiable — confirmado real: dos alt-arts DISTINTAS de Portgas.D.Ace
      // (una de Pirates Party Vol.2, otra de Extra Grand Battle — imágenes
      // totalmente diferentes) ambas se subieron como "OP13-002.webp" sin
      // sufijo, y se fusionaron por error en una sola carta. Solo confía en el
      // filename cuando trae un sufijo que de verdad distingue algo (ej.
      // "OP15-108.webp" → nada, pero "EB02-054_F.webp" → "F" si cuenta) — sin
      // sufijo, se deja que la llave de texto/evento decida como antes.
      if (!candIdentity || !candIdentity.includes(cand.code.toLowerCase()) || !candSuffix) continue;
      const match = existingRows.find(
        (r) => normalizeImageIdentity(r.imageUrl) === candIdentity
      );
      if (!match || !match.canonicalKey) continue;
      cand.canonicalKey = match.canonicalKey;
      if (/\/batch_/i.test(match.imageUrl) || !/\/batch_/i.test(cand.imageUrl)) {
        cand.imageUrl = match.imageUrl;
      }
    }
  }

  // La llave canónica es una ADIVINANZA de texto (código + variante deducida
  // del título/evento) — nunca 100% confiable por sí sola: dos cartas
  // FÍSICAMENTE DISTINTAS pueden caer en la misma adivinanza si ninguna trae
  // texto que el clasificador reconozca (bug real confirmado: "Usopp" y
  // "Lucy" de Flame-Flame Fruit Coliseum colisionaban con cartas de otro
  // evento por esto — aprobar una "resolvía" la otra sin ser la misma carta).
  // La única señal en la que SÍ podemos confiar al 100% es la URL de la
  // imagen. Agrupa por llave original — tanto dentro de ESTE lote como contra
  // lo que ya hay en la base — y a cualquier imagen que NO coincida con la
  // "imagen principal" de ese grupo se le desambigua la llave con un hash de
  // su propia URL, para que tenga identidad propia de ahora en más (sin
  // perder la deduplicación real cuando SÍ es exactamente la misma imagen,
  // incluso repetida en otro evento). El hash es de la imagen, no del orden,
  // así que vuelve a dar la misma llave si se re-scrapea la misma página.
  const byOriginalKey = new Map<string, typeof enriched>();
  for (const cand of enriched) {
    const group = byOriginalKey.get(cand.canonicalKey);
    if (group) group.push(cand);
    else byOriginalKey.set(cand.canonicalKey, [cand]);
  }
  for (const [originalKey, group] of Array.from(byOriginalKey.entries())) {
    const existingRow = await prisma.missingCard.findFirst({
      where: { canonicalKey: originalKey },
      orderBy: { id: "asc" },
    });
    const primaryImage =
      existingRow?.imageUrl || group.find((c) => c.imageUrl)?.imageUrl || "";
    for (const cand of group) {
      if (!cand.imageUrl || !primaryImage || cand.imageUrl === primaryImage) continue;
      const imageHash = createHash("sha1").update(cand.imageUrl).digest("hex").slice(0, 10);
      cand.canonicalKey = `${originalKey}#${imageHash}`;
    }
  }

  const canonicalSet = new Set(enriched.map((e) => e.canonicalKey));

  const existing = await prisma.eventMissingCard.findMany({
    where: { eventId },
    include: { missingCard: true },
  });

  // Borra links cuya carta (por identidad canónica) ya no se detecta en este
  // evento. Fallback al key derivado para filas viejas sin canonicalKey.
  const toDeleteIds = existing
    .filter((record) => {
      const key =
        record.missingCard.canonicalKey ??
        buildCardIdentityKey(
          record.missingCard.code,
          record.missingCard.title,
          eventTitle
        );
      return !canonicalSet.has(key);
    })
    .map((record) => record.id);

  if (toDeleteIds.length > 0) {
    await prisma.eventMissingCard.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
    console.log(
      `[missing-cards] Removed ${toDeleteIds.length} event links (no longer detected)`
    );
  }

  for (const cand of enriched) {
    // Deduplicación cross-evento: reutiliza el MissingCard con la misma llave
    // canónica (misma carta física en otro evento) en vez de crear uno nuevo.
    let missingCard = await prisma.missingCard.findFirst({
      where: { canonicalKey: cand.canonicalKey },
      orderBy: { id: "asc" },
    });

    if (!missingCard) {
      missingCard = await prisma.missingCard.upsert({
        where: {
          code_title_imageUrl: {
            code: cand.code,
            title: cand.title,
            imageUrl: cand.imageUrl,
          },
        },
        create: {
          code: cand.code,
          title: cand.title,
          imageUrl: cand.imageUrl,
          canonicalKey: cand.canonicalKey,
        },
        update: {
          imageUrl: cand.imageUrl || undefined,
          canonicalKey: cand.canonicalKey,
        },
      });
    } else if (
      cand.imageUrl &&
      (!missingCard.imageUrl ||
        (!/\/batch_/i.test(missingCard.imageUrl) && /\/batch_/i.test(cand.imageUrl)))
    ) {
      // Rellena la imagen si el primer evento no la traía, o la mejora si la
      // que ya teníamos no era la versión "batch_" (subida oficial) y esta sí.
      missingCard = await prisma.missingCard.update({
        where: { id: missingCard.id },
        data: { imageUrl: cand.imageUrl },
      });
    }

    if (missingCard.isApproved) {
      await prisma.eventMissingCard.deleteMany({
        where: { eventId, missingCardId: missingCard.id },
      });
      // La aprobación la saca de la cola de pendientes, pero eso NO la deja
      // como "carta confirmada" del evento si nadie crea el EventCard — se
      // veía "0 cartas confirmadas" en /admin/events/verify aunque ya
      // estuviera resuelta. `create-from-event` sube la imagen a R2 con un
      // nombre `${code}-evt${missingCardId}-...` — un match exacto (no
      // fuzzy) para encontrar EXACTAMENTE qué Card nació de este
      // MissingCard, sin importar cuándo se aprobó.
      const resolvedCard = await prisma.card.findFirst({
        where: { src: { contains: `-evt${missingCard.id}-` } },
        select: { id: true },
      });
      if (resolvedCard) {
        await prisma.eventCard.upsert({
          where: { eventId_cardId: { eventId, cardId: resolvedCard.id } },
          create: { eventId, cardId: resolvedCard.id },
          update: {},
        });
      }
      continue;
    }

    await prisma.eventMissingCard.upsert({
      where: {
        eventId_missingCardId: { eventId, missingCardId: missingCard.id },
      },
      create: { eventId, missingCardId: missingCard.id },
      update: {},
    });
  }

  await prisma.missingCard.deleteMany({
    where: { isApproved: false, events: { none: {} } },
  });
}

export async function syncEventSetsInDb(
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

  // === Layout 2026 (text-area / galería js-setGallery) ===
  // El sitio oficial ya no usa section.contentsmcol. Ahora los códigos de carta
  // aparecen en headings/list-items con contexto de premio ("Top 64 Alt-Art Card
  // OP15-092 …") y las imágenes viven en una GALERÍA compartida (.js-setGallery),
  // NO junto a cada carta. Pero el nombre del archivo lleva el código
  // (batch_OP15-092.webp, OP12_020.webp), así que asociamos la imagen por código.
  //
  // 1) Mapa código → imagen a partir del filename de cada <img> de la página.
  const imageByCode = new Map<string, string>();
  $("img").each((_, img) => {
    const src = $(img).attr("src") || $(img).attr("data-src");
    if (!src) return;
    const fileName = src.split("/").pop() || "";
    // Normaliza OP15_092 → OP15-092 para que extractCardCode lo reconozca.
    const normalized = fileName.replace(/_/g, "-");
    const codeInfo = extractCardCode(normalized);
    if (!codeInfo) return;
    if (!imageByCode.has(codeInfo.code)) {
      const resolved = resolveImageUrl(src, baseUrl);
      if (resolved) imageByCode.set(codeInfo.code, resolved);
    }
  });

  // 2) Texto suelto → código. Deduplicamos por CÓDIGO (el <li> de ranking y el
  //    <h4> de galería son la misma carta), prefiriendo el título "Alt-Art".
  const modernByCode = new Map<
    string,
    { code: string; title: string; image: string | null }
  >();
  const existingCodes = new Set(cardCandidates.map((c) => c.code));
  const textEls = $(
    "h1,h2,h3,h4,h5,h6,li,figcaption,.text-area,.menuColListLinkTit,.menuColListLinkTxt"
  ).toArray();
  for (const el of textEls) {
    const $el = $(el);
    // Evitar contenedores grandes que anidan otros headings/listas.
    if ($el.find("h1,h2,h3,h4,h5,h6,li").length > 0) continue;
    const rawText = $el.text().replace(/\s+/g, " ").trim();
    if (!rawText || rawText.length > 220) continue;
    const codeInfo = extractCardCode(rawText);
    if (!codeInfo) continue;
    if (existingCodes.has(codeInfo.code)) continue; // ya lo detectó el pass clásico

    const title =
      extractCardTitle(rawText, codeInfo.match, undefined) || rawText;
    const image = imageByCode.get(codeInfo.code) ?? null;
    const prev = modernByCode.get(codeInfo.code);
    // Prefiere el candidato con imagen y/o con título "Alt-Art" (más descriptivo).
    const isAltArt = /alt-?art/i.test(title);
    const prevIsAltArt = prev ? /alt-?art/i.test(prev.title) : false;
    if (
      !prev ||
      (image && !prev.image) ||
      (isAltArt && !prevIsAltArt)
    ) {
      modernByCode.set(codeInfo.code, { code: codeInfo.code, title, image });
    }
  }

  // 3) Bloques de imagen "component-opcg-cards" (galería de premios) y
  //    "component-photo-onepiececg" (foto individual — trophy cards, jumbo
  //    card): en ambos el código NUNCA aparece como texto en la página, solo
  //    en el nombre del archivo de imagen — el paso (2) de arriba los pierde
  //    porque exige el código como texto suelto. Los tomamos directo del
  //    filename (mismo `imageByCode` de arriba), usando el heading más
  //    cercano hacia atrás como contexto del título (ej. "CS 26-27 Event
  //    Pack", "CS 26ｰ27 1st Place Trophy Card"). Confirmado real en
  //    /events/26-27_Finals_Season_2.html — sin el segundo selector, las 4
  //    trophy/jumbo cards de esa página (fotos individuales, no galería) se
  //    perdían igual que antes.
  // El heading del bloque casi nunca es un hermano-anterior DIRECTO — vive
  // adentro de un contenedor hermano-anterior (ej. <div data-type="component-text">
  // <div class="text-area"><h5>Featured Card List</h5></div></div>). Por eso
  // busca tanto "el hermano ES un heading" como "el hermano CONTIENE uno".
  const closestPrecedingHeading = ($el: cheerio.Cheerio<any>): string => {
    let $cur = $el;
    for (let depth = 0; depth < 6 && $cur.length > 0; depth += 1) {
      const siblings = $cur.prevAll().toArray();
      for (const sib of siblings) {
        const $sib = $(sib);
        const heading = $sib.is("h1,h2,h3,h4,h5,h6")
          ? $sib
          : $sib.find("h1,h2,h3,h4,h5,h6").first();
        if (heading.length > 0) return extractHeadingText(heading);
      }
      $cur = $cur.parent();
    }
    return "";
  };
  // Ojo: distintos bloques pueden compartir CÓDIGO pero ser objetos físicos
  // distintos (las trophy card de 1er/2do/3er lugar son el mismo print base
  // pero cada una con su propio estampado de lugar) — por eso este pase NO
  // reutiliza `modernByCode` con el código pelado como llave (eso colapsaría
  // 2do/3er lugar contra el 1ro); usa código+título para no perder variantes
  // reales, pero sí sigue evitando duplicar el mismo código+título dos veces.
  const seenCodeTitle = new Set<string>();
  const cardBlocks = $(
    '[data-type="component-opcg-cards"], [data-type="component-photo-onepiececg"]'
  ).toArray();
  for (const block of cardBlocks) {
    const $block = $(block);
    const headingText = closestPrecedingHeading($block);
    $block.find("img").each((_, img) => {
      const $img = $(img);
      const src = $img.attr("src") || $img.attr("data-src");
      if (!src) return;
      const fileName = src.split("/").pop() || "";
      const normalized = fileName.replace(/_/g, "-");
      const codeInfo = extractCardCode(normalized);
      if (!codeInfo) return;
      if (existingCodes.has(codeInfo.code)) return;

      const resolved = resolveImageUrl(src, baseUrl);
      const alt = $img.attr("alt")?.trim();
      const suffix = extractImageVariantSuffix(fileName, codeInfo.code);
      let title = headingText || alt || codeInfo.code;
      // Si no hay ningún texto útil (título = código pelado) pero el archivo
      // sí trae un sufijo de variante, úsalo — mejor "OP14-069 (3)" que
      // perder la carta por colisionar con otra imagen del mismo código.
      if (title === codeInfo.code && suffix) {
        title = `${codeInfo.code} (${suffix})`;
      }
      // El sufijo entra SIEMPRE a la llave de dedupe (no solo al título): dos
      // imágenes del mismo código con el mismo heading pero distinto archivo
      // (_1 vs _2 vs _3) no deben colapsar aunque el título coincida.
      const dedupeKey = `${codeInfo.code}::${title.toLowerCase()}::${suffix ?? ""}`;
      if (seenCodeTitle.has(dedupeKey)) return;
      seenCodeTitle.add(dedupeKey);
      modernByCode.set(`block:${dedupeKey}`, {
        code: codeInfo.code,
        title,
        image: resolved ?? imageByCode.get(codeInfo.code) ?? null,
      });
    });
  }

  for (const candidate of Array.from(modernByCode.values())) {
    cardCandidates.push(candidate);
  }

  return { sets: setCandidates, cards: cardCandidates };
}

/**
 * Busca sets en la base de datos que coincidan con el texto detectado
 */
export async function findMatchingSets(
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
        const normalizedCandidates = [
          {
            normalizedTitle: set.normalizedTitle,
            versionSignature: set.versionSignature,
          },
          ...set.aliases.map((alias) => ({
            normalizedTitle: alias.normalizedTitle,
            versionSignature: alias.versionSignature ?? set.versionSignature,
          })),
        ];

        return normalizedCandidates.some((setEntry) => {
          if (!setEntry.normalizedTitle) return false;
          const baseNormalizedSet = stripVersionSuffix(setEntry.normalizedTitle);
          if (
            setEntry.normalizedTitle === normalizedDetected &&
            versionSignaturesCompatible(
              candidateVersionSignature,
              setEntry.versionSignature
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
              setEntry.versionSignature
            )
          ) {
            return true;
          }

          if (
            setEntry.normalizedTitle.includes(normalizedDetected) &&
            versionSignaturesCompatible(
              candidateVersionSignature,
              setEntry.versionSignature
            )
          ) {
            return hasSufficientOverlap(
              normalizedDetected.length,
              setEntry.normalizedTitle.length
            );
          }

          if (
            normalizedDetected.includes(setEntry.normalizedTitle) &&
            versionSignaturesCompatible(
              candidateVersionSignature,
              setEntry.versionSignature
            )
          ) {
            return hasSufficientOverlap(
              setEntry.normalizedTitle.length,
              normalizedDetected.length
            );
          }

          return false;
        });
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
            const normalizedCandidates = [
              {
                normalizedTitle: set.normalizedTitle,
                versionSignature: set.versionSignature,
              },
              ...set.aliases.map((alias) => ({
                normalizedTitle: alias.normalizedTitle,
                versionSignature: alias.versionSignature ?? set.versionSignature,
              })),
            ];
            return normalizedCandidates.some(
              (setEntry) =>
                setEntry.normalizedTitle &&
                setEntry.normalizedTitle.includes(normalizedKeyword) &&
                versionSignaturesCompatible(
                  candidateVersionSignature,
                  setEntry.versionSignature
                )
            );
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

export async function scrapeEventDetail(
  eventUrl: string,
  options: ScrapeEventDetailOptions
): Promise<ScrapedEvent | null> {
  const {
    regionOverride,
    locale,
    render,
    translator,
    listThumbnail,
    listEventTxt,
    listRawDateText,
    listOrder,
  } = options;
  const normalizedListOrder = listOrder ?? null;
  try {
    console.log(`\n🔍 Scraping event: ${eventUrl}`);

    const html = await fetchPageHtml(eventUrl, render);
    if (!html) {
      console.warn(`⚠️  Unable to load event detail: ${eventUrl}`);
      return null;
    }

    const $ = cheerio.load(html);

    // Extrae información básica. Las páginas de /news/ no usan ".eventTit"
    // (eso es solo de /events/) sino ".pageTit"; su único <h1> es el logo del
    // sitio (un <img> sin texto), así que sin este selector el título caía al
    // <title> crudo de la página (con el sufijo "| ONE PIECE CARD GAME -
    // Official Web Site" pegado).
    const structuredTitle =
      $(".eventTit").first().text().trim() || $(".pageTit").first().text().trim();
    const fallbackTitle =
      $("h1").first().text().trim() || $("title").text().trim();
    const title = cleanPageTitle(structuredTitle || fallbackTitle);
    let description: string | null = null;
    const overviewHeading = $("h4, h5, h6")
      .toArray()
      .find((element) =>
        $(element).text().trim().toLowerCase().includes("overview")
      );
    if (overviewHeading) {
      const overviewParagraph = $(overviewHeading)
        .nextAll("p")
        .first()
        .text()
        .trim();
      if (overviewParagraph.length > 0) {
        description = overviewParagraph;
      }
    }
    const categoryText =
      $(".pageTitCategory").first().text().trim() ||
      $(".eventCategory").first().text().trim() ||
      null;

    const detailEventTxt =
      $(".eventTxt .js_eventTxt").first().text().trim() || null;
    const eventTxt = detailEventTxt || listEventTxt || null;

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

    // Extrae el contenido completo
    const contentElement = $(".event-content, .content, main, article").first();
    const sanitizedContentElement =
      contentElement.length > 0 ? contentElement : $("body");
    stripUnwantedEventSections($, sanitizedContentElement);
    const content =
      sanitizedContentElement.text().trim() || $("body").text().trim();
    const originalContent = sanitizedContentElement.html() || null;
    const extractedDateText = extractPeriodText($);
    const dateText =
      extractedDateText || cleanPeriodText(listRawDateText ?? null);

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
      eventTxt,
      listOrder: normalizedListOrder,
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

    // Busca enlaces a eventos usando la grilla actual
    let listPosition = 0;
    $(".eventsColInner a.linkCard[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      const fullUrl = href.startsWith("http")
        ? href
        : new URL(href, baseUrl).toString();

      if (!isValidEventDetailUrl(fullUrl)) {
        return;
      }

      if (seen.has(fullUrl)) {
        return;
      }

      const $element = $(element);
      const thumbnail = extractListThumbnail($, $element, baseUrl);
      const entryRoot = $element.closest(".eventsColBox");
      const listEventTxt =
        entryRoot.find(".linkCardTxt").first().text().trim() || null;
      const listRawDateText = (() => {
        const dateNode = entryRoot.find(".linkCardDate").first();
        if (!dateNode.length) return null;
        const clone = dateNode.clone();
        clone.find("span").remove();
        const text = clone.text().trim();
        return cleanPeriodText(text);
      })();
      const entryOrder = listPosition++;

      seen.add(fullUrl);
      eventEntries.push({
        url: fullUrl,
        thumbnail,
        eventTxt: listEventTxt,
        rawDateText: listRawDateText,
        listOrder: entryOrder,
        sourceType: source.type ?? "current",
      });
    });

    // Fallback: lista legacy
    $('.eventDetail a[href], a[href*="event"]').each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        const fullUrl = href.startsWith("http")
          ? href
          : new URL(href, baseUrl).toString();

        if (!isValidEventDetailUrl(fullUrl)) {
          return;
        }

        if (seen.has(fullUrl)) {
          return;
        }

        const $element = $(element);
        const thumbnail = extractListThumbnail($, $element, baseUrl);
        const entryRoot = $element.closest(".eventDetail");
        const listEventTxt =
          entryRoot.find(".eventTxt .js_eventTxt").first().text().trim() ||
          null;
        const listRawDateText = (() => {
          const dateNode = entryRoot.find(".eventDate").first();
          if (!dateNode.length) return null;
          const clone = dateNode.clone();
          clone.find("span").remove();
          const text = clone.text().trim();
          return cleanPeriodText(text);
        })();
        const entryOrder = listPosition++;

        seen.add(fullUrl);
        eventEntries.push({
          url: fullUrl,
          thumbnail,
          eventTxt: listEventTxt,
          rawDateText: listRawDateText,
          listOrder: entryOrder,
          sourceType: source.type ?? "current",
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
      const existing = seen.get(entry.url);
      if (existing) {
        if (!existing.thumbnail && entry.thumbnail) {
          existing.thumbnail = entry.thumbnail;
        }
        if (!existing.eventTxt && entry.eventTxt) {
          existing.eventTxt = entry.eventTxt;
        }
        if (!existing.rawDateText && entry.rawDateText) {
          existing.rawDateText = entry.rawDateText;
        }
        if (
          (existing.listOrder === null || existing.listOrder === undefined) &&
          typeof entry.listOrder === "number"
        ) {
          existing.listOrder = entry.listOrder;
        }
        if (!existing.sourceType && entry.sourceType) {
          existing.sourceType = entry.sourceType;
        }
        continue;
      }
      const copy = { ...entry };
      seen.set(entry.url, copy);
      collected.push(copy);
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

    const currentSourceSlugs = new Set<string>();
    let touchedCurrentSource = false;

    // 2. Procesa cada evento con límite global
    for (const entry of eventEntries) {
      const entrySourceType = entry.sourceType ?? "current";
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
        listEventTxt: entry.eventTxt ?? null,
        listRawDateText: entry.rawDateText ?? null,
        listOrder: entry.listOrder ?? null,
      });

      if (!scrapedEvent) {
        result.errors.push(`Failed to scrape: ${eventUrl}`);
        continue;
      }

      if (
        entrySourceType === "past" &&
        scrapedEvent.status !== EventStatus.COMPLETED
      ) {
        // Past feeds should only surface finished events; normalize their status.
        scrapedEvent.status = EventStatus.COMPLETED;
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
        let matchedSetsWithDetails: Array<
          MatchedSet & {
            images: string[];
            cards: Array<{
              id: number;
              title: string;
              code: string | null;
              image: string | null;
            }>;
          }
        > = matchedSets.map((set) => ({
          ...set,
          images: [],
          cards: [],
        }));
        if (matchedSets.length > 0) {
          const setIds = matchedSets.map((set) => set.id);
          const setDetails = await prisma.set.findMany({
            where: { id: { in: setIds } },
            include: {
              cards: {
                include: {
                  card: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      src: true,
                    },
                  },
                },
                orderBy: { cardId: "asc" },
                take: 20,
              },
            },
          });
          matchedSetsWithDetails = matchedSets.map((set) => {
            const detail = setDetails.find((item) => item.id === set.id);
            const images: string[] = [];
            if (detail?.image) {
              images.push(detail.image);
            }
            const cards =
              detail?.cards?.map((setCard) => ({
                id: setCard.card.id,
                title: setCard.card.name,
                code: setCard.card.code,
                image: setCard.card.src,
              })) ?? [];
            return { ...set, images, cards };
          });
        }

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
              eventTxt: scrapedEvent.eventTxt,
              listOrder: scrapedEvent.listOrder,
              isApproved: true,
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
              eventTxt: scrapedEvent.eventTxt,
              listOrder: scrapedEvent.listOrder,
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
          sets: matchedSetsWithDetails.map((matchedSet) => ({
            id: matchedSet.id,
            title: matchedSet.title,
            match: matchedSet.matchedText,
            images: matchedSet.images,
            cards: matchedSet.cards,
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
          eventTxt: scrapedEvent.eventTxt,
          listOrder: scrapedEvent.listOrder,
          missingSets: dedupedMissingSets,
          cards: dedupedCards,
        });

        if (!dryRun && entrySourceType !== "past") {
          touchedCurrentSource = true;
          currentSourceSlugs.add(slug);
        }
      } catch (dbError) {
        const error = dbError as Error;
        result.errors.push(
          `Database error for ${scrapedEvent.title}: ${error.message}`
        );
        console.error("❌ Database error:", error);
      }

    }

    if (!dryRun && touchedCurrentSource) {
      const slugs = Array.from(currentSourceSlugs);
      if (slugs.length > 0) {
        await prisma.event.updateMany({
          where: {
            status: { in: [EventStatus.UPCOMING, EventStatus.ONGOING] },
            slug: { notIn: slugs },
          },
          data: {
            status: EventStatus.COMPLETED,
            listOrder: null,
          },
        });
      } else {
        await prisma.event.updateMany({
          where: { status: { in: [EventStatus.UPCOMING, EventStatus.ONGOING] } },
          data: {
            status: EventStatus.COMPLETED,
            listOrder: null,
          },
        });
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
