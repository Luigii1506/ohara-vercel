import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LiveOverlayBracket,
  LiveOverlayCard,
  LiveOverlayRarityCounterKey,
  LiveOverlayRarityCounters,
  LiveOverlayScene,
  LiveOverlaySceneType,
  LiveOverlayState,
} from "@/lib/live-overlay/types";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  LIVE_OVERLAY_SCENE_TYPES,
} from "@/lib/live-overlay/types";
import { findLiveOverlayCombo } from "@/lib/live-overlay/combos";

/**
 * Estado del overlay persistido en Postgres (tabla LiveOverlayState). Antes era
 * un Map en memoria, que en Vercel serverless NO se comparte entre instancias:
 * el panel (POST) y el overlay (GET) podían caer en lambdas distintas y no ver
 * el mismo estado. En DB funciona confiable entre instancias.
 */

const createDefaultRarityCounters = (): LiveOverlayRarityCounters =>
  LIVE_OVERLAY_RARITY_COUNTER_KEYS.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {} as LiveOverlayRarityCounters);

const createDefaultState = (): LiveOverlayState => ({
  currentCard: null,
  rarityCounters: createDefaultRarityCounters(),
  scenes: [],
  bracket: null,
  updatedAt: new Date(0).toISOString(),
});

/** Normaliza el bracket persistido (o null). */
const normalizeBracket = (raw: unknown): LiveOverlayBracket | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown, n: number) =>
    Array.isArray(v)
      ? Array.from({ length: n }, (_, i) => str(v[i]))
      : Array.from({ length: n }, () => "");
  return {
    title: str(r.title) || "BRACKET",
    subtitle: str(r.subtitle),
    round1: arr(r.round1, 4) as [string, string, string, string],
    round2: arr(r.round2, 2) as [string, string],
    champion: str(r.champion),
  };
};

/** Normaliza los contadores: rellena las rarezas faltantes con 0. */
const normalizeCounters = (raw: unknown): LiveOverlayRarityCounters => {
  const base = createDefaultRarityCounters();
  if (raw && typeof raw === "object") {
    for (const key of LIVE_OVERLAY_RARITY_COUNTER_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) base[key] = Math.max(0, Math.trunc(v));
    }
  }
  return base;
};

/** Normaliza el stack de escenas: descarta lo inválido y ordena por z. */
const normalizeScenes = (raw: unknown): LiveOverlayScene[] => {
  if (!Array.isArray(raw)) return [];
  const scenes: LiveOverlayScene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const type = record.type as LiveOverlaySceneType;
    if (!LIVE_OVERLAY_SCENE_TYPES.includes(type)) continue;
    const id = String(record.id ?? type);
    scenes.push({
      id,
      type,
      z: typeof record.z === "number" ? record.z : 0,
      visible: record.visible !== false,
      props:
        record.props && typeof record.props === "object"
          ? (record.props as Record<string, unknown>)
          : {},
      triggeredAt:
        typeof record.triggeredAt === "string" ? record.triggeredAt : null,
      ttlMs: typeof record.ttlMs === "number" ? record.ttlMs : null,
    });
  }
  return scenes.sort((a, b) => a.z - b.z);
};

export const getLiveOverlayState = async (
  token: string
): Promise<LiveOverlayState> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  if (!row) return createDefaultState();
  return {
    currentCard: (row.currentCard as LiveOverlayCard | null) ?? null,
    rarityCounters: normalizeCounters(row.rarityCounters),
    scenes: normalizeScenes((row as { scenes?: unknown }).scenes),
    bracket: normalizeBracket((row as { bracket?: unknown }).bracket),
    updatedAt: row.updatedAt.toISOString(),
  };
};

type PersistPayload = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  scenes: LiveOverlayScene[];
  bracket: LiveOverlayBracket | null;
};

