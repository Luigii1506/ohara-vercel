import { NextRequest, NextResponse } from "next/server";
import {
  scrapeEvents,
  DEFAULT_EVENT_LIST_SOURCES,
  PAST_EVENT_LIST_SOURCES,
  discoverChampionshipHubUrls,
  scrapeAndPersistEventUrl,
} from "@/lib/services/scraper/eventScraper";

export const maxDuration = 300;

/**
 * API Route para scraping de eventos mediante Cron Job
 *
 * Uso:
 * POST /api/cron/scrape-events
 * Headers: Authorization: Bearer YOUR_CRON_SECRET
 *
 * En Vercel Cron (vercel.json):
 * {
 *   "crons": [{que hace
 *     "path": "/api/cron/scrape-events",
 *     "schedule": "0 0 * * 0"  // Cada domingo a medianoche
 *   }]
 * }
 */

const authenticate = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET not configured");
  }
  const expectedAuth = `Bearer ${cronSecret}`;
  if (authHeader !== expectedAuth) {
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    throw error;
  }
};

async function runScrape(request: NextRequest) {
  authenticate(request);

  console.log("🤖 Cron job: Starting event scraper...");
  const startTime = Date.now();

  // Además de la lista de eventos ACTUALES, incluye las páginas de archivo
  // (list_end.php / list_archive.php) — ya estaban configuradas como fuente
  // pero el cron nunca las usaba, así que eventos viejos sin link visible en
  // la lista principal se quedaban sin scrapear. maxEvents sube para que el
  // cupo de "actuales" no se lo coman las URLs de archivo (current va primero
  // en el array y siempre tiene prioridad si el cupo se llenara).
  const result = await scrapeEvents({
    sources: [...DEFAULT_EVENT_LIST_SOURCES, ...PAST_EVENT_LIST_SOURCES].map(
      (source) => ({ ...source })
    ),
    maxEvents: 80,
  });

  // Hubs de temporada de Championship (/events/<año>/championship/): cada
  // temporada nueva, la lista principal deja de apuntar al hub de la
  // temporada anterior (aunque siga vivo) y todo lo que cuelga de él — World
  // Final, regionales, store championships — se pierde en silencio hasta que
  // alguien lo nota a mano (confirmado real con World Final 25-26). Barato
  // de revisar cada corrida: 3 años, unas pocas URLs de sub-evento cada uno.
  const currentYear = new Date().getFullYear();
  let hubEventsProcessed = 0;
  const hubErrors: string[] = [];
  try {
    const hubUrls = await discoverChampionshipHubUrls([
      currentYear,
      currentYear - 1,
      currentYear - 2,
    ]);
    for (const url of hubUrls) {
      try {
        const persisted = await scrapeAndPersistEventUrl(url);
        if (persisted) hubEventsProcessed++;
        else hubErrors.push(`scrape failed: ${url}`);
      } catch (e) {
        hubErrors.push(`${url}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    hubErrors.push(`hub discovery failed: ${(e as Error).message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const response = {
    success: result.success,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    stats: {
      eventsProcessed: result.eventsProcessed,
      setsLinked: result.setsLinked,
      errors: result.errors.length,
      hubEventsProcessed,
      hubErrors: hubErrors.length,
    },
    events: result.events,
    errors: [...result.errors, ...hubErrors],
  };

  console.log("✅ Cron job completed:", response.stats);

  return NextResponse.json(response, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    return await runScrape(request);
  } catch (error) {
    const err = error as Error;
    const status = (err as any)?.status ?? 500;
    console.error("❌ Cron job failed:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  const hasAuth = Boolean(request.headers.get("authorization"));
  if (!hasAuth) {
    return NextResponse.json(
      {
        message: "Event scraper cron endpoint",
        method: "POST or GET with Authorization header",
        auth: "Required: Authorization: Bearer CRON_SECRET",
        status: "active",
      },
      { status: 200 }
    );
  }

  return POST(request);
}
