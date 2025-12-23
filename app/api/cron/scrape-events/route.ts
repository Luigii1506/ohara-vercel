import { NextRequest, NextResponse } from "next/server";
import {
  scrapeEvents,
  DEFAULT_EVENT_LIST_SOURCES,
} from "@/lib/services/scraper/eventScraper";

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

  const result = await scrapeEvents({
    sources: DEFAULT_EVENT_LIST_SOURCES.map((source) => ({ ...source })),
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const response = {
    success: result.success,
    timestamp: new Date().toISOString(),
    duration: `${duration}s`,
    stats: {
      eventsProcessed: result.eventsProcessed,
      setsLinked: result.setsLinked,
      errors: result.errors.length,
    },
    events: result.events,
    errors: result.errors,
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
