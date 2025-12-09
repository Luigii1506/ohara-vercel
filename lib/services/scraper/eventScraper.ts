import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "../../prisma";
import { setCodes as rawSetCodes, standarDecks as rawStandardDecks } from "../../../helpers/constants";
import {
  EventRegion,
  EventStatus,
  EventType,
  EventCategory,
} from "@prisma/client";

type EventListSourceType = "current" | "past";

export interface EventListSource {
  url: string;
  label?: string;
  type?: EventListSourceType;
  limit?: number;
}

export interface ScrapedEvent {
  title: string;
  description: string | null;
  content: string | null;
  originalContent: string | null;
  region: EventRegion;
  status: EventStatus;
  eventType: EventType;
  category: EventCategory | null;
  startDate: Date | null;
  endDate: Date | null;
  rawDateText: string | null;
  location: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  detectedSets: DetectedSetCandidate[];
  detectedCards: DetectedCardCandidate[];
}

interface CachedSet {
  id: number;
  title: string;
  code: string | null;
  normalizedTitle: string;
  versionSignature: string | null;
}

interface ScrapeResult {
  success: boolean;
  eventsProcessed: number;
  setsLinked: number;
  errors: string[];
  events: Array<{
    slug: string;
    title: string;
    sets: Array<{
      id: number;
      title: string;
      match: string;
    }>;
    dryRun?: boolean;
    region: EventRegion;
    status: EventStatus;
    eventType: EventType;
    category: EventCategory | null;
    startDate: string | null;
    endDate: string | null;
    rawDateText: string | null;
    location: string | null;
    sourceUrl: string;
    missingSets: Array<{
      title: string;
      images: string[];
    }>;
    cards: Array<{
      code: string;
      title: string;
      image: string | null;
    }>;
  }>;
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
}

interface DetectedCardCandidate {
  code: string;
  title: string;
  image: string | null;
}

export interface ScrapeEventsOptions {
  sources?: EventListSource[];
  maxEvents?: number;
  perSourceLimit?: number;
  delayMs?: number;
  dryRun?: boolean;
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

export const DEFAULT_EVENT_LIST_SOURCES: EventListSource[] = [
  {
    url: CURRENT_EVENTS_URL,
    label: "global-current",
    type: "current",
  },
];

export const PAST_EVENT_LIST_SOURCE: EventListSource = {
  url: PAST_EVENTS_URL,
  label: "global-past",
  type: "past",
  limit: 20,
};

const DEFAULT_MAX_EVENTS = 25;
const DEFAULT_PER_SOURCE_LIMIT = 25;
const DEFAULT_REQUEST_DELAY_MS = 1000;

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

const SET_TEXT_HINTS = [
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
];

const SET_INDICATOR_KEYWORDS = [
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
];

const ALL_SET_HINTS = Array.from(
  new Set([...SET_TEXT_HINTS, ...SET_INDICATOR_KEYWORDS])
);

const SET_PRIMARY_KEYWORDS = [
  "pack",
  "set",
  "deck",
  "sleeve",
  "collection",
  "promotion",
  "trophy",
  "playmat",
  "uncut sheet",
];

const SET_BANNED_KEYWORDS = ["booster pack"];

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

const HEADING_SPAN_NOISE_PATTERNS: RegExp[] = [
  /cards?\s+per\s+pack/i,
  /total\s+of/i,
  /legal\s+date/i,
  /tickets?/i,
  /^\*/,
  /please\s+note/i,
];

const HEADING_SPAN_KEEP_PATTERN =
  /(vol(?:ume)?|season|ver(?:sion)?|set|series|round|pack|phase|edition|top player|winner|judge|participation|event|finalist|trophy)/i;

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
  result = result.replace(/(season|ver|version|vol|volume|series|round)(\d{1,3})$/i, "");
  result = result.replace(/(pack|set)(\d{1,3})$/i, "$1");
  result = result.replace(/(season|ver|version|vol|volume|series|round)$/i, "");
  result = result.replace(/([a-z])(\d{1,2})$/i, "$1");
  return result;
}

