import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  adjustLiveOverlayGoal,
  applyLiveOverlayCombo,
  clearLiveOverlayBracket,
  clearLiveOverlayCard,
  clearLiveOverlayScenes,
  getLiveOverlayState,
  hideLiveOverlayScene,
  incrementLiveOverlayRarityCounter,
  removeLiveOverlayScene,
  resetLiveOverlayRarityCounters,
  addLiveOverlayVideoClip,
  removeLiveOverlayVideoClip,
  setLiveOverlayBracket,
  setLiveOverlayBracketActive,
  setLiveOverlayCard,
  setLiveOverlayRarityCounter,
  setLiveOverlayScene,
  triggerLiveOverlayScene,
  triggerLiveOverlayStamp,
} from "@/lib/live-overlay/store";
import { findLiveOverlayCombo } from "@/lib/live-overlay/combos";
import { createEmptyBracket, inferClipKind } from "@/lib/live-overlay/types";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import { broadcastLiveOverlayState } from "@/lib/live-overlay/broadcast";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  LIVE_OVERLAY_SCENE_TYPES,
  type LiveOverlayCard,
  type LiveOverlayRarityCounterKey,
  type LiveOverlaySceneType,
} from "@/lib/live-overlay/types";

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
      action: "set_rarity_counter";
      token: string;
      rarity: LiveOverlayRarityCounterKey;
      value: number;
    }
  | {
      action: "increment_rarity_counter" | "decrement_rarity_counter";
      token: string;
      rarity: LiveOverlayRarityCounterKey;
      amount?: number;
    }
  | {
      action: "reset_rarity_counters";
      token: string;
    }
  | {
      action: "trigger_scene";
      token: string;
      type: LiveOverlaySceneType;
      props?: Record<string, unknown>;
    }
  | {
      action: "set_banner";
      token: string;
      text: string;
      subtitle?: string;
      accent?: string;
      visible?: boolean;
    }
  | {
      action: "hide_scene" | "remove_scene";
      token: string;
      id: string;
    }
  | {
      action: "clear_scenes";
      token: string;
    }
  | {
      action: "set_mode";
      token: string;
      label: string;
      emoji?: string;
      accent?: string;
      visible?: boolean;
    }
  | {
      action: "set_goal";
      token: string;
      label: string;
      target: number;
      current?: number;
      unit?: string;
      accent?: string;
      visible?: boolean;
    }
  | {
      action: "adjust_goal";
      token: string;
      amount: number;
    }
  | {
      action: "trigger_combo";
      token: string;
      combo: string;
    }
  | {
      action: "trigger_stamp";
      token: string;
      text: string;
      subtitle?: string;
    }
  | {
      action: "set_bracket";
      token: string;
      bracket: {
        title?: string;
        subtitle?: string;
        round1?: string[];
        round2?: string[];
        champion?: string;
      };
    }
  | {
      action: "set_bracket_active";
      token: string;
      active: boolean;
    }
  | {
      action: "clear_bracket";
      token: string;
    }
  | {
      action: "add_video_clip";
      token: string;
      clip: {
        id?: string;
        label?: string;
        emoji?: string;
        url: string;
        kind?: "audio" | "video";
        startSec?: number;
        endSec?: number;
        loop?: boolean;
        muted?: boolean;
        fit?: "cover" | "contain";
      };
    }
  | {
      action: "remove_video_clip";
      token: string;
      id: string;
    };

