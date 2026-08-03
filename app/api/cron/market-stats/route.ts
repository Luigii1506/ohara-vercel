export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { computeCardPriceStats } from "@/lib/services/market/cardPriceStats";

/** Recomputa CardPriceStat (movers/joyas/dip) desde el historial de precios. */
const authenticate = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET not configured");
  if (authHeader !== `Bearer ${cronSecret}`) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }
};

async function run(request: NextRequest) {
  authenticate(request);
  const started = Date.now();
  const result = await computeCardPriceStats();
  const duration = ((Date.now() - started) / 1000).toFixed(2);
  console.log("✅ Market stats computed", { ...result, duration });
  return NextResponse.json({ success: true, duration, ...result });
}

export async function POST(request: NextRequest) {
  try {
    return await run(request);
  } catch (error) {
    const status = (error as any)?.status ?? 500;
    console.error("❌ market-stats cron failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!request.headers.get("authorization")) {
    return NextResponse.json({ status: "active", description: "market stats cron" });
  }
  return POST(request);
}
