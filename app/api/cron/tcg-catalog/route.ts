import { NextRequest, NextResponse } from "next/server";
import { syncTcgCatalog } from "@/lib/services/tcgCatalogSync";

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
    const result = await syncTcgCatalog();
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

export async function GET() {
  return NextResponse.json(
    {
      status: "active",
      description:
        "POST with Authorization header to sync the One Piece catalog from TCGplayer",
    },
    { status: 200 }
  );
}
