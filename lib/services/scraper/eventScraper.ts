import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '../../prisma';
import { EventRegion, EventStatus, EventType, EventCategory } from '@prisma/client';

type EventListSourceType = 'current' | 'past';

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
  detectedSets: string[];
}

interface CachedSet {
  id: number;
  title: string;
  code: string | null;
  normalizedTitle: string;
}

interface ScrapeResult {
  success: boolean;
  eventsProcessed: number;
  setsLinked: number;
  errors: string[];
  events: Array<{
    slug: string;
    title: string;
    sets: string[];
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
    missingSets: string[];
  }>;
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
  'Tournament Pack',
  'Promotion Pack',
  'Booster Pack',
  'Standard Battle Pack',
  'Premium Card Collection',
  'Starter Deck',
  'Event Pack',
  'Winner Pack',
  'Judge Pack',
  'Participation Pack',
  'Celebration Pack',
  'Card Set',
  'Sleeve',
  'OP-',
  'ST-',
  'PRB-',
  'P-',
];

const CURRENT_EVENTS_URL = 'https://en.onepiece-cardgame.com/events/list.php';
const PAST_EVENTS_URL = 'https://en.onepiece-cardgame.com/events/list_end.php';

export const DEFAULT_EVENT_LIST_SOURCES: EventListSource[] = [
  {
    url: CURRENT_EVENTS_URL,
    label: 'global-current',
    type: 'current',
  },
];

export const PAST_EVENT_LIST_SOURCE: EventListSource = {
  url: PAST_EVENTS_URL,
  label: 'global-past',
  type: 'past',
  limit: 20,
};

const DEFAULT_MAX_EVENTS = 25;
const DEFAULT_PER_SOURCE_LIMIT = 25;
const DEFAULT_REQUEST_DELAY_MS = 1000;

let cachedSetsPromise: Promise<CachedSet[]> | null = null;

const PRIZE_SECTION_KEYWORDS = [
  'prize',
  'prizes',
  'participation',
  'winner',
  'distribution',
  'reward',
  'kit',
];

const SET_TEXT_HINTS = [
  'pack',
  'deck',
  'sleeve',
  'card set',
  'collection',
  'promotion',
  'celebration',
  'winner',
  'judge',
  'participation',
  'event',
  'trophy',
  'top player',
  'finalist',
  'set',
];

const SET_INDICATOR_KEYWORDS = [
  'pack',
  'event',
  'judge',
  'top player',
  'finalist',
  'trophy',
  'set',
  'sleeve',
  'promotion',
];

const ALL_SET_HINTS = Array.from(new Set([...SET_TEXT_HINTS, ...SET_INDICATOR_KEYWORDS]));

const SET_PRIMARY_KEYWORDS = ['pack', 'set', 'deck', 'sleeve', 'collection', 'promotion', 'trophy'];

const SET_TEXT_STOP_PHRASES = [
  'featured card list',
  'this set will',
  'while supplies last',
  'kit contents change',
  'please note',
  'details',
  'includes',
  'card per pack',
];

const SET_TEXT_SELECTORS = [
  '.extraSmallTit',
  '.includecardTit',
  '.eventPackCol h5',
  '.eventPackCol h6',
  '.eventPackCol .smallTit',
  '.eventPackCol .commonNoticeList li',
  '.eventPackCol .cardPopupWrap li',
  '.commonNoticeList li',
  '.commonNoticeList li a',
  '.cardPopupWrap li',
  '.cardPopupWrap li a',
  '.prizeList li',
  '.rewardList li',
];

// Mapeo de regiones
const REGION_MAP: Record<string, EventRegion> = {
  'north america': EventRegion.NA,
  'na': EventRegion.NA,
  'usa': EventRegion.NA,
  'united states': EventRegion.NA,
  'europe': EventRegion.EU,
  'eu': EventRegion.EU,
  'latin america': EventRegion.LA,
  'la': EventRegion.LA,
  'latam': EventRegion.LA,
  'asia': EventRegion.ASIA,
  'japan': EventRegion.JP,
  'jp': EventRegion.JP,
};

