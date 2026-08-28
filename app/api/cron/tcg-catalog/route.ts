import { NextRequest, NextResponse } from "next/server";
import { syncTcgCatalog } from "@/lib/services/tcgCatalogSync";

// El sync pagina todo el catálogo (~7k productos); necesita margen.
export const maxDuration = 300;

const authenticate = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET not configured");
  }
  const expected = `Bearer ${cronSecret}`;
  if (authHeader !== expected) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }
};

export async function POST(request: NextRequest) {
  try {
    authenticate(request);
    const started = Date.now();
    console.log("[tcg-catalog-cron] Starting sync for category 68");
    // Escribe siempre (el default del servicio es dry-run). El mirror alimenta
    // la reconciliación de catálogo, así que debe refrescarse de verdad.
    const result = await syncTcgCatalog({ dryRun: false });
    const duration = ((Date.now() - started) / 1000).toFixed(2);
    console.log(
      `[tcg-catalog-cron] Finished full sync in ${duration}s`,
      result
    );

    return NextResponse.json(
      { success: true, duration, ...result },
      { status: 200 }
    );
  } catch (error) {
    const status = (error as any)?.status ?? 500;
    console.error("[tcg-catalog-cron] Failed", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  // Vercel Cron invoca por GET con el Authorization header — sin este
  // passthrough (igual que catalog-reconcile y tcgplayer-price-sync) el cron
  // programado nunca llegaba a correr syncTcgCatalog, solo devolvía este
  // placeholder. Por eso el mirror llevaba días sin sincronizarse.
  const hasAuth = Boolean(request.headers.get("authorization"));
  if (!hasAuth) {
    return NextResponse.json(
      {
        status: "active",
        description:
          "POST (o GET con Authorization header) para sincronizar el catálogo de One Piece desde TCGplayer",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