const sanitizeSceneType = (value: unknown): LiveOverlaySceneType | null => {
  const normalized = String(value ?? "").trim() as LiveOverlaySceneType;
  return LIVE_OVERLAY_SCENE_TYPES.includes(normalized) ? normalized : null;
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

const sanitizeRarityKey = (
  rarity: unknown
): LiveOverlayRarityCounterKey | null => {
  const normalized = String(rarity ?? "")
    .trim()
    .toUpperCase() as LiveOverlayRarityCounterKey;

  return LIVE_OVERLAY_RARITY_COUNTER_KEYS.includes(normalized)
    ? normalized
    : null;
};

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

  return NextResponse.json({ ok: true, state: await getLiveOverlayState(token!) });
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
      nextState = await setLiveOverlayCard(overlayToken, sanitizedCard);
      break;
    }
    case "clear_card": {
      nextState = await clearLiveOverlayCard(overlayToken);
      break;
    }
    case "set_rarity_counter": {
      const rarity = sanitizeRarityKey(body.rarity);
      if (!rarity) {
        return NextResponse.json({ error: "Invalid rarity key" }, { status: 400 });
      }
      nextState = await setLiveOverlayRarityCounter(
        overlayToken,
        rarity,
        sanitizeNumber(body.value, 0)
      );
      break;
    }
    case "increment_rarity_counter": {
      const rarity = sanitizeRarityKey(body.rarity);
      if (!rarity) {
        return NextResponse.json({ error: "Invalid rarity key" }, { status: 400 });
      }
      nextState = await incrementLiveOverlayRarityCounter(
        overlayToken,
        rarity,
        Math.abs(sanitizeNumber(body.amount, 1))
      );
      break;
    }
    case "decrement_rarity_counter": {
      const rarity = sanitizeRarityKey(body.rarity);
      if (!rarity) {
        return NextResponse.json({ error: "Invalid rarity key" }, { status: 400 });
      }
      nextState = await incrementLiveOverlayRarityCounter(
        overlayToken,
        rarity,
        -Math.abs(sanitizeNumber(body.amount, 1))
      );
      break;
    }
    case "reset_rarity_counters": {
      nextState = await resetLiveOverlayRarityCounters(overlayToken);
      break;
    }
    case "trigger_scene": {
      const type = sanitizeSceneType(body.type);
      if (!type) {
        return NextResponse.json({ error: "Invalid scene type" }, { status: 400 });
      }
      const props =
        body.props && typeof body.props === "object" ? body.props : {};
      // Confeti dura ~4.5s; el resto sin ttl por ahora.
      const ttlMs = type === "confetti" ? 4500 : null;
      nextState = await triggerLiveOverlayScene(overlayToken, type, props, {
        ttlMs,
      });
      break;
    }
    case "set_banner": {
      const text = String(body.text ?? "").trim();
      const visible = body.visible !== false;
      if (visible && !text) {
        return NextResponse.json(
          { error: "Banner text is required" },
          { status: 400 }
        );
      }
      nextState = await setLiveOverlayScene(overlayToken, {
        id: "banner",
        type: "banner",
        z: 20,
        visible,
        props: {
          text,
          subtitle: body.subtitle ? String(body.subtitle).trim() : "",
          accent: body.accent ? String(body.accent) : "",
        },
      });
      break;
    }
    case "hide_scene": {
      const id = String(body.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ error: "Scene id required" }, { status: 400 });
      }
      nextState = await hideLiveOverlayScene(overlayToken, id);
      break;
    }
    case "remove_scene": {
      const id = String(body.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ error: "Scene id required" }, { status: 400 });
      }
      nextState = await removeLiveOverlayScene(overlayToken, id);
      break;
    }
    case "clear_scenes": {
      nextState = await clearLiveOverlayScenes(overlayToken);
      break;
    }
    case "set_mode": {
      const label = String(body.label ?? "").trim();
      const visible = body.visible !== false;
      if (visible && !label) {
        return NextResponse.json(
          { error: "Mode label is required" },
          { status: 400 }
        );
      }
      nextState = await setLiveOverlayScene(overlayToken, {
        id: "mode",
        type: "mode",
        z: 15,
        visible,
        props: {
          label,
          emoji: body.emoji ? String(body.emoji) : "",
          accent: body.accent ? String(body.accent) : "",
        },
      });
      break;
    }
    case "set_goal": {
      const label = String(body.label ?? "").trim();
      const target = Math.max(1, sanitizeNumber(body.target, 100));
      const current = Math.max(0, sanitizeNumber(body.current, 0));
      const visible = body.visible !== false;
      nextState = await setLiveOverlayScene(overlayToken, {
        id: "goal",
        type: "goal",
        z: 18,
        visible,
        props: {
          label,
          target,
          current,
          unit: body.unit ? String(body.unit) : "",
          accent: body.accent ? String(body.accent) : "",
        },
      });
      break;
    }
    case "adjust_goal": {
      nextState = await adjustLiveOverlayGoal(
        overlayToken,
        sanitizeNumber(body.amount, 0)
      );
      break;
    }
    case "trigger_combo": {
      const comboId = String(body.combo ?? "").trim();
      if (!findLiveOverlayCombo(comboId)) {
        return NextResponse.json({ error: "Invalid combo" }, { status: 400 });
      }
      nextState = await applyLiveOverlayCombo(overlayToken, comboId);
      break;
    }
    case "trigger_stamp": {
      const text = String(body.text ?? "").trim();
      if (!text) {
        return NextResponse.json(
          { error: "Stamp text is required" },
          { status: 400 }
        );
      }
      nextState = await triggerLiveOverlayStamp(
        overlayToken,
        text,
        body.subtitle ? String(body.subtitle).trim() : ""
      );
      break;
    }
    case "set_bracket": {
      const b = body.bracket ?? {};
      const base = createEmptyBracket();
      const slots = (arr: unknown, n: number) =>
        Array.from({ length: n }, (_, i) =>
          Array.isArray(arr) ? String(arr[i] ?? "").trim() : ""
        );
      nextState = await setLiveOverlayBracket(overlayToken, {
        title: (b.title ? String(b.title) : base.title).trim() || base.title,
        subtitle:
          b.subtitle !== undefined ? String(b.subtitle).trim() : base.subtitle,
        round1: slots(b.round1, 4) as [string, string, string, string],
        round2: slots(b.round2, 2) as [string, string],
        champion: b.champion ? String(b.champion).trim() : "",
      });
      break;
    }
    case "set_bracket_active": {
      nextState = await setLiveOverlayBracketActive(
        overlayToken,
        body.active === true
      );
      break;
    }
    case "clear_bracket": {
      nextState = await clearLiveOverlayBracket(overlayToken);
      break;
    }
    case "add_video_clip": {
      const c = body.clip;
      const url = String(c?.url ?? "").trim();
      if (!url) {
        return NextResponse.json(
          { error: "La URL del video es requerida" },
          { status: 400 }
        );
      }
      const id =
        c.id && String(c.id).trim()
          ? String(c.id).trim()
          : `clip_${Date.now()}`;
      const startSec = Number(c.startSec);
      const endSec = Number(c.endSec);
      const kind =
        c.kind === "audio" || c.kind === "video"
          ? c.kind
          : inferClipKind(url);
      nextState = await addLiveOverlayVideoClip(overlayToken, {
        id,
        label: c.label ? String(c.label).trim() : "Clip",
        emoji: c.emoji ? String(c.emoji) : kind === "audio" ? "🔊" : "🎬",
        url,
        kind,
        startSec: Number.isFinite(startSec) ? Math.max(0, startSec) : undefined,
        endSec: Number.isFinite(endSec) ? Math.max(0, endSec) : undefined,
        loop: c.loop === true,
        muted: c.muted === true,
        fit: c.fit === "contain" ? "contain" : "cover",
      });
      break;
    }
    case "remove_video_clip": {
      const id = String(body.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ error: "id requerido" }, { status: 400 });
      }
      nextState = await removeLiveOverlayVideoClip(overlayToken, id);
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  // Empuja el estado nuevo por WebSocket (si el worker está configurado).
  // Fire-and-forget: no bloquea ni falla el comando si el broadcast falla.
  await broadcastLiveOverlayState(overlayToken, nextState);

  return NextResponse.json({ ok: true, state: nextState }, { status: 200 });
}
