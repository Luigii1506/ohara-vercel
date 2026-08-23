import { NextRequest, NextResponse } from "next/server";
import {
  OFFICIAL_REGIONS,
  scanOfficialRegion,
  applyPendingOfficialItems,
} from "@/lib/services/officialSync";

/**
 * Cron de sincronización con los sitios OFICIALES (Bandai): escanea una
 * región, encola lo faltante en OfficialSyncItem (y actualiza SetSource con
 * el conteo declarado por set) y aplica automáticamente lo que no falle
 * (crea la carta + sube imagen a R2). Si aplicar un item falla (imagen rota,
 * layout raro del sitio, etc.) ese item queda PENDING — visible en
 * /admin/official-sync para revisión manual — en vez de bloquear el batch.
 *
 * Uso:
 *   GET/POST /api/cron/official-sync?region=JP
 *   GET/POST /api/cron/official-sync?region=JP&dryRun=1  (solo escanea, no aplica)
 *   GET/POST /api/cron/official-sync?region=JP&limit=50  (tope de applies por corrida, default 25)
 * Header: Authorization: Bearer CRON_SECRET
 *
 * Vercel Cron (vercel.json): una entrada por región, mismo path con
 * ?region distinto — el código ya es genérico para EN/ASIA-EN/JP/FR.
 */

// El scan pagina todas las series del sitio + el apply descarga/sube
// imágenes a R2 por cada carta nueva; damos margen.
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

  const region = (request.nextUrl.searchParams.get("region") || "").trim().toUpperCase();
  if (!OFFICIAL_REGIONS[region]) {
    const error = new Error(
      `Región inválida o faltante (?region=). Válidas: ${Object.keys(OFFICIAL_REGIONS).join(", ")}`
    );
    (error as any).status = 400;
    throw error;
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam) || 25)) : 25;

  console.log(`🤖 Cron: official-sync region=${region} (dryRun=${dryRun})…`);
  const startTime = Date.now();

  const scan = await scanOfficialRegion(region);
  const apply = dryRun ? null : await applyPendingOfficialItems(region, { limit });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("✅ official-sync:", { region, scan, apply });

  return NextResponse.json(
    {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      scan,
      apply,
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
    console.error("❌ official-sync cron failed:", err);
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
        message: "Official sync cron endpoint",
        method: "POST or GET with Authorization header",
        auth: "Required: Authorization: Bearer CRON_SECRET",
        query:
          "?region=JP|EN|ASIA-EN|FR (requerido), &dryRun=1 para solo escanear, &limit=N tope de applies",
        status: "active",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
