import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';
import { EventRegion, EventStatus, EventType } from '@prisma/client';

interface ScrapedEvent {
  title: string;
  description: string | null;
  content: string | null;
  originalContent: string | null;
  region: EventRegion;
  status: EventStatus;
  eventType: EventType;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  detectedSets: string[];
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
  }>;
}

// Palabras clave para detectar sets conocidos
const SET_KEYWORDS = [
  'Tournament Pack',
  'Promotion Pack',
  'Booster Pack',
  'Standard Battle Pack',
  'Premium Card Collection',
  'Starter Deck',
  'OP-',
  'ST-',
  'PRB-',
  'P-',
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

/**
 * Detecta sets en el texto del evento
 */
function detectSets(text: string): string[] {
  const detectedSets: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of SET_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKeyword);

    if (index !== -1) {
      // Extrae el contexto alrededor de la palabra clave (hasta 100 caracteres)
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + 80);
      const context = text.substring(start, end).trim();

      detectedSets.push(context);
    }
  }

  return detectedSets;
}

/**
 * Busca sets en la base de datos que coincidan con el texto detectado
 */
async function findMatchingSets(detectedTexts: string[]): Promise<number[]> {
  const setIds: number[] = [];

  for (const text of detectedTexts) {
    // Busca sets cuyo título contenga parte del texto detectado
    const sets = await prisma.set.findMany({
      where: {
        title: {
          contains: text,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (sets.length > 0) {
      console.log(`✓ Matched "${text}" -> ${sets.map(s => s.title).join(', ')}`);
      setIds.push(...sets.map(s => s.id));
    } else {
      // Intenta búsqueda más flexible por palabras clave
      const keywords = text.match(/\b(OP-\d+|ST-\d+|Tournament Pack Vol\.\s*\d+|Promotion Pack \d+)\b/gi);

      if (keywords && keywords.length > 0) {
        for (const keyword of keywords) {
          const flexibleSets = await prisma.set.findMany({
            where: {
              OR: [
                { title: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              title: true,
            },
          });

          if (flexibleSets.length > 0) {
            console.log(`✓ Flexible match "${keyword}" -> ${flexibleSets.map(s => s.title).join(', ')}`);
            setIds.push(...flexibleSets.map(s => s.id));
          }
        }
      }
    }
  }

  // Elimina duplicados
  const uniqueSetIds = Array.from(new Set(setIds));
  return uniqueSetIds;
}

/**
 * Scrapea un evento individual
 */
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
    const title = $('h1').first().text().trim() || $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || null;

    // Extrae el contenido completo
    const contentElement = $('.event-content, .content, main, article').first();
    const content = contentElement.text().trim() || $('body').text().trim();
    const originalContent = contentElement.html() || null;

    // Extrae imagen
    const imageUrl = $('meta[property="og:image"]').attr('content') ||
                     $('img').first().attr('src') || null;

    // Detecta región, tipo y fechas
    const fullText = `${title} ${description || ''} ${content}`;
    const region = detectRegion(fullText);
    const eventType = detectEventType(fullText);
    const { startDate, endDate } = parseDates(fullText);
    const status = detectEventStatus(startDate, endDate);

    // Extrae ubicación
    const location = $('.location, .venue').first().text().trim() || null;

    // Detecta sets mencionados
    const detectedSets = detectSets(content);

    console.log(`  Title: ${title}`);
    console.log(`  Region: ${region}`);
    console.log(`  Type: ${eventType}`);
    console.log(`  Sets detected: ${detectedSets.length}`);

    return {
      title,
      description,
      content,
      originalContent,
      region,
      status,
      eventType,
      startDate,
      endDate,
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
async function scrapeEventsList(
  baseUrl = 'https://en.onepiece-cardgame.com/events/list.php',
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

    // Busca enlaces a eventos
    $('a[href*="event"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http')
          ? href
          : new URL(href, baseUrl).toString();

        // Evita duplicados
        if (!eventUrls.includes(fullUrl) && fullUrl.includes('event')) {
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

/**
 * Función principal de scraping
 */
export async function scrapeEvents(): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    success: true,
    eventsProcessed: 0,
    setsLinked: 0,
    errors: [],
    events: [],
  };

  try {
    console.log('🚀 Starting event scraper...\n');

    // 1. Obtiene lista de eventos
    const eventUrls = await scrapeEventsList();

    if (eventUrls.length === 0) {
      result.success = false;
      result.errors.push('No events found to scrape');
      return result;
    }

    // 2. Procesa cada evento (limita a 10 para evitar sobrecarga)
    const urlsToProcess = eventUrls.slice(0, 10);

    for (const eventUrl of urlsToProcess) {
      const scrapedEvent = await scrapeEventDetail(eventUrl);

      if (!scrapedEvent) {
        result.errors.push(`Failed to scrape: ${eventUrl}`);
        continue;
      }

      try {
        // Genera slug único
        const slug = generateSlug(scrapedEvent.title, scrapedEvent.region, scrapedEvent.sourceUrl);

        // 3. Busca sets coincidentes
        const matchedSetIds = await findMatchingSets(scrapedEvent.detectedSets);

        // 4. Crea o actualiza el evento
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

        result.eventsProcessed++;
        result.events.push({
          slug,
          title: scrapedEvent.title,
          sets: matchedSetIds.map(id => `Set ID: ${id}`),
        });

        console.log(`✅ Saved event: ${slug} (${matchedSetIds.length} sets linked)`);

      } catch (dbError) {
        const error = dbError as Error;
        result.errors.push(`Database error for ${scrapedEvent.title}: ${error.message}`);
        console.error('❌ Database error:', error);
      }

      // Pequeña pausa entre requests para no sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 1000));
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
