import { NextRequest, NextResponse } from "next/server";
import { runKrSync } from "@/lib/services/krOfficialSync";

/**
 * Cron de sincronización con el sitio oficial de Corea
 * (onepiece-cardgame.kr). Ver scripts/scrape-onepiece-cardlist-kr.ts para
 * el detalle del scraping — descubre series dinámicamente del propio sitio
 * (ya no depende de una lista fija), así que un set nuevo aparece solo en
 * la siguiente corrida.
 *
 * Corre en modo "solo crear lo que falta" (updateExisting=false, el
 * default) — nunca pisa una carta ya cargada. `set`/`series` acotan a qué
 * series tocar en esta corrida — útil para separar "revisar lo último"
 * (frecuente) de "barrido completo" (poco frecuente), ver vercel.json.
 *
 * Uso:
 *   GET/POST /api/cron/scrape-kr
 *   GET/POST /api/cron/scrape-kr?dryRun=1        (solo calcula, no escribe)
 *   GET/POST /api/cron/scrape-kr?set=OP14,P       (acotar a sets/promo específicos)
 * Header: Authorization: Bearer CRON_SECRET
 *
 * Vercel Cron (vercel.json): { "path": "/api/cron/scrape-kr", "schedule": "..." }
 */

export const maxDuration = 300;

const authenticate = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET not configured");
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    throw error;
  }
};

async function run(request: NextRequest) {
  authenticate(request);

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const setParam = request.nextUrl.searchParams.get("set");
  const setFilter = setParam
    ? setParam
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    : null;
  const linkByCardSetCode =
    request.nextUrl.searchParams.get("linkByCardSetCode") !== "0";

  console.log(`🤖 Cron: scrape-kr (dryRun=${dryRun}, set=${setParam ?? "all"})…`);
  const startTime = Date.now();

  const summary = await runKrSync({
    dryRun,
    setFilter,
    linkByCardSetCode,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("✅ scrape-kr:", summary);

  return NextResponse.json(
    {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      summary,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    return await run(request);
  } catch (error) {
    const err = error as Error;
    const status = (err as any)?.status ?? 500;
    console.error("❌ scrape-kr cron failed:", err);
    return NextResponse.json(
      { success: false, error: err.message, timestamp: new Date().toISOString() },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  const hasAuth = Boolean(request.headers.get("authorization"));
  if (!hasAuth) {
    return NextResponse.json(
      {
        message: "Korea official sync cron endpoint",
        method: "POST or GET with Authorization header",
        auth: "Required: Authorization: Bearer CRON_SECRET",
        query:
          "&dryRun=1 para solo calcular, &set=OP14,P para acotar a sets/promo específicos",
        status: "active",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
