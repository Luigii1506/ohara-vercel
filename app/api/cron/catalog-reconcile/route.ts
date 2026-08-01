import { NextRequest, NextResponse } from "next/server";
import { reconcileCatalog } from "@/lib/services/catalogReconcile";

/**
 * Cron de reconciliación de catálogo (Capa 1 de cobertura total).
 *
 * Compara el catálogo maestro + nuestras cartas por región y registra los
 * huecos en `CatalogGap` (MISSING_ALL / REGION_PARITY). Responde de forma
 * automática la pregunta "¿qué me falta?".
 *
 * Uso:
 *   GET/POST /api/cron/catalog-reconcile          (escribe)
 *   GET/POST /api/cron/catalog-reconcile?dryRun=1 (solo calcula, no escribe)
 * Header:  Authorization: Bearer CRON_SECRET
 *
 * Vercel Cron (vercel.json): { "path": "/api/cron/catalog-reconcile", "schedule": "0 3 * * 1" }
 */

// Puede tardar por el fetch del master + upserts; damos margen.
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
  console.log(`🤖 Cron: catalog-reconcile (dryRun=${dryRun})…`);
  const startTime = Date.now();

  const summary = await reconcileCatalog({ dryRun });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("✅ catalog-reconcile:", {
    missingAll: summary.missingAll,
    regionParity: summary.regionParity,
    created: summary.created,
    updated: summary.updated,
    resolved: summary.resolved,
  });

  return NextResponse.json(
    { success: true, timestamp: new Date().toISOString(), duration: `${duration}s`, summary },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    return await run(request);
  } catch (error) {
    const err = error as Error;
    const status = (err as any)?.status ?? 500;
    console.error("❌ catalog-reconcile failed:", err);
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
        message: "Catalog reconcile cron endpoint",
        method: "POST or GET with Authorization header",
        auth: "Required: Authorization: Bearer CRON_SECRET",
        query: "?dryRun=1 para calcular sin escribir",
        status: "active",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
