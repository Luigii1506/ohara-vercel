import { NextRequest, NextResponse } from "next/server";
import {
  appendLiveOverlayChatItem,
  bumpLiveOverlayTopGifters,
  bumpLiveOverlayTopLikers,
  setLiveOverlayLikeCount,
  setLiveOverlayViewerCount,
  triggerLiveOverlayAlert,
} from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import { broadcastLiveOverlayState } from "@/lib/live-overlay/broadcast";

export const dynamic = "force-dynamic";

/**
 * Recibe eventos normalizados de TikTok LIVE (chat, gift, follow, share,
 * like, viewerCount) desde el Cloudflare Worker (ohara-live-worker), que
 * mantiene la conexión al WebSocket de Eulerstream. Autenticado con un
 * secreto propio (server-to-server, no es una sesión de admin). Reusa las
 * mismas funciones de lib/live-overlay/store que usa Live Desk, así Postgres
 * sigue siendo la única fuente de verdad y el broadcast llega por el mismo
 * camino de siempre.
 */

type TikTokEventBody =
  | { token: string; type: "chat"; user: string; userAvatar?: string; text: string }
  | {
      token: string;
      type: "gift";
      user: string;
      userAvatar?: string;
      giftName?: string;
      giftId?: string;
      diamondCount?: number;
      repeatCount?: number;
    }
  | { token: string; type: "follow"; user: string; userAvatar?: string }
  | { token: string; type: "share"; user: string; userAvatar?: string }
  | {
      token: string;
      type: "like";
      total: number;
      user?: string;
      userAvatar?: string;
      count?: number;
    }
  | { token: string; type: "viewerCount"; count: number };

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
      const avatar = String(body.userAvatar ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!text) {
        // TikTok a veces manda un WebcastChatMessage con comment vacío (ej.
        // un comentario moderado/removido) — no es un error del worker, así
        // que no se reintenta ni se cuenta como fallo: antes devolvía 400,
        // y como el texto nunca deja de estar vacío, los 3 reintentos del
        // worker fallaban igual y quedaba loggeado como evento abandonado.
        return NextResponse.json({ ok: true, skipped: "empty text" });
      }
      nextState = await appendLiveOverlayChatItem(overlayToken, { user, avatar, text });
      break;
    }
    case "gift": {
      const user = String(body.user ?? "").trim();
      const avatar = String(body.userAvatar ?? "").trim();
      const giftName = body.giftName ? String(body.giftName).trim() : "";
      const diamondCount =
        typeof body.diamondCount === "number" && body.diamondCount > 0
          ? body.diamondCount
          : 0;
      const repeatCount =
        typeof body.repeatCount === "number" && body.repeatCount > 1
          ? body.repeatCount
          : undefined;
      // Rankeamos por DIAMANTES gastados (repeatCount * valor del regalo) —
      // si no tenemos el valor (regalo fuera del catálogo cacheado), caemos
      // a contar por cantidad de regalos como respaldo.
      const gifterAmount = diamondCount > 0 ? diamondCount * (repeatCount ?? 1) : repeatCount ?? 1;
      if (user) {
        await bumpLiveOverlayTopGifters(overlayToken, user, gifterAmount, avatar);
      }
      nextState = await triggerLiveOverlayAlert(overlayToken, {
        emoji: "🎁",
        text: `${user || "Alguien"} regaló ${giftName || "un regalo"}`,
        subtitle: [
          repeatCount ? `x${repeatCount}` : "",
          diamondCount ? `💎${diamondCount * (repeatCount ?? 1)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        avatar,
      });
      break;
    }
    case "follow": {
      const user = String(body.user ?? "").trim();
      const avatar = String(body.userAvatar ?? "").trim();
      nextState = await triggerLiveOverlayAlert(overlayToken, {
        emoji: "➕",
        text: `${user || "Alguien"} te siguió`,
        avatar,
      });
      break;
    }
    case "share": {
      const user = String(body.user ?? "").trim();
      const avatar = String(body.userAvatar ?? "").trim();
      nextState = await triggerLiveOverlayAlert(overlayToken, {
        emoji: "🔗",
        text: `${user || "Alguien"} compartió el live`,
        avatar,
      });
      break;
    }
    case "like": {
      const total = Number(body.total);
      if (!Number.isFinite(total)) {
        return NextResponse.json({ error: "total required" }, { status: 400 });
      }
      const user = String(body.user ?? "").trim();
      const avatar = String(body.userAvatar ?? "").trim();
      const count = Number(body.count);
      if (user && Number.isFinite(count) && count > 0) {
        await bumpLiveOverlayTopLikers(overlayToken, user, count, avatar);
      }
      nextState = await setLiveOverlayLikeCount(overlayToken, total);
      break;
    }
    case "viewerCount": {
      const count = Number(body.count);
      if (!Number.isFinite(count)) {
        return NextResponse.json({ error: "count required" }, { status: 400 });
      }
      nextState = await setLiveOverlayViewerCount(overlayToken, count);
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  }

  // Fire-and-forget, igual que en el route de admin: no bloquea la respuesta.
  await broadcastLiveOverlayState(overlayToken, nextState);

  return NextResponse.json({ ok: true }, { status: 200 });
}