// Mapeo de tipos de eventos
const EVENT_TYPE_MAP: Record<string, EventType> = {
  'store tournament': EventType.STORE_TOURNAMENT,
  'championship': EventType.CHAMPIONSHIP,
  'release event': EventType.RELEASE_EVENT,
  'online': EventType.ONLINE,
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
function generateSlug(title: string, region: EventRegion, sourceUrl: string): string {
  const urlSlug = sourceUrl.split('/').pop()?.replace('.php', '') || '';
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  return `${region.toLowerCase()}-${titleSlug}-${urlSlug}`.replace(/--+/g, '-');
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
function detectEventStatus(startDate: Date | null, endDate: Date | null): EventStatus {
  const now = new Date();

  if (!startDate) return EventStatus.UPCOMING;

  if (startDate > now) return EventStatus.UPCOMING;

  if (endDate && endDate < now) return EventStatus.COMPLETED;

  if (startDate <= now && (!endDate || endDate >= now)) {
    return EventStatus.ONGOING;
  }

  return EventStatus.UPCOMING;
}

function normalizeString(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9]+/g, '');
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
      .then(sets =>
      sets.map(set => ({
        id: set.id,
        title: set.title,
        code: set.code,
        normalizedTitle: normalizeString(set.title),
      }))
    );
  }

  return cachedSetsPromise;
}

/**
 * Parsea fechas del texto del evento
 */
function parseDates(text: string): { startDate: Date | null; endDate: Date | null } {
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

function extractLabeledText($: cheerio.CheerioAPI, label: string): string | null {
  const normalizedLabel = label.toLowerCase();
  const heading = $('h2, h3, h4, h5, h6')
    .filter((_, element) => $(element).text().trim().toLowerCase() === normalizedLabel)
    .first();

  if (heading.length > 0) {
    const text = heading.nextAll('p').first().text().trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function cleanPeriodText(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/^\s*period[:\s]*/i, '').replace(/\s+/g, ' ').trim();
}

function extractPeriodText($: cheerio.CheerioAPI): string | null {
  const inlinePeriod = $('.eventDate').first().text().trim();
  if (inlinePeriod) {
    return cleanPeriodText(inlinePeriod);
  }

  const labeledPeriod = extractLabeledText($, 'Period');
  if (labeledPeriod) {
    return cleanPeriodText(labeledPeriod);
  }

  return null;
}

function extractLocationText($: cheerio.CheerioAPI): string | null {
  const inlineLocation = $('.eventPlace, .location, .venue').first().text().trim();
  if (inlineLocation) {
    return inlineLocation;
  }

  return extractLabeledText($, 'Location');
}

/**
 * Detecta sets en el texto del evento
 */
function extractPrizeRelatedTexts($: cheerio.CheerioAPI): string[] {
  const texts: string[] = [];

  const pushText = (value: string | null | undefined) => {
    const cleaned = cleanSetCandidate(value);
    if (cleaned && shouldConsiderSetText(cleaned)) {
      texts.push(cleaned);
    }
  };

  SET_TEXT_SELECTORS.forEach(selector => {
    $(selector).each((_, element) => {
      const text = $(element).text();
      if (text && ALL_SET_HINTS.some(hint => text.toLowerCase().includes(hint))) {
        pushText(text);
      }
    });
  });

  return texts;
}

function shouldConsiderSetText(text: string): boolean {
  const lower = text.toLowerCase();
  return SET_PRIMARY_KEYWORDS.some(keyword => lower.includes(keyword));
}

function cleanSetCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  let result = value.replace(/[•·・]/g, ' ');
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/^[−–—\s·•・]+/, '');
  result = result.replace(/\b(x|×)\s*\d+\b/gi, '');
  result = result.replace(/\(.*?\)/g, '');

  for (const phrase of SET_TEXT_STOP_PHRASES) {
    const regex = new RegExp(`${phrase}.*$`, 'i');
    result = result.replace(regex, '');
  }

  result = result.replace(/\s+/g, ' ').trim();

  if (!result || result.length < 4) {
    return null;
  }

  return result;
}

