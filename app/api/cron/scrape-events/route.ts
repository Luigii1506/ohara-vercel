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
export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("⚠️  CRON_SECRET not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      console.error("❌ Unauthorized cron attempt");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Ejecutar scraper
    console.log("🤖 Cron job: Starting event scraper...");
    const startTime = Date.now();

    const result = await scrapeEvents({
      // Solo usamos fuentes de eventos actuales por defecto
      sources: DEFAULT_EVENT_LIST_SOURCES.map((source) => ({ ...source })),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 3. Preparar respuesta
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
  } catch (error) {
    const err = error as Error;
    console.error("❌ Cron job failed:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint para verificar que la ruta está activa
 */
export async function GET() {
  return NextResponse.json(
    {
      message: "Event scraper cron endpoint",
      method: "POST",
      auth: "Required: Authorization: Bearer CRON_SECRET",
      status: "active",
    },
    { status: 200 }
  );
}
