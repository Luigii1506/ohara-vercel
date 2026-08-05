export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  persistLimitlessMembershipSources,
  reconcileLimitlessSetMembership,
} from "@/lib/services/limitlessSetSync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const setUrlOrSlug = String(body?.setUrlOrSlug ?? "").trim();
    const region = String(body?.region ?? "").trim().toUpperCase() || null;
    const dbSetIdRaw = body?.dbSetId;
    const dbSetId =
      typeof dbSetIdRaw === "number"
        ? dbSetIdRaw
        : Number.parseInt(String(dbSetIdRaw ?? ""), 10);
    const writeSources = body?.writeSources === true;

    if (!setUrlOrSlug) {
      return NextResponse.json(
        { error: "setUrlOrSlug is required" },
        { status: 400 }
      );
    }

    const report = await reconcileLimitlessSetMembership({
      setUrlOrSlug,
      dbSetId: Number.isFinite(dbSetId) ? dbSetId : null,
      region,
    });

    const sourceWriteSummary = writeSources
      ? await persistLimitlessMembershipSources(report)
      : null;

    return NextResponse.json(
      {
        ok: true,
        report,
        sourceWriteSummary,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[limitless/set-membership/reconcile] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to reconcile Limitless set membership" },
      { status: 500 }
    );
  }
}
