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
  "mode",
  "goal",
  "stamp",
  "combo",
  "video",
  "fx",
  "shine",
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

// ===========================================================================
// Bracket de torneo (vista full-screen aparte del overlay chroma)
// 4 jugadores: Ronda 1 (4 slots) → Ronda 2 (2 slots) → Campeón (1).
// ===========================================================================
export type LiveOverlayBracket = {
  active: boolean; // visible como escena a pantalla completa en el overlay
  title: string; // "BRACKET"
  subtitle: string; // "RUMBO A LA GLORIA"
  round1: [string, string, string, string];
  round2: [string, string];
  champion: string;
};

/** Campos editables del bracket (sin la bandera de visibilidad). */
export type LiveOverlayBracketData = Omit<LiveOverlayBracket, "active">;

export const createEmptyBracket = (): LiveOverlayBracket => ({
  active: false,
  title: "BRACKET",
  subtitle: "RUMBO A LA GLORIA",
  round1: ["", "", "", ""],
  round2: ["", ""],
  champion: "",
});

// ===========================================================================
// Biblioteca de clips de video (se gestiona desde el Live Desk, se guarda en DB)
// ===========================================================================
export type LiveOverlayVideoClip = {
  id: string;
  label: string;
  emoji: string;
  url: string; // media hospedada en R2 (mp4/webm o mp3/m4a/ogg/wav)
  kind?: "audio" | "video";
  startSec?: number; // recorte de reproducción
  endSec?: number;
  loop?: boolean;
  muted?: boolean;
  fit?: "cover" | "contain";
};

/** Infiere si una URL es audio por su extensión. */
export const inferClipKind = (url: string): "audio" | "video" =>
  /\.(mp3|m4a|ogg|wav|aac)(\?|#|$)/i.test(url) ? "audio" : "video";

export type LiveOverlayState = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  scenes: LiveOverlayScene[];
  bracket: LiveOverlayBracket | null;
  videoClips: LiveOverlayVideoClip[];
  updatedAt: string;
};

/**
 * Normaliza CUALQUIER estado entrante (socket/fetch) a la forma completa con
 * defaults. Evita crashes cuando llega un estado viejo (ej. el Durable Object
 * cacheó una versión previa que no tenía algún campo como `videoClips`).
 */
export const normalizeLiveOverlayState = (
  s: Partial<LiveOverlayState> | null | undefined
): LiveOverlayState => {
  const rarityCounters = LIVE_OVERLAY_RARITY_COUNTER_KEYS.reduce(
    (acc, key) => {
      const v = (s?.rarityCounters as Record<string, unknown> | undefined)?.[
        key
      ];
      acc[key] = typeof v === "number" && Number.isFinite(v) ? v : 0;
      return acc;
    },
    {} as LiveOverlayRarityCounters
  );
  return {
    currentCard: s?.currentCard ?? null,
    rarityCounters,
    scenes: Array.isArray(s?.scenes) ? s!.scenes! : [],
    bracket: s?.bracket ?? null,
    videoClips: Array.isArray(s?.videoClips) ? s!.videoClips! : [],
    updatedAt:
      typeof s?.updatedAt === "string"
        ? s!.updatedAt!
        : new Date(0).toISOString(),
  };
};
