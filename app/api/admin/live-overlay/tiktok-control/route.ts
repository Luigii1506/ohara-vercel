import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import {
  connectTikTok,
  disconnectTikTok,
  getTikTokStatus,
} from "@/lib/live-overlay/tiktokControl";
import { resetLiveOverlayLeaderboards } from "@/lib/live-overlay/store";
import { broadcastLiveOverlayState } from "@/lib/live-overlay/broadcast";

export const dynamic = "force-dynamic";

const requireAdmin = async (request: NextRequest) => {
  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  return !!sessionToken?.email && sessionToken.role === "ADMIN";
};

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 400 });
  }

  try {
    const status = await getTikTokStatus(token!);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { ok: false, connected: false, username: null, error: String(error) },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    token?: string;
    action?: "connect" | "disconnect";
    username?: string;
  };
  const token = body?.token;
  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 400 });
  }

  try {
    if (body.action === "connect") {
      const username = String(body.username || "").trim().replace(/^@/, "");
      if (!username) {
        return NextResponse.json({ error: "username required" }, { status: 400 });
      }
      // Ranking "por stream": arranca en 0 cada vez que te conectás a un live.
      const nextState = await resetLiveOverlayLeaderboards(token!);
      await broadcastLiveOverlayState(token!, nextState);
      const result = await connectTikTok(token!, username);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "disconnect") {
      const result = await disconnectTikTok(token!);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
