export type LiveOverlayCard = {
  id: string;
  name: string;
  code: string;
  imageUrl: string | null;
  rarity?: string | null;
  setTitle?: string | null;
  alternateArt?: string | null;
  price?: number | null;
  priceCurrency?: string | null;
  region?: string | null;
};

// Contadores del overlay de stream (los únicos que se suman en el sistema).
export const LIVE_OVERLAY_RARITY_COUNTER_KEYS = ["AA", "SR", "💩"] as const;

export type LiveOverlayRarityCounterKey =
  (typeof LIVE_OVERLAY_RARITY_COUNTER_KEYS)[number];

export type LiveOverlayRarityCounters = Record<
  LiveOverlayRarityCounterKey,
  number
>;

// ===========================================================================
// Motor de escenas (capas apilables del overlay)
// ---------------------------------------------------------------------------
// El overlay ya no es solo "carta + contadores": renderiza un STACK de capas
// (escenas) que se combinan (ej. confeti encima de la carta). Cada escena es
// un módulo con tipo y props. Hay dos familias:
//   - persistentes (banner): quedan hasta que se ocultan/quitan → usan `visible`.
//   - one-shot (confetti, sound): se disparan una vez → usan `triggeredAt`. El
//     overlay las reproduce una sola vez por cada valor nuevo de triggeredAt
//     (dedupe por `${id}:${triggeredAt}`), así el polling no las repite.
// ===========================================================================

export const LIVE_OVERLAY_SCENE_TYPES = [
  "confetti",
  "banner",
  "sound",
] as const;

export type LiveOverlaySceneType = (typeof LIVE_OVERLAY_SCENE_TYPES)[number];

export type LiveOverlayScene = {
  id: string;
  type: LiveOverlaySceneType;
  z: number;
  visible: boolean;
  props: Record<string, unknown>;
  triggeredAt?: string | null;
  ttlMs?: number | null;
};

export type LiveOverlayState = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  scenes: LiveOverlayScene[];
  updatedAt: string;
};