function isKnownSetCodeKeyword(value: string): boolean {
  const normalized = value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return NORMALIZED_SET_CODES.includes(normalized);
}

function hasSufficientOverlap(shorterLength: number, longerLength: number): boolean {
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
function parseDates(text: string): {
  startDate: Date | null;
  endDate: Date | null;
} {
  // Busca patrones de fecha comunes
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY
    /(\d{4})-(\d{2})-(\d{2})/g, // YYYY-MM-DD
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
  ];

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
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

function shouldConsiderSetText(text: string): boolean {
  const lower = text.toLowerCase();
  if (SET_BANNED_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }
  return SET_PRIMARY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function shouldPreserveHeadingSpanText(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = canonicalizeSetDisplay(text).trim();
  if (!normalized) return false;
  if (HEADING_SPAN_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  if (/^\d+(st|nd|rd|th)?$/i.test(normalized)) {
    return true;
  }
  if (/^[ivxlcdm]+$/i.test(normalized)) {
    return true;
  }
  return HEADING_SPAN_KEEP_PATTERN.test(normalized);
}

function extractHeadingText(
  $heading: cheerio.Cheerio<any>,
  rootApi: cheerio.CheerioAPI
): string {
  const headingHtml = rootApi.html($heading.clone()) || "";
  if (!headingHtml) {
    return $heading.text().trim();
  }
  const $local = cheerio.load(headingHtml);
  $local("span").each((_, span) => {
    const $span = $local(span);
    const spanText = $span.text();
    if (shouldPreserveHeadingSpanText(spanText)) {
      $span.replaceWith(` ${spanText} `);
    } else {
      $span.remove();
    }
  });
  return $local.root().text().replace(/\s+/g, " ").trim();
}

function cleanSetCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  let result = value.replace(/[•·・]/g, " ");
  result = result.replace(/\s+/g, " ");
  result = result.replace(/^[−–—\s·•・]+/, "");
  result = result.replace(/\b(x|×)\s*\d+\b/gi, "");
  result = result.replace(/[\u200B-\u200D\uFEFF]/g, "");
  result = result.replace(/(trophy)\s+card.*$/i, "$1");

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
      const secondIsPrimary = SET_PRIMARY_KEYWORDS.some((keyword) =>
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
  result = result.replace(/\u30FC/g, "-");
  result = result.replace(/\uFF70/g, "-");
  result = result.replace(/\s*-\s*/g, "-");
  result = result.replace(/\s*\(\s*/g, " (");
  result = result.replace(/\s*\)/g, ")");
  result = result.replace(/\(\s*([^)]+?)\s*\)/g, (_, inner) => `(${inner.replace(/\s+/g, " ").trim()})`);
  result = result.replace(/\)\(/g, ") (");
  result = result.replace(/(\d+)\s*pcs/gi, "$1 pcs");
  if ((result.match(/\(/g)?.length || 0) > (result.match(/\)/g)?.length || 0)) {
    result = result.replace(/\([^)]*$/, "");
  }
  result = result.replace(/\(\s*\d+\s*\)$/g, "");
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

function removeCountParentheses(value: string): string {
  return value.replace(/\(\s*\d+\s*pcs?\s*\)/gi, "").replace(/\s+/g, " ").trim();
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

function extractCardCode(text: string | undefined): { code: string; match: string } | null {
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

function extractCardTitle(rawText: string, codeMatch: string, fallback?: string): string {
  const cleaned = rawText.replace(codeMatch, "").replace(/[\s:–-]+$/, "").trim();
  if (cleaned.length > 0) {
    return cleaned;
  }
  return fallback?.trim() || "";
}

function dedupeMissingCandidates(candidates: DetectedSetCandidate[]): DetectedSetCandidate[] {
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
    const countNormalized = removeCountParentheses(canonicalTitle).toLowerCase();
    const parenPackNormalized = removeTrailingParenPack(canonicalTitle).toLowerCase();
    const packArtifactNormalized = removeTrailingPackArtifacts(canonicalTitle).toLowerCase();
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
      registerKeys(existing, keys);
      continue;
    }

    const normalizedCandidate: DetectedSetCandidate = {
      title: canonicalTitle,
      images: Array.from(new Set(candidate.images)),
      versionSignature: candidate.versionSignature ?? extractVersionSignature(canonicalTitle),
    };

    registerKeys(normalizedCandidate, keys);
    mergedCandidates.push(normalizedCandidate);
  }

  return mergedCandidates;
}

function dedupeCardCandidates(candidates: DetectedCardCandidate[]): DetectedCardCandidate[] {
  const map = new Map<string, DetectedCardCandidate>();
  for (const candidate of candidates) {
    const canonicalTitle = canonicalizeSetDisplay(candidate.title || "").toLowerCase();
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

function resolveImageUrl(src: string | undefined, baseUrl: string): string | null {
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

  const scopedImages = siblingRange
    .find("img")
    .add(siblingRange.filter("img"));

  let imageElements = scopedImages;

  if (imageElements.length === 0) {
    const nextPackCol = $heading.nextAll(
      ".eventPackCol, .cardPackCol, .includecardBox"
    ).first();

    if (nextPackCol.length > 0) {
      imageElements = nextPackCol.find("img");
    }
  }

  if (imageElements.length === 0) {
    imageElements = $scope.find("img").first();
  }

  imageElements.each((__, img) => {
    const attribs = (img as any)?.attribs || {};
    const resolved = resolveImageUrl(attribs.src as string | undefined, baseUrl);
    if (resolved) {
      imagesSet.add(resolved);
      if (!firstAlt && typeof attribs.alt === "string" && attribs.alt.trim().length) {
        firstAlt = attribs.alt.trim();
      }
    }
  });

  return { images: Array.from(imagesSet), firstAlt };
}

function detectSetsAndCards(
  $: cheerio.CheerioAPI,
  baseUrl: string
): { sets: DetectedSetCandidate[]; cards: DetectedCardCandidate[] } {
  const setCandidates: DetectedSetCandidate[] = [];
  const cardCandidates: DetectedCardCandidate[] = [];

  $("section").each((_, section) => {
    const classAttr = ($(section).attr("class") || "").toLowerCase();
    if (
      !classAttr.includes("contentsmcol") &&
      !classAttr.includes("contentslcol") &&
      !classAttr.includes("mtl")
    ) {
      return;
    }

    const $section = $(section);
    const headings = $section.find("h5, h6");
    if (headings.length === 0) return;

    const extractTitle = ($heading: cheerio.Cheerio<any>) => {
      const rawHeading = extractHeadingText($heading, $);
      const titleText = cleanSetCandidate(rawHeading);
      if (!titleText || !shouldConsiderSetText(titleText)) {
        return null;
      }
      const lowerTitle = titleText.toLowerCase();
      if (lowerTitle.includes("uncut sheet") && !/\[[^\]]+\]/.test(titleText)) {
        return null;
      }
      return titleText;
    };

    const headingNodes = headings.toArray() as any[];
    const h6Nodes = headingNodes.filter((node) => {
      const tag = ($(node).prop("tagName") as string | undefined)?.toLowerCase();
      return tag === "h6";
    });

    const pushCandidatesFromNodes = (nodes: any[]) => {
      let pushed = false;
      nodes.forEach((node) => {
        const $heading = $(node);
        const rawText = extractHeadingText($heading, $);

        const codeInfo =
          extractCardCode(rawText) || extractCardCode($section.attr("id"));

        const imageData = collectImagesAroundHeading($heading, $section, baseUrl);

        if (codeInfo) {
          let cardTitle = extractCardTitle(rawText, codeInfo.match, imageData.firstAlt);
          if (!cardTitle && imageData.firstAlt) {
            cardTitle = imageData.firstAlt;
          }
          cardCandidates.push({
            code: codeInfo.code,
            title: cardTitle || codeInfo.code,
            image: imageData.images[0] || null,
          });
          pushed = true;
          return;
        }

        const containsDon = /don!!/i.test(rawText);
        if (containsDon && !/pack/i.test(rawText)) {
          const donTitle = canonicalizeSetDisplay(rawText) || "DON!! Card";
          cardCandidates.push({
            code: "DON!!",
            title: donTitle,
            image: imageData.images[0] || null,
          });
          pushed = true;
          return;
        }

        const titleText = cleanSetCandidate(rawText);
        if (!titleText || !shouldConsiderSetText(titleText)) {
          return;
        }

        const lowerTitle = titleText.toLowerCase();
        if (lowerTitle.includes("uncut sheet") && !/\[[^\]]+\]/.test(titleText)) {
          return;
        }

        setCandidates.push({
          title: titleText,
          images: imageData.images,
          versionSignature: extractVersionSignature(titleText),
        });
        pushed = true;
      });
      return pushed;
    };

    if (h6Nodes.length > 0) {
      const pushed = pushCandidatesFromNodes(h6Nodes);
      if (!pushed) {
        pushCandidatesFromNodes(headingNodes);
      }
    } else {
      pushCandidatesFromNodes(headingNodes);
    }
  });

  return { sets: setCandidates, cards: cardCandidates };
}

/**
 * Busca sets en la base de datos que coincidan con el texto detectado
 */
async function findMatchingSets(
  detectedTexts: DetectedSetCandidate[]
): Promise<{ matches: MatchedSet[]; unmatchedCandidates: DetectedSetCandidate[] }> {
  const setsCache = await loadSetsCache();
  const matchedMap = new Map<number, MatchedSet>();
  const unmatchedCandidates: DetectedSetCandidate[] = [];

  for (const candidate of detectedTexts) {
    const text = candidate.title;
    const normalizedDetected = normalizeString(text);
    const baseNormalizedDetected = stripVersionSuffix(normalizedDetected);
    const candidateVersionSignature =
      candidate.versionSignature ?? extractVersionSignature(candidate.title);
    if (!normalizedDetected || normalizedDetected.length < 4) {
      continue;
    }

    let matched = false;

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
        }
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
  eventUrl: string
): Promise<ScrapedEvent | null> {
  try {
    console.log(`\n🔍 Scraping event: ${eventUrl}`);

    const response = await axios.get(eventUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

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
    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $("img").first().attr("src") ||
      null;

    // Detecta región, tipo y fechas
    const fullText = `${title} ${description || ""} ${categoryText || ""} ${
      dateText || ""
    } ${content}`;
    const region = detectRegion(fullText);
    const eventType = detectEventType(fullText);
    const { startDate, endDate } = parseDates(dateText || fullText);
    const category = detectEventCategory(categoryText);
    const status = detectEventStatus(startDate, endDate);

    // Extrae ubicación
    const location = extractLocationText($);

    // Detecta sets y cartas mencionados
    const { sets: detectedSets, cards: detectedCards } = detectSetsAndCards(
      $,
      eventUrl
    );

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
      status,
      eventType,
      category,
      startDate,
      endDate,
      rawDateText: dateText,
      location,
      sourceUrl: eventUrl,
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
  baseUrl = CURRENT_EVENTS_URL,
  targetRegions: EventRegion[] = [
    EventRegion.NA,
    EventRegion.EU,
    EventRegion.LA,
  ]
): Promise<string[]> {
  try {
    console.log(`\n📋 Fetching events list from: ${baseUrl}`);

    const response = await axios.get(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const eventUrls: string[] = [];

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

        if (!eventUrls.includes(fullUrl)) {
          eventUrls.push(fullUrl);
        }
      }
    });

    console.log(`  Found ${eventUrls.length} potential event URLs`);

    return eventUrls;
  } catch (error) {
    console.error("❌ Error fetching events list:", error);
    return [];
  }
}

async function collectEventUrlsFromSources(
  sources: EventListSource[],
  perSourceLimit: number,
  maxEvents: number
): Promise<string[]> {
  const collected: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (collected.length >= maxEvents) break;

    const urls = await scrapeEventsList(source.url);
    if (urls.length === 0) {
      console.warn(
        `⚠️  No events returned for source: ${source.label || source.url}`
      );
      continue;
    }

    const limit = source.limit ?? perSourceLimit;
    const limitedUrls = limit > 0 ? urls.slice(0, limit) : urls;

    console.log(
      `  Source ${source.label || source.url} (${source.type || "current"}): ` +
        `${limitedUrls.length} URLs considered`
    );

    for (const eventUrl of limitedUrls) {
      if (collected.length >= maxEvents) break;
      if (seen.has(eventUrl)) continue;
      seen.add(eventUrl);
      collected.push(eventUrl);
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
  } = options;

  try {
    console.log("🚀 Starting event scraper...\n");

    // 1. Obtiene lista de eventos desde las fuentes configuradas
    const eventUrls = await collectEventUrlsFromSources(
      sources,
      perSourceLimit,
      maxEvents
    );

    if (eventUrls.length === 0) {
      result.success = false;
      result.errors.push("No events found to scrape");
      return result;
    }

    console.log(`\n📌 Processing ${eventUrls.length} unique event URLs`);

    // 2. Procesa cada evento con límite global
    for (const eventUrl of eventUrls) {
      const scrapedEvent = await scrapeEventDetail(eventUrl);

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
        const { matches: matchedSets, unmatchedCandidates } = await findMatchingSets(
          scrapedEvent.detectedSets
        );

        const dedupedMissingSets = dedupeMissingCandidates(unmatchedCandidates);
        const dedupedCards = dedupeCardCandidates(scrapedEvent.detectedCards);

        if (dedupedMissingSets.length > 0) {
          console.warn(
            `⚠️  ${dedupedMissingSets.length} detected set references without match for ${slug}:`,
            dedupedMissingSets.map((candidate) => candidate.title)
          );
        }

        // 4. Crea o actualiza el evento
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
              region: scrapedEvent.region,
              status: scrapedEvent.status,
              eventType: scrapedEvent.eventType,
              category: scrapedEvent.category,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              location: scrapedEvent.location,
              sourceUrl: scrapedEvent.sourceUrl,
              imageUrl: scrapedEvent.imageUrl,
            },
            update: {
              title: scrapedEvent.title,
              description: scrapedEvent.description,
              content: scrapedEvent.content,
              originalContent: scrapedEvent.originalContent,
              region: scrapedEvent.region,
              status: scrapedEvent.status,
              eventType: scrapedEvent.eventType,
              category: scrapedEvent.category,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              location: scrapedEvent.location,
              sourceUrl: scrapedEvent.sourceUrl,
              imageUrl: scrapedEvent.imageUrl,
            },
          });

          // 5. Vincula sets
          for (const matchedSet of matchedSets) {
            await prisma.eventSet.upsert({
              where: {
                eventId_setId: {
                  eventId: event.id,
                  setId: matchedSet.id,
                },
              },
              create: {
                eventId: event.id,
                setId: matchedSet.id,
              },
              update: {},
            });

            result.setsLinked++;
          }

          console.log(
            `✅ Saved event: ${slug} (${matchedSets.length} sets linked)`
          );
        }

        result.eventsProcessed++;
        result.events.push({
          slug,
          title: scrapedEvent.title,
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
  }

  return result;
}
interface VersionEntry {
  value: string;
  position: number;
  keywordPosition: number;
  isKeyword: boolean;
}

function getDigitBounds(match: RegExpExecArray, digits: string): {
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

function shouldSkipHyphenatedRange(canonical: string, endIndex: number): boolean {
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
    addEntry(digits, bounds.start, bounds.end, match.index ?? bounds.start, true);
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
    addEntry(digits, bounds.start, bounds.end, match.index ?? bounds.start, true);
  }

  const packNumberPattern = /pack(?:\s+|\-)?(\d{1,2})(?!\d)/gi;
  while ((match = packNumberPattern.exec(canonical))) {
    const digits = match[1];
    const bounds = getDigitBounds(match, digits);
    addEntry(digits, bounds.start, bounds.end, match.index ?? bounds.start, true);
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

function extractVersionSignature(text: string | null | undefined): string | null {
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
