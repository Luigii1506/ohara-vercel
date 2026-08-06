import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LiveOverlayCard,
  LiveOverlayRarityCounterKey,
  LiveOverlayRarityCounters,
  LiveOverlayState,
} from "@/lib/live-overlay/types";
import { LIVE_OVERLAY_RARITY_COUNTER_KEYS } from "@/lib/live-overlay/types";

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
  updatedAt: new Date(0).toISOString(),
});

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

export const getLiveOverlayState = async (
  token: string
): Promise<LiveOverlayState> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  if (!row) return createDefaultState();
  return {
    currentCard: (row.currentCard as LiveOverlayCard | null) ?? null,
    rarityCounters: normalizeCounters(row.rarityCounters),
    updatedAt: row.updatedAt.toISOString(),
  };
};

const persist = async (
  token: string,
  next: { currentCard: LiveOverlayCard | null; rarityCounters: LiveOverlayRarityCounters }
): Promise<LiveOverlayState> => {
  const currentCardJson =
    next.currentCard === null
      ? Prisma.JsonNull
      : (next.currentCard as unknown as Prisma.InputJsonValue);
  const rarityJson = next.rarityCounters as unknown as Prisma.InputJsonValue;

  const saved = await prisma.liveOverlayState.upsert({
    where: { token },
    create: { token, currentCard: currentCardJson, rarityCounters: rarityJson },
    update: { currentCard: currentCardJson, rarityCounters: rarityJson },
  });
  return {
    currentCard: (saved.currentCard as LiveOverlayCard | null) ?? null,
    rarityCounters: normalizeCounters(saved.rarityCounters),
    updatedAt: saved.updatedAt.toISOString(),
  };
};

const updateState = async (
  token: string,
  updater: (state: LiveOverlayState) => {
    currentCard: LiveOverlayCard | null;
    rarityCounters: LiveOverlayRarityCounters;
  }
): Promise<LiveOverlayState> => {
  const current = await getLiveOverlayState(token);
  return persist(token, updater(current));
};

export const setLiveOverlayCard = (token: string, card: LiveOverlayCard) =>
  updateState(token, (state) => ({
    currentCard: card,
    rarityCounters: state.rarityCounters,
  }));

export const clearLiveOverlayCard = (token: string) =>
  updateState(token, (state) => ({
    currentCard: null,
    rarityCounters: state.rarityCounters,
  }));

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
  }));

export const resetLiveOverlayRarityCounters = (token: string) =>
  updateState(token, (state) => ({
    currentCard: state.currentCard,
    rarityCounters: createDefaultRarityCounters(),
  }));
