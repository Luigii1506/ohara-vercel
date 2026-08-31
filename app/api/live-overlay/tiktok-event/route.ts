import { NextRequest, NextResponse } from "next/server";
import {
  appendLiveOverlayChatItem,
  setLiveOverlayLikeCount,
  triggerLiveOverlayAlert,
} from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import { broadcastLiveOverlayState } from "@/lib/live-overlay/broadcast";

export const dynamic = "force-dynamic";

/**
 * Recibe eventos normalizados de TikTok LIVE (chat, gift, follow, like) desde
 * el Cloudflare Worker (ohara-live-worker), que mantiene la conexión al
 * WebSocket de Eulerstream. Autenticado con un secreto propio (server-to-
 * server, no es una sesión de admin). Reusa las mismas funciones de
 * lib/live-overlay/store que usa Live Desk, así Postgres sigue siendo la
 * única fuente de verdad y el broadcast llega por el mismo camino de siempre.
 */

type TikTokEventBody =
  | { token: string; type: "chat"; user: string; text: string }
  | {
      token: string;
      type: "gift";
      user: string;
      giftName?: string;
      giftId?: string;
      repeatCount?: number;
    }
  | { token: string; type: "follow"; user: string }
  | { token: string; type: "like"; total: number };

export async function POST(request: NextRequest) {
  const secret = process.env.TIKTOK_EVENT_SECRET;
  const auth = request.headers.get("Authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as TikTokEventBody;
  const token = body?.token;

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 400 });
  }

  const overlayToken = token;
  let nextState;

  switch (body.type) {
    case "chat": {
      const user = String(body.user ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "text required" }, { status: 400 });
      }
      nextState = await appendLiveOverlayChatItem(overlayToken, { user, text });
      break;
    }
    case "gift": {
      const user = String(body.user ?? "").trim();
      const giftName = body.giftName ? String(body.giftName).trim() : "";
      const repeatCount =
        typeof body.repeatCount === "number" && body.repeatCount > 1
          ? body.repeatCount
          : undefined;
      nextState = await triggerLiveOverlayAlert(overlayToken, {
        emoji: "🎁",
        text: `${user || "Alguien"} regaló ${giftName || "un regalo"}`,
        subtitle: repeatCount ? `x${repeatCount}` : "",
      });
      break;
    }
    case "follow": {
      const user = String(body.user ?? "").trim();
      nextState = await triggerLiveOverlayAlert(overlayToken, {
        emoji: "➕",
        text: `${user || "Alguien"} te siguió`,
      });
      break;
    }
    case "like": {
      const total = Number(body.total);
      if (!Number.isFinite(total)) {
        return NextResponse.json({ error: "total required" }, { status: 400 });
      }
      nextState = await setLiveOverlayLikeCount(overlayToken, total);
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  }

  // Fire-and-forget, igual que en el route de admin: no bloquea la respuesta.
  await broadcastLiveOverlayState(overlayToken, nextState);

  return NextResponse.json({ ok: true }, { status: 200 });
}