const persist = async (
  token: string,
  next: PersistPayload
): Promise<LiveOverlayState> => {
  const currentCardJson =
    next.currentCard === null
      ? Prisma.JsonNull
      : (next.currentCard as unknown as Prisma.InputJsonValue);
  const rarityJson = next.rarityCounters as unknown as Prisma.InputJsonValue;
  const scenesJson = next.scenes as unknown as Prisma.InputJsonValue;
  const bracketJson =
    next.bracket === null
      ? Prisma.JsonNull
      : (next.bracket as unknown as Prisma.InputJsonValue);

  const saved = await prisma.liveOverlayState.upsert({
    where: { token },
    create: {
      token,
      currentCard: currentCardJson,
      rarityCounters: rarityJson,
      scenes: scenesJson,
      bracket: bracketJson,
    },
    update: {
      currentCard: currentCardJson,
      rarityCounters: rarityJson,
      scenes: scenesJson,
      bracket: bracketJson,
    },
  });
  return {
    currentCard: (saved.currentCard as LiveOverlayCard | null) ?? null,
    rarityCounters: normalizeCounters(saved.rarityCounters),
    scenes: normalizeScenes((saved as { scenes?: unknown }).scenes),
    bracket: normalizeBracket((saved as { bracket?: unknown }).bracket),
    updatedAt: saved.updatedAt.toISOString(),
  };
};

// El updater devuelve un PARCIAL; lo mezclamos con el estado actual, así los
// updaters existentes (que no tocan bracket) lo preservan automáticamente.
const updateState = async (
  token: string,
  updater: (state: LiveOverlayState) => Partial<PersistPayload>
): Promise<LiveOverlayState> => {
  const current = await getLiveOverlayState(token);
  const patch = updater(current);
  return persist(token, {
    currentCard:
      patch.currentCard !== undefined ? patch.currentCard : current.currentCard,
    rarityCounters: patch.rarityCounters ?? current.rarityCounters,
    scenes: patch.scenes ?? current.scenes,
    bracket: patch.bracket !== undefined ? patch.bracket : current.bracket,
  });
};

// ---------------------------------------------------------------------------
// Carta en vivo
// ---------------------------------------------------------------------------

export const setLiveOverlayCard = (token: string, card: LiveOverlayCard) =>
  updateState(token, (state) => ({
    currentCard: card,
    rarityCounters: state.rarityCounters,
    scenes: state.scenes,
  }));

export const clearLiveOverlayCard = (token: string) =>
  updateState(token, (state) => ({
    currentCard: null,
    rarityCounters: state.rarityCounters,
    scenes: state.scenes,
  }));

// ---------------------------------------------------------------------------
// Contadores por rareza
// ---------------------------------------------------------------------------

export const setLiveOverlayRarityCounter = (
  token: string,
  rarity: LiveOverlayRarityCounterKey,
  value: number
) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: {
      ...state.rarityCounters,
      [rarity]: Math.max(0, Math.trunc(value)),
    },
    scenes: state.scenes,
  }));

export const incrementLiveOverlayRarityCounter = (
  token: string,
  rarity: LiveOverlayRarityCounterKey,
  amount: number
) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: {
      ...state.rarityCounters,
      [rarity]: Math.max(0, state.rarityCounters[rarity] + Math.trunc(amount)),
    },
    scenes: state.scenes,
  }));

export const resetLiveOverlayRarityCounters = (token: string) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: createDefaultRarityCounters(),
    scenes: state.scenes,
  }));

// ---------------------------------------------------------------------------
// Escenas (stack de capas)
// ---------------------------------------------------------------------------

/** Upsert de una escena en el stack por id (los singletons usan id = type). */
const upsertScene = (
  scenes: LiveOverlayScene[],
  scene: LiveOverlayScene
): LiveOverlayScene[] => {
  const rest = scenes.filter((s) => s.id !== scene.id);
  return [...rest, scene].sort((a, b) => a.z - b.z);
};

/**
 * Dispara una escena one-shot (confetti / sound): marca triggeredAt = ahora, así
 * el overlay la reproduce una sola vez por cada disparo. El id es el type
 * (singleton), de modo que dispararla de nuevo solo actualiza triggeredAt.
 */
export const triggerLiveOverlayScene = (
  token: string,
  type: LiveOverlaySceneType,
  props: Record<string, unknown> = {},
  options: { z?: number; ttlMs?: number | null } = {}
) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: upsertScene(state.scenes, {
      id: type,
      type,
      z: options.z ?? 50,
      visible: true,
      props,
      triggeredAt: new Date().toISOString(),
      ttlMs: options.ttlMs ?? null,
    }),
  }));

