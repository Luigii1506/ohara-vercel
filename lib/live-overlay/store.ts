import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LiveOverlayBracket,
  LiveOverlayBracketData,
  LiveOverlayCard,
  LiveOverlayChatItem,
  LiveOverlayLeaderboardEntry,
  LiveOverlayRarityCounterKey,
  LiveOverlayRarityCounters,
  LiveOverlayScene,
  LiveOverlaySceneType,
  LiveOverlayState,
  LiveOverlayVideoClip,
} from "@/lib/live-overlay/types";
import {
  LIVE_OVERLAY_CHAT_FEED_MAX,
  LIVE_OVERLAY_LEADERBOARD_SIZE,
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  LIVE_OVERLAY_SCENE_TYPES,
  createEmptyBracket,
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
  videoClips: [],
  chatFeed: [],
  likeCount: 0,
  topLikers: [],
  topGifters: [],
  updatedAt: new Date(0).toISOString(),
});

/**
 * El ranking se deriva de un tally COMPLETO por usuario (no capado), guardado
 * en `likerTallies`/`gifterTallies`. Si guardáramos solo el top N y alguien se
 * cae de la lista, su conteo anterior se pierde — la próxima tanda de likes
 * arrancaría de 0 en vez de sumar a lo que ya había dado.
 */
const normalizeTally = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const tally: Record<string, number> = {};
  for (const [user, count] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) {
      tally[user] = count;
    }
  }
  return tally;
};

const topFromTally = (tally: Record<string, number>): LiveOverlayLeaderboardEntry[] =>
  Object.entries(tally)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, LIVE_OVERLAY_LEADERBOARD_SIZE);

/** Normaliza la biblioteca de clips de video. */
const normalizeVideoClips = (raw: unknown): LiveOverlayVideoClip[] => {
  if (!Array.isArray(raw)) return [];
  const clips: LiveOverlayVideoClip[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url : "";
    const id = typeof r.id === "string" ? r.id : "";
    if (!url || !id) continue;
    clips.push({
      id,
      label: typeof r.label === "string" ? r.label : "Clip",
      emoji: typeof r.emoji === "string" ? r.emoji : "🎬",
      url,
      kind: r.kind === "audio" ? "audio" : "video",
      startSec: typeof r.startSec === "number" ? r.startSec : undefined,
      endSec: typeof r.endSec === "number" ? r.endSec : undefined,
      loop: r.loop === true,
      muted: r.muted === true,
      fit: r.fit === "contain" ? "contain" : "cover",
    });
  }
  return clips;
};

/** Normaliza el feed de chat: descarta lo inválido y recorta al máximo. */
const normalizeChatFeed = (raw: unknown): LiveOverlayChatItem[] => {
  if (!Array.isArray(raw)) return [];
  const items: LiveOverlayChatItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const user = typeof r.user === "string" ? r.user : "";
    const text = typeof r.text === "string" ? r.text : "";
    if (!id || !text) continue;
    items.push({
      id,
      user,
      text,
      receivedAt:
        typeof r.receivedAt === "string" ? r.receivedAt : new Date(0).toISOString(),
    });
  }
  return items.slice(-LIVE_OVERLAY_CHAT_FEED_MAX);
};

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
    active: r.active === true,
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
    videoClips: normalizeVideoClips((row as { videoClips?: unknown }).videoClips),
    chatFeed: normalizeChatFeed((row as { chatFeed?: unknown }).chatFeed),
    likeCount:
      typeof (row as { likeCount?: unknown }).likeCount === "number"
        ? Math.max(0, (row as { likeCount: number }).likeCount)
        : 0,
    topLikers: topFromTally(normalizeTally((row as { likerTallies?: unknown }).likerTallies)),
    topGifters: topFromTally(normalizeTally((row as { gifterTallies?: unknown }).gifterTallies)),
    updatedAt: row.updatedAt.toISOString(),
  };
};

