import { NextRequest, NextResponse } from "next/server";
import { runCnSync } from "@/lib/services/cnOfficialSync";

/**
 * Cron de sincronización con el sitio oficial de China continental
 * (onepiece-cardgame.cn, vía la API pública detrás:
 * webadmin.windoent.com/front/op-public). Ver lib/services/cnOfficialSync.ts
 * para el detalle del protocolo.
 *
 * Corre en modo "solo crear lo que falta" (updateExisting=false, el default
 * de runCnSync) — nunca pisa una carta ya cargada. `limit` acota cuántas
 * cartas se procesan por corrida para no exceder maxDuration; el resto lo
 * recoge la siguiente corrida programada.
 *
 * Uso:
 *   GET/POST /api/cron/scrape-cn
 *   GET/POST /api/cron/scrape-cn?dryRun=1        (solo calcula, no escribe)
 *   GET/POST /api/cron/scrape-cn?limit=100       (tope de cartas por corrida, default 150)
 *   GET/POST /api/cron/scrape-cn?offerTypePattern=OP-17  (acotar a una serie)
 * Header: Authorization: Bearer CRON_SECRET
 *
 * Vercel Cron (vercel.json): { "path": "/api/cron/scrape-cn", "schedule": "..." }
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
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam
    ? Math.max(1, Math.min(1000, Number(limitParam) || 150))
    : 150;
  const offerTypePattern =
    request.nextUrl.searchParams.get("offerTypePattern") || undefined;
  const linkByCardSetCode =
    request.nextUrl.searchParams.get("linkByCardSetCode") !== "0";

  console.log(`🤖 Cron: scrape-cn (dryRun=${dryRun}, limit=${limit})…`);
  const startTime = Date.now();

  const summary = await runCnSync({
    dryRun,
    limit,
    offerTypePattern,
    linkByCardSetCode,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("✅ scrape-cn:", summary);

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
    console.error("❌ scrape-cn cron failed:", err);
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
        message: "China (mainland) official sync cron endpoint",
        method: "POST or GET with Authorization header",
        auth: "Required: Authorization: Bearer CRON_SECRET",
        query:
          "&dryRun=1 para solo calcular, &limit=N tope de cartas por corrida (default 150), &offerTypePattern=... para acotar",
        status: "active",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