/** Crea/actualiza una escena persistente (banner). */
export const setLiveOverlayScene = (
  token: string,
  scene: {
    id: string;
    type: LiveOverlaySceneType;
    z?: number;
    visible?: boolean;
    props?: Record<string, unknown>;
  }
) =>
  updateState(token, (state) => {
    const existing = state.scenes.find((s) => s.id === scene.id);
    return {
      currentCard: state.currentCard,
      rarityCounters: state.rarityCounters,
      scenes: upsertScene(state.scenes, {
        id: scene.id,
        type: scene.type,
        z: scene.z ?? existing?.z ?? 10,
        visible: scene.visible ?? true,
        props: scene.props ?? existing?.props ?? {},
        triggeredAt: existing?.triggeredAt ?? null,
        ttlMs: existing?.ttlMs ?? null,
      }),
    };
  });

/** Oculta una escena persistente sin quitarla del stack. */
export const hideLiveOverlayScene = (token: string, id: string) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: state.scenes.map((s) =>
      s.id === id ? { ...s, visible: false } : s
    ),
  }));

/** Quita una escena del stack. */
export const removeLiveOverlayScene = (token: string, id: string) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: state.scenes.filter((s) => s.id !== id),
  }));

/** Limpia todo el stack de escenas. */
export const clearLiveOverlayScenes = (token: string) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: [],
  }));

/** Dispara el sello one-shot (ej. "¡VENDIDO!"). */
export const triggerLiveOverlayStamp = (
  token: string,
  text: string,
  subtitle = "",
  ttlMs = 2800
) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: upsertScene(state.scenes, {
      id: "stamp",
      type: "stamp",
      z: 55,
      visible: true,
      props: { text, subtitle },
      triggeredAt: new Date().toISOString(),
      ttlMs,
    }),
  }));

/**
 * Aplica un combo (confeti + sonido + sello) de forma ATÓMICA: un solo
 * updateState → un solo broadcast, así llega todo junto y sincronizado.
 */
export const LIVE_OVERLAY_COMBO_TTL_MS = 3000;

/**
 * Aplica un combo como UNA sola escena `combo` (confeti + sonido + sello en un
 * solo bloque, vida de 3s). "1 combo a la vez": reemplaza cualquier combo previo
 * y limpia one-shots sueltos, así NUNCA se apilan.
 */
export const applyLiveOverlayCombo = (token: string, comboId: string) =>
  updateState(token, (state) => {
    const combo = findLiveOverlayCombo(comboId);
    if (!combo) {
      return {
        currentCard: state.currentCard,
        rarityCounters: state.rarityCounters,
        scenes: state.scenes,
      };
    }
    const now = new Date().toISOString();
    const scenes = upsertScene(
      state.scenes.filter(
        (s) =>
          s.id !== "combo" &&
          s.id !== "confetti" &&
          s.id !== "sound" &&
          s.id !== "stamp"
      ),
      {
        id: "combo",
        type: "combo",
        z: 55,
        visible: true,
        props: {
          comboId: combo.id,
          confetti: !!combo.confetti,
          sfx: combo.sfx ?? "",
          stampText: combo.stamp?.text ?? "",
          stampSubtitle: combo.stamp?.subtitle ?? "",
        },
        triggeredAt: now,
        ttlMs: LIVE_OVERLAY_COMBO_TTL_MS,
      }
    );
    return {
      currentCard: state.currentCard,
      rarityCounters: state.rarityCounters,
      scenes,
    };
  });

/** Guarda/actualiza el bracket de torneo. */
export const setLiveOverlayBracket = (
  token: string,
  bracket: LiveOverlayBracket
) => updateState(token, () => ({ bracket }));

/** Quita el bracket. */
export const clearLiveOverlayBracket = (token: string) =>
  updateState(token, () => ({ bracket: null }));

/** Suma/resta al valor actual de la barra de meta (clamp ≥ 0). */
export const adjustLiveOverlayGoal = (token: string, amount: number) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: state.rarityCounters,
    scenes: state.scenes.map((s) => {
      if (s.id !== "goal") return s;
      const current = Math.max(
        0,
        Math.trunc(Number(s.props.current ?? 0) + amount)
      );
      return { ...s, props: { ...s.props, current } };
    }),
  }));
