export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import {
  scrapeEvents,
  LANGUAGE_EVENT_SOURCES,
  type ScrapeEventsOptions,
  type EventListSource,
  type RenderMode,
} from "@/lib/services/scraper/eventScraper";

const FALLBACK_LANGUAGE = "en";

interface AdminScraperRequest {
  languages?: string[];
  includeCurrent?: boolean;
  includePast?: boolean;
  perSourceLimit?: number | null;
  maxEvents?: number | null;
  renderMode?: RenderMode;
  renderWaitMs?: number | null;
  delayMs?: number | null;
  customUrls?: string[];
  dryRun?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdminScraperRequest;

    const {
      languages = [FALLBACK_LANGUAGE],
      includeCurrent = true,
      includePast = false,
      perSourceLimit,
      maxEvents,
      renderMode = "static",
      renderWaitMs,
      delayMs,
      customUrls = [],
      dryRun = true,
    } = body;

    const normalizedLanguages =
      Array.isArray(languages) && languages.length > 0
        ? languages
        : [FALLBACK_LANGUAGE];

    const sources: EventListSource[] = [];

    normalizedLanguages.forEach((lang) => {
      const config = LANGUAGE_EVENT_SOURCES[lang];
      if (!config) {
        return;
      }
      if (includeCurrent && config.current) {
        sources.push({ ...config.current });
      }
      if (includePast && config.past) {
        sources.push({ ...config.past });
      }
    });

    customUrls
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      .forEach((url, index) => {
        sources.push({
          url: url.trim(),
          label: `custom-${index + 1}`,
        });
      });

    const options: ScrapeEventsOptions = {
      dryRun: dryRun !== false,
      renderMode,
    };

    if (sources.length > 0) {
      options.sources = sources;
    }
    if (typeof perSourceLimit === "number" && perSourceLimit > 0) {
      options.perSourceLimit = Math.floor(perSourceLimit);
    }
    if (typeof maxEvents === "number" && maxEvents > 0) {
      options.maxEvents = Math.floor(maxEvents);
    }
    if (typeof renderWaitMs === "number" && renderWaitMs >= 0) {
      options.renderWaitMs = Math.floor(renderWaitMs);
    }
    if (typeof delayMs === "number" && delayMs >= 0) {
      options.delayMs = Math.floor(delayMs);
    }

    const startedAt = Date.now();
  const result = await scrapeEvents(options);
  const durationMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        success: result.success,
        durationMs,
        eventsProcessed: result.eventsProcessed,
        setsLinked: result.setsLinked,
        errors: result.errors,
        events: result.events,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Admin scraper test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
