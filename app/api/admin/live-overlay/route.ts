import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  clearLiveOverlayCard,
  getLiveOverlayState,
  incrementLiveOverlayCounter,
  setLiveOverlayCard,
  setLiveOverlayCounter,
} from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import type { LiveOverlayCard } from "@/lib/live-overlay/types";

export const dynamic = "force-dynamic";

type OverlayAction =
  | {
      action: "show_card";
      token: string;
      card: LiveOverlayCard;
    }
  | {
      action: "clear_card";
      token: string;
    }
  | {
      action: "set_counter";
      token: string;
      value: number;
    }
  | {
      action: "increment_counter" | "decrement_counter";
      token: string;
      amount?: number;
    };

const sanitizeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
};

const sanitizeCard = (card: LiveOverlayCard): LiveOverlayCard => ({
  id: String(card.id ?? ""),
  name: String(card.name ?? "").trim(),
  code: String(card.code ?? "").trim(),
  imageUrl: card.imageUrl ? String(card.imageUrl) : null,
  rarity: card.rarity ? String(card.rarity) : null,
  setTitle: card.setTitle ? String(card.setTitle) : null,
  alternateArt: card.alternateArt ? String(card.alternateArt) : null,
  price:
    card.price === null || card.price === undefined || Number.isNaN(Number(card.price))
      ? null
      : Number(card.price),
  priceCurrency: card.priceCurrency ? String(card.priceCurrency) : null,
  region: card.region ? String(card.region) : null,
});

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!sessionToken?.email || sessionToken.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, state: getLiveOverlayState(token!) });
}

export async function POST(request: NextRequest) {
  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!sessionToken?.email || sessionToken.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as OverlayAction;
  const token = body?.token;

  if (!isLiveOverlayTokenValid(token)) {
    return NextResponse.json({ error: "Invalid overlay token" }, { status: 400 });
  }

  const overlayToken = token!;

  let nextState;

  switch (body.action) {
    case "show_card": {
      const sanitizedCard = sanitizeCard(body.card);
      if (!sanitizedCard.id || !sanitizedCard.name || !sanitizedCard.code) {
        return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
      }
      nextState = setLiveOverlayCard(overlayToken, sanitizedCard);
      break;
    }
    case "clear_card": {
      nextState = clearLiveOverlayCard(overlayToken);
      break;
    }
    case "set_counter": {
      nextState = setLiveOverlayCounter(overlayToken, sanitizeNumber(body.value, 0));
      break;
    }
    case "increment_counter": {
      nextState = incrementLiveOverlayCounter(
        overlayToken,
        Math.abs(sanitizeNumber(body.amount, 1))
      );
      break;
    }
    case "decrement_counter": {
      nextState = incrementLiveOverlayCounter(
        overlayToken,
        -Math.abs(sanitizeNumber(body.amount, 1))
      );
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, state: nextState }, { status: 200 });
}
