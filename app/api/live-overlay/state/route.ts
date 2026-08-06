import { NextRequest, NextResponse } from "next/server";
import { getLiveOverlayState } from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      state: getLiveOverlayState(token!),
    },
    { status: 200 }
  );
}
