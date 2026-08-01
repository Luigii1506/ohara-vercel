export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { reconcileCatalog } from "@/lib/services/catalogReconcile";

/**
 * POST /api/admin/catalog-gaps/reconcile
 * Body: { dryRun?: boolean }
 * Dispara la reconciliación de catálogo manualmente desde el admin.
 * Recalcula los huecos contra el master + nuestras cartas por región.
 */
export async function POST(req: NextRequest) {
  try {
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = Boolean(body?.dryRun);
    } catch {
      // sin body → corrida normal
    }
    const startedAt = Date.now();
    const summary = await reconcileCatalog({ dryRun });
    return NextResponse.json({
      summary,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    console.error("[catalog-gaps] reconcile failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Reconcile failed" },
      { status: 500 }
    );
  }
}
