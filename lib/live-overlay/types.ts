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
export const LIVE_OVERLAY_RARITY_COUNTER_KEYS = [
  "SR",
  "SEC",
  "TR",
  "AA",
  "KK",
] as const;

export type LiveOverlayRarityCounterKey =
  (typeof LIVE_OVERLAY_RARITY_COUNTER_KEYS)[number];

export type LiveOverlayRarityCounters = Record<
  LiveOverlayRarityCounterKey,
  number
>;

export type LiveOverlayState = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  updatedAt: string;
};