function detectSets($: cheerio.CheerioAPI, text: string): string[] {
  const detectedSets: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of SET_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    let searchIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerKeyword, searchIndex);
      if (index === -1) break;

      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + 160);
      const context = cleanSetCandidate(text.substring(start, end));

      if (context && shouldConsiderSetText(context)) {
        detectedSets.push(context);
      }

      searchIndex = index + lowerKeyword.length;
    }
  }

  detectedSets.push(...extractPrizeRelatedTexts($));

  const uniqueSets = Array.from(new Set(detectedSets));

  return uniqueSets;
}

/**
 * Busca sets en la base de datos que coincidan con el texto detectado
 */
async function findMatchingSets(
  detectedTexts: string[]
): Promise<{ matchedIds: number[]; unmatchedTexts: string[] }> {
  const setsCache = await loadSetsCache();
  const matchedIds = new Set<number>();
  const unmatchedTexts: string[] = [];

  for (const text of detectedTexts) {
    const normalizedDetected = normalizeString(text);
    if (!normalizedDetected || normalizedDetected.length < 4) {
      continue;
    }

    let matched = false;

    const matches = setsCache.filter(set => {
      if (set.normalizedTitle && set.normalizedTitle.includes(normalizedDetected)) {
        return true;
      }

      if (set.normalizedTitle && normalizedDetected.includes(set.normalizedTitle)) {
        return true;
      }

      return false;
    });

    if (matches.length > 0) {
      console.log(`✓ Normalized match "${text}" -> ${matches.map(m => m.title).join(', ')}`);
      matches.forEach(match => matchedIds.add(match.id));
      matched = true;
    }

    const keywordMatches = text.match(/\b(OP-?\d+|ST-?\d+|Tournament Pack Vol\.\s*\d+|Promotion Pack \d+)\b/gi);

    if (keywordMatches) {
      for (const keyword of keywordMatches) {
        const normalizedKeyword = normalizeString(keyword);
        const setsByKeyword = setsCache.filter(set => {
          if (set.normalizedTitle && set.normalizedTitle.includes(normalizedKeyword)) {
            return true;
          }

          return false;
        });

        if (setsByKeyword.length > 0) {
          console.log(`✓ Keyword match "${keyword}" -> ${setsByKeyword.map(s => s.title).join(', ')}`);
          setsByKeyword.forEach(match => matchedIds.add(match.id));
          matched = true;
        }
      }
    }

    if (!matched) {
      unmatchedTexts.push(text);
    }
  }

  return {
    matchedIds: Array.from(matchedIds),
    unmatchedTexts,
  };
}

/**
 * Scrapea un evento individual
 */
function cleanPageTitle(title: string): string {
  return title.replace(/\s*[–−-]\s*EVENTS｜ONE PIECE CARD GAME - Official Web Site\s*$/i, '').trim();
}

