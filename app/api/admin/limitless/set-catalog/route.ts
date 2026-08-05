export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getLimitlessCatalogFeed } from "@/lib/services/limitlessSetSync";

export async function GET() {
  try {
    const { entries, stats } = await getLimitlessCatalogFeed({
      region: "US",
      staleHours: 24,
    });
    return NextResponse.json({ ok: true, entries, stats }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/set-catalog] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load Limitless set catalog" },
      { status: 500 }
    );
  }
}