type PersistPayload = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  scenes: LiveOverlayScene[];
  bracket: LiveOverlayBracket | null;
  videoClips: LiveOverlayVideoClip[];
  chatFeed: LiveOverlayChatItem[];
  likeCount: number;
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
  const videoClipsJson = next.videoClips as unknown as Prisma.InputJsonValue;
  const chatFeedJson = next.chatFeed as unknown as Prisma.InputJsonValue;
  const likeCount = Math.max(0, Math.trunc(next.likeCount));

  const saved = await prisma.liveOverlayState.upsert({
    where: { token },
    create: {
      token,
      currentCard: currentCardJson,
      rarityCounters: rarityJson,
      scenes: scenesJson,
      bracket: bracketJson,
      videoClips: videoClipsJson,
      chatFeed: chatFeedJson,
      likeCount,
    },
    update: {
      currentCard: currentCardJson,
      rarityCounters: rarityJson,
      scenes: scenesJson,
      bracket: bracketJson,
      videoClips: videoClipsJson,
      chatFeed: chatFeedJson,
      likeCount,
    },
  });
  return {
    currentCard: (saved.currentCard as LiveOverlayCard | null) ?? null,
    rarityCounters: normalizeCounters(saved.rarityCounters),
    scenes: normalizeScenes((saved as { scenes?: unknown }).scenes),
    bracket: normalizeBracket((saved as { bracket?: unknown }).bracket),
    videoClips: normalizeVideoClips(
      (saved as { videoClips?: unknown }).videoClips
    ),
    chatFeed: normalizeChatFeed((saved as { chatFeed?: unknown }).chatFeed),
    likeCount: Math.max(0, (saved as { likeCount: number }).likeCount ?? 0),
    topLikers: topFromTally(normalizeTally((saved as { likerTallies?: unknown }).likerTallies)),
    topGifters: topFromTally(normalizeTally((saved as { gifterTallies?: unknown }).gifterTallies)),
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
    videoClips: patch.videoClips ?? current.videoClips,
    chatFeed: patch.chatFeed ?? current.chatFeed,
    likeCount: patch.likeCount ?? current.likeCount,
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
          emoji: combo.emoji ?? "",
          label: combo.label ?? "",
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

// ---------------------------------------------------------------------------
// Interacción en vivo de TikTok (alertas de gift/follow en cola, chat, likes)
// ---------------------------------------------------------------------------

const LIVE_OVERLAY_ALERT_TTL_MS_DEFAULT = 4000;

/**
 * Dispara una alerta (gift/follow) como escena `alert` con id ÚNICO por
 * evento (a diferencia de las demás escenas one-shot, que son singletons por
 * `id = type`). Así varias alertas seguidas se muestran en cola en vez de
 * pisarse. Al mismo tiempo purga del stack las alertas ya vencidas, para que
 * el array no crezca sin límite.
 */
export const triggerLiveOverlayAlert = (
  token: string,
  alert: { emoji?: string; text: string; subtitle?: string; accent?: string },
  ttlMs: number = LIVE_OVERLAY_ALERT_TTL_MS_DEFAULT
) =>
  updateState(token, (state) => {
    const now = Date.now();
    const alive = state.scenes.filter((s) => {
      if (s.type !== "alert") return true;
      if (!s.triggeredAt || !s.ttlMs) return false;
      return now - Date.parse(s.triggeredAt) < s.ttlMs;
    });
    const id = `alert-${now}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      currentCard: state.currentCard,
      rarityCounters: state.rarityCounters,
      scenes: [
        ...alive,
        {
          id,
          type: "alert" as LiveOverlaySceneType,
          z: 60,
          visible: true,
          props: {
            emoji: alert.emoji ?? "",
            text: alert.text,
            subtitle: alert.subtitle ?? "",
            accent: alert.accent ?? "",
          },
          triggeredAt: new Date(now).toISOString(),
          ttlMs,
        },
      ].sort((a, b) => a.z - b.z),
    };
  });

/** Agrega un mensaje al feed de chat (recorta al máximo definido). */
export const appendLiveOverlayChatItem = (
  token: string,
  item: { user: string; text: string }
) =>
  updateState(token, (state) => ({
    chatFeed: [
      ...state.chatFeed,
      {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user: item.user,
        text: item.text.slice(0, 300),
        receivedAt: new Date().toISOString(),
      },
    ].slice(-LIVE_OVERLAY_CHAT_FEED_MAX),
  }));

/** Fija el contador de likes al total acumulado que reporta TikTok. */
export const setLiveOverlayLikeCount = (token: string, total: number) =>
  updateState(token, () => ({
    likeCount: Math.max(0, Math.trunc(total)),
  }));

export const resetLiveOverlayLikeCount = (token: string) =>
  updateState(token, () => ({ likeCount: 0 }));

/**
 * Suma `amount` al tally COMPLETO del usuario (no solo al top N mostrado) y
 * persiste directo en la columna correspondiente — bypasea updateState/
 * PersistPayload porque estos tallies son un detalle interno, no parte del
 * estado "editable a mano" desde Live Desk.
 */
const bumpTikTokTally = async (
  token: string,
  column: "likerTallies" | "gifterTallies",
  user: string,
  amount: number
): Promise<LiveOverlayState> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  const tally = normalizeTally(row ? (row as Record<string, unknown>)[column] : null);
  tally[user] = (tally[user] ?? 0) + amount;
  const tallyJson = tally as unknown as Prisma.InputJsonValue;

  if (!row) {
    await prisma.liveOverlayState.create({
      data: {
        token,
        rarityCounters: createDefaultRarityCounters() as unknown as Prisma.InputJsonValue,
        [column]: tallyJson,
      },
    });
  } else {
    await prisma.liveOverlayState.update({
      where: { token },
      data: { [column]: tallyJson },
    });
  }

  return getLiveOverlayState(token);
};

export const bumpLiveOverlayTopLikers = (token: string, user: string, amount: number) =>
  bumpTikTokTally(token, "likerTallies", user, amount);

export const bumpLiveOverlayTopGifters = (token: string, user: string, amount: number) =>
  bumpTikTokTally(token, "gifterTallies", user, amount);

/** Limpia ambos rankings (tally completo) — se llama al conectar a un nuevo live. */
export const resetLiveOverlayLeaderboards = async (token: string): Promise<LiveOverlayState> => {
  await prisma.liveOverlayState.upsert({
    where: { token },
    create: {
      token,
      rarityCounters: createDefaultRarityCounters() as unknown as Prisma.InputJsonValue,
      likerTallies: {},
      gifterTallies: {},
    },
    update: { likerTallies: {}, gifterTallies: {} },
  });
  return getLiveOverlayState(token);
};

/**
 * Limpia TODO lo relacionado a la interacción de TikTok del overlay (chat,
 * alertas de gift/follow, contador de likes, rankings) — se llama al
 * desconectar, así el overlay no se queda mostrando datos de un live que ya
 * terminó.
 */
export const clearLiveOverlayTikTokInteraction = async (
  token: string
): Promise<LiveOverlayState> => {
  await updateState(token, (state) => ({
    chatFeed: [],
    likeCount: 0,
    scenes: state.scenes.filter((s) => s.type !== "alert"),
  }));
  return resetLiveOverlayLeaderboards(token);
};

/** Guarda/actualiza los NOMBRES del bracket (preserva la visibilidad `active`). */
export const setLiveOverlayBracket = (
  token: string,
  data: LiveOverlayBracketData
) =>
  updateState(token, (state) => ({
    bracket: {
      ...(state.bracket ?? createEmptyBracket()),
      ...data,
    },
  }));

/** Muestra/oculta el bracket como escena a pantalla completa (preserva nombres). */
export const setLiveOverlayBracketActive = (token: string, active: boolean) =>
  updateState(token, (state) => ({
    bracket: { ...(state.bracket ?? createEmptyBracket()), active },
  }));

/** Quita el bracket por completo. */
export const clearLiveOverlayBracket = (token: string) =>
  updateState(token, () => ({ bracket: null }));

/** Agrega o reemplaza (por id) un clip de video en la biblioteca. */
export const addLiveOverlayVideoClip = (
  token: string,
  clip: LiveOverlayVideoClip
) =>
  updateState(token, (state) => ({
    videoClips: [
      ...state.videoClips.filter((c) => c.id !== clip.id),
      clip,
    ],
  }));

/** Quita un clip de la biblioteca. */
export const removeLiveOverlayVideoClip = (token: string, id: string) =>
  updateState(token, (state) => ({
    videoClips: state.videoClips.filter((c) => c.id !== id),
  }));

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