async function scrapeEventDetail(eventUrl: string): Promise<ScrapedEvent | null> {
  try {
    console.log(`\n🔍 Scraping event: ${eventUrl}`);

    const response = await axios.get(eventUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // Extrae información básica
    const structuredTitle = $('.eventTit').first().text().trim();
    const fallbackTitle = $('h1').first().text().trim() || $('title').text().trim();
    const title = cleanPageTitle(structuredTitle || fallbackTitle);
    const description = $('meta[name="description"]').attr('content') || null;
    const categoryText =
      $('.pageTitCategory').first().text().trim() ||
      $('.eventCategory').first().text().trim() ||
      null;

    // Extrae el contenido completo
    const contentElement = $('.event-content, .content, main, article').first();
    const content = contentElement.text().trim() || $('body').text().trim();
    const originalContent = contentElement.html() || null;
    const dateText = extractPeriodText($);

    // Extrae imagen
    const imageUrl = $('meta[property="og:image"]').attr('content') ||
                     $('img').first().attr('src') || null;

    // Detecta región, tipo y fechas
    const fullText = `${title} ${description || ''} ${categoryText || ''} ${dateText || ''} ${content}`;
    const region = detectRegion(fullText);
    const eventType = detectEventType(fullText);
    const { startDate, endDate } = parseDates(dateText || fullText);
    const category = detectEventCategory(categoryText);
    const status = detectEventStatus(startDate, endDate);

    // Extrae ubicación
    const location = extractLocationText($);

    // Detecta sets mencionados
    const detectedSets = detectSets($, content);

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

    if (!pathname.startsWith('/events/')) return false;

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return false; // descarta /events/ o /events

    const basename = segments[segments.length - 1];
    if (basename.startsWith('list')) return false;

    return true;
  } catch {
    return false;
  }
}

async function scrapeEventsList(
  baseUrl = CURRENT_EVENTS_URL,
  targetRegions: EventRegion[] = [EventRegion.NA, EventRegion.EU, EventRegion.LA]
): Promise<string[]> {
  try {
    console.log(`\n📋 Fetching events list from: ${baseUrl}`);

    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const eventUrls: string[] = [];

    // Busca enlaces a eventos usando la grilla oficial
    $('.eventDetail a[href], a[href*="event"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http')
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
    console.error('❌ Error fetching events list:', error);
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
      console.warn(`⚠️  No events returned for source: ${source.label || source.url}`);
      continue;
    }

    const limit = source.limit ?? perSourceLimit;
    const limitedUrls = limit > 0 ? urls.slice(0, limit) : urls;

    console.log(
      `  Source ${source.label || source.url} (${source.type || 'current'}): ` +
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
export async function scrapeEvents(options: ScrapeEventsOptions = {}): Promise<ScrapeResult> {
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
    console.log('🚀 Starting event scraper...\n');

    // 1. Obtiene lista de eventos desde las fuentes configuradas
    const eventUrls = await collectEventUrlsFromSources(sources, perSourceLimit, maxEvents);

    if (eventUrls.length === 0) {
      result.success = false;
      result.errors.push('No events found to scrape');
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
        const slug = generateSlug(scrapedEvent.title, scrapedEvent.region, scrapedEvent.sourceUrl);

        // 3. Busca sets coincidentes
        const { matchedIds: matchedSetIds, unmatchedTexts } = await findMatchingSets(
          scrapedEvent.detectedSets
        );

        if (unmatchedTexts.length > 0) {
          console.warn(
            `⚠️  ${unmatchedTexts.length} detected set references without match for ${slug}:`,
            unmatchedTexts
          );
        }

        // 4. Crea o actualiza el evento
        if (dryRun) {
          console.log(`📝 Dry run: ${slug} would link ${matchedSetIds.length} sets`);
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
          for (const setId of matchedSetIds) {
            await prisma.eventSet.upsert({
              where: {
                eventId_setId: {
                  eventId: event.id,
                  setId: setId,
                },
              },
              create: {
                eventId: event.id,
                setId: setId,
              },
              update: {},
            });

            result.setsLinked++;
          }

          console.log(`✅ Saved event: ${slug} (${matchedSetIds.length} sets linked)`);
        }

        result.eventsProcessed++;
        result.events.push({
          slug,
          title: scrapedEvent.title,
          sets: matchedSetIds.map(id => `Set ID: ${id}`),
          dryRun: dryRun || undefined,
          region: scrapedEvent.region,
          status: scrapedEvent.status,
          eventType: scrapedEvent.eventType,
          category: scrapedEvent.category,
          startDate: scrapedEvent.startDate ? scrapedEvent.startDate.toISOString() : null,
          endDate: scrapedEvent.endDate ? scrapedEvent.endDate.toISOString() : null,
          rawDateText: scrapedEvent.rawDateText,
          location: scrapedEvent.location,
          sourceUrl: scrapedEvent.sourceUrl,
          missingSets: unmatchedTexts,
        });

      } catch (dbError) {
        const error = dbError as Error;
        result.errors.push(`Database error for ${scrapedEvent.title}: ${error.message}`);
        console.error('❌ Database error:', error);
      }

      // Pequeña pausa entre requests para no sobrecargar el servidor
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
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
    console.error('❌ Fatal error:', error);
  }

  return result;
}
