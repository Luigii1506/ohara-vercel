export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncLimitlessCatalogReviews } from "@/lib/services/limitlessSetSync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const category =
      body?.category === "main" || body?.category === "promo" || body?.category === "all"
        ? body.category
        : "all";
    const region = String(body?.region ?? "US").trim().toUpperCase() || "US";
    const limitRaw = Number.parseInt(String(body?.limit ?? ""), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : null;
    const slugs = Array.isArray(body?.slugs)
      ? body.slugs.map((value: unknown) => String(value).trim()).filter(Boolean)
      : null;
    const newOnly = body?.newOnly === true;
    const forceAll = body?.forceAll === true;
    const staleHoursRaw = Number.parseInt(String(body?.staleHours ?? ""), 10);
    const staleHours = Number.isFinite(staleHoursRaw) ? staleHoursRaw : null;

    const result = await syncLimitlessCatalogReviews({
      category,
      region,
      limit,
      slugs,
      newOnly,
      staleHours,
      forceAll,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/set-membership/batch-sync] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to batch sync Limitless catalog" },
      { status: 500 }
    );
  }
}
