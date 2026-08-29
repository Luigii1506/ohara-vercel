import { NextRequest, NextResponse } from "next/server";
import { retryPendingCardImages } from "@/lib/services/pendingCardImage";

export const maxDuration = 120;

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
    const result = await retryPendingCardImages();
    const duration = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`[retry-pending-images-cron] Finished in ${duration}s`, result);
    return NextResponse.json({ success: true, duration, ...result }, { status: 200 });
  } catch (error) {
    const status = (error as any)?.status ?? 500;
    console.error("[retry-pending-images-cron] Failed", error);
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
          "POST (o GET con Authorization header) para reintentar la subida real de cartas con imagen pendiente (placeholder de dorso)",
      },
      { status: 200 }
    );
  }
  return POST(request);
}
