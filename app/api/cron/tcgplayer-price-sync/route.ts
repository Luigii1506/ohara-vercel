import { NextRequest, NextResponse } from "next/server";
import { syncTcgplayerPrices } from "@/lib/services/tcgplayerPriceSync";

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

async function runPriceSync(request: NextRequest) {
  authenticate(request);
  const watchlistOnly = request.nextUrl.searchParams.get("watchlist") === "true";

  console.log(
    `🔄 Starting TCGplayer price sync (watchlistOnly=${watchlistOnly})`
  );
  const started = Date.now();
  const result = await syncTcgplayerPrices({
    onlyWatchlisted: watchlistOnly,
  });
  const duration = ((Date.now() - started) / 1000).toFixed(2);

  console.log("✅ Price sync completed", { ...result, duration });
  return NextResponse.json(
    {
      success: true,
      duration,
      ...result,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  try {
    return await runPriceSync(request);
  } catch (error) {
    const status = (error as any)?.status ?? 500;
    console.error("❌ Price sync cron failed:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  const hasAuth = Boolean(request.headers.get("authorization"));
  if (!hasAuth) {
    return NextResponse.json(
      {
        status: "active",
        description:
          "Provide Authorization header to trigger the sync. Optional query: watchlist=true",
      },
      { status: 200 }
    );
  }

  return POST(request);
}
