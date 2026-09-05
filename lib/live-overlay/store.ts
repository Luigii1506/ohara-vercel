import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LiveOverlayBattleConfig,
  LiveOverlayBattleDiamondTier,
  LiveOverlayBattleEvent,
  LiveOverlayBattleFighter,
  LiveOverlayBattlePower,
  LiveOverlayBattleRoster,
  LiveOverlayBattleTeam,
  LiveOverlayBattleWinMode,
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
  BATTLE_POWER_DISPLAY,
  DEFAULT_BATTLE_DIAMOND_TIERS,
  LIVE_OVERLAY_BATTLE_EVENT_MAX,
  LIVE_OVERLAY_CHAT_FEED_MAX,
  LIVE_OVERLAY_LEADERBOARD_SIZE,
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  LIVE_OVERLAY_SCENE_TYPES,
  applyPendingBattleDot,
  createDefaultBattleConfig,
  createEmptyBracket,
  deriveLiveOverlayBattleOutcome,
} from "@/lib/live-overlay/types";
import { findLiveOverlayCombo } from "@/lib/live-overlay/combos";

/**
 * Estado del overlay persistido en Postgres (tabla LiveOverlayState). Antes era
 * un Map en memoria, que en Vercel serverless NO se comparte entre instancias:
 * el panel (POST) y el overlay (GET) podían caer en lambdas distintas y no ver
 * el mismo estado. En DB funciona confiable entre instancias.
 */

// NOTA sobre concurrencia: se probó envolver las escrituras en una
// transacción con "SELECT ... FOR UPDATE" (bloqueo real de fila) para que
// ninguna escritura pudiera pisar a otra. Bajo carga real (ráfagas de
// eventos de TikTok) esto resultó PEOR: Prisma mata la transacción a los 5s
// si tiene que esperar la fila bloqueada, y el evento se pierde con un error
// en vez de solo tardar un poco más — cambia una pérdida silenciosa rara por
// fallas duras frecuentes. La cola en orden del worker (cloudflare-live)
// ya serializa los eventos de TikTok entre sí, que es la fuente de la
// inmensa mayoría de escrituras concurrentes; una acción de Live Desk
// coincidiendo exactamente con un evento de TikTok es rara y se
// autocorrige con el siguiente evento, así que no vale la pena el riesgo.

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
  viewerCount: 0,
  battle: createDefaultBattleConfig(),
  battleRoster: {},
  updatedAt: new Date(0).toISOString(),
});

/**
 * El ranking se deriva de un tally COMPLETO por usuario (no capado), guardado
 * en `likerTallies`/`gifterTallies`. Si guardáramos solo el top N y alguien se
 * cae de la lista, su conteo anterior se pierde — la próxima tanda de likes
 * arrancaría de 0 en vez de sumar a lo que ya había dado. Cada entrada guarda
 * también el avatar más reciente que vimos de ese usuario.
 */
type TallyEntry = { count: number; avatar: string };

const normalizeTally = (raw: unknown): Record<string, TallyEntry> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const tally: Record<string, TallyEntry> = {};
  for (const [user, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number") {
      // Compat con datos guardados antes de agregar avatar (solo era un número).
      if (Number.isFinite(value) && value > 0) tally[user] = { count: value, avatar: "" };
      continue;
    }
    if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      const count = typeof v.count === "number" && Number.isFinite(v.count) ? v.count : 0;
      const avatar = typeof v.avatar === "string" ? v.avatar : "";
      if (count > 0) tally[user] = { count, avatar };
    }
  }
  return tally;
};

const topFromTally = (tally: Record<string, TallyEntry>): LiveOverlayLeaderboardEntry[] =>
  Object.entries(tally)
    .map(([user, v]) => ({ user, count: v.count, avatar: v.avatar }))
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
      avatar: typeof r.avatar === "string" ? r.avatar : "",
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

/** Normaliza un poder individual (regalo→efecto). Descarta formas inválidas. */
const normalizeBattlePower = (raw: unknown): LiveOverlayBattlePower | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  switch (r.kind) {
    case "hit":
      return { kind: "hit", amount: num(r.amount, 50) };
    case "aoe":
      return {
        kind: "aoe",
        amount: num(r.amount, 30),
        targets: Math.max(1, Math.trunc(num(r.targets, 3))),
      };
    case "chain":
      return {
        kind: "chain",
        amount: num(r.amount, 40),
        hops: Math.max(1, Math.trunc(num(r.hops, 3))),
      };
    case "pierce":
      return { kind: "pierce", amount: num(r.amount, 50) };
    case "freeze":
      return { kind: "freeze", durationMs: Math.max(0, num(r.durationMs, 5000)) };
    case "burn":
      return {
        kind: "burn",
        dmgPerTick: num(r.dmgPerTick, 10),
        durationMs: Math.max(0, num(r.durationMs, 10000)),
      };
    case "poison":
      return {
        kind: "poison",
        dmgPerTick: num(r.dmgPerTick, 10),
        durationMs: Math.max(0, num(r.durationMs, 10000)),
      };
    case "knockback":
      return { kind: "knockback" };
    case "heal":
      return { kind: "heal", amount: num(r.amount, 50) };
    case "healAll":
      return { kind: "healAll", amount: num(r.amount, 30) };
    case "shield":
      return {
        kind: "shield",
        amount: num(r.amount, 100),
        durationMs: Math.max(0, num(r.durationMs, 8000)),
      };
    case "nuke":
      return { kind: "nuke", amount: num(r.amount, 100) };
    case "growMaxHp":
      return { kind: "growMaxHp", amount: num(r.amount, 50) };
    case "rapidFire":
      return { kind: "rapidFire", durationMs: Math.max(0, num(r.durationMs, 8000)) };
    case "damageBoost":
      return {
        kind: "damageBoost",
        multiplier: Math.max(1, num(r.multiplier, 2)),
        durationMs: Math.max(0, num(r.durationMs, 8000)),
      };
    default:
      return null;
  }
};

const normalizeDiamondTiers = (raw: unknown): LiveOverlayBattleDiamondTier[] => {
  if (!Array.isArray(raw)) return DEFAULT_BATTLE_DIAMOND_TIERS;
  const tiers: LiveOverlayBattleDiamondTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const power = normalizeBattlePower(r.power);
    if (!power) continue;
    const min = typeof r.min === "number" && Number.isFinite(r.min) ? Math.max(0, r.min) : 0;
    tiers.push({ min, power });
  }
  tiers.sort((a, b) => a.min - b.min);
  return tiers.length > 0 ? tiers : DEFAULT_BATTLE_DIAMOND_TIERS;
};

/** Claves guardadas en minúscula: el lookup por nombre de regalo es case-insensitive. */
const normalizeGiftPowerMap = (raw: unknown): Record<string, LiveOverlayBattlePower> => {
  if (!raw || typeof raw !== "object") return {};
  const map: Record<string, LiveOverlayBattlePower> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const power = normalizeBattlePower(value);
    const key = name.trim().toLowerCase();
    if (power && key) map[key] = power;
  }
  return map;
};

const BATTLE_POWER_KINDS = Object.keys(BATTLE_POWER_DISPLAY) as LiveOverlayBattlePower["kind"][];

/** Normaliza el log corto de eventos recientes (para el letrero "qué pasó" del overlay). */
const normalizeBattleEvents = (raw: unknown): LiveOverlayBattleEvent[] => {
  if (!Array.isArray(raw)) return [];
  const events: LiveOverlayBattleEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const user = typeof r.user === "string" ? r.user : "";
    const team = r.team === "A" || r.team === "B" ? r.team : null;
    const kind = BATTLE_POWER_KINDS.includes(r.kind as LiveOverlayBattlePower["kind"])
      ? (r.kind as LiveOverlayBattlePower["kind"])
      : null;
    if (!id || !user || !team || !kind) continue;
    events.push({
      id,
      at: typeof r.at === "string" ? r.at : new Date(0).toISOString(),
      user,
      team,
      kind,
      targets: Array.isArray(r.targets) ? r.targets.filter((t): t is string => typeof t === "string") : [],
    });
  }
  return events.slice(-LIVE_OVERLAY_BATTLE_EVENT_MAX);
};

/** Normaliza la config de la batalla (o defaults si no hay nada guardado). */
const normalizeBattleConfig = (raw: unknown): LiveOverlayBattleConfig => {
  const base = createDefaultBattleConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v : fallback;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const winMode: LiveOverlayBattleWinMode =
    r.winMode === "elimination" ||
    r.winMode === "firstToKills" ||
    r.winMode === "timed" ||
    r.winMode === "sandbox"
      ? r.winMode
      : base.winMode;
  return {
    active: r.active === true,
    teamAName: str(r.teamAName, base.teamAName),
    teamBName: str(r.teamBName, base.teamBName),
    teamAKeyword: str(r.teamAKeyword, base.teamAKeyword),
    teamBKeyword: str(r.teamBKeyword, base.teamBKeyword),
    maxHp: Math.max(1, Math.trunc(num(r.maxHp, base.maxHp))),
    winMode,
    killTarget:
      typeof r.killTarget === "number" && Number.isFinite(r.killTarget)
        ? Math.max(1, Math.trunc(r.killTarget))
        : base.killTarget,
    durationMs:
      typeof r.durationMs === "number" && Number.isFinite(r.durationMs)
        ? Math.max(1000, Math.trunc(r.durationMs))
        : base.durationMs,
    roundStartedAt: typeof r.roundStartedAt === "string" ? r.roundStartedAt : null,
    roundEndsAt: typeof r.roundEndsAt === "string" ? r.roundEndsAt : null,
    giftPowerMap: normalizeGiftPowerMap(r.giftPowerMap),
    diamondTierFallback: normalizeDiamondTiers(r.diamondTierFallback),
    backgroundUrl: typeof r.backgroundUrl === "string" && r.backgroundUrl ? r.backgroundUrl : null,
    autoFireEnabled: r.autoFireEnabled !== false,
    autoFireCooldownMs: Math.max(1000, Math.trunc(num(r.autoFireCooldownMs, base.autoFireCooldownMs))),
    autoFireAmount: Math.max(1, Math.trunc(num(r.autoFireAmount, base.autoFireAmount))),
    lastAutoFireAt: typeof r.lastAutoFireAt === "string" ? r.lastAutoFireAt : null,
    recentEvents: normalizeBattleEvents(r.recentEvents),
  };
};

const normalizeBattleFighter = (raw: unknown): LiveOverlayBattleFighter | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const team: LiveOverlayBattleTeam | null = r.team === "A" || r.team === "B" ? r.team : null;
  if (!team) return null;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    team,
    avatar: str(r.avatar),
    displayName: str(r.displayName),
    hp: Math.max(0, num(r.hp, 0)),
    maxHp: Math.max(1, num(r.maxHp, 1000)),
    kills: Math.max(0, Math.trunc(num(r.kills, 0))),
    shieldHp: Math.max(0, num(r.shieldHp, 0)),
    shieldUntil: strOrNull(r.shieldUntil),
    frozenUntil: strOrNull(r.frozenUntil),
    burnUntil: strOrNull(r.burnUntil),
    burnDmgPerTick: Math.max(0, num(r.burnDmgPerTick, 0)),
    burnLastTickAt: strOrNull(r.burnLastTickAt),
    poisonUntil: strOrNull(r.poisonUntil),
    poisonDmgPerTick: Math.max(0, num(r.poisonDmgPerTick, 0)),
    poisonLastTickAt: strOrNull(r.poisonLastTickAt),
    rapidFireUntil: strOrNull(r.rapidFireUntil),
    damageBoostUntil: strOrNull(r.damageBoostUntil),
    damageBoostMultiplier: Math.max(1, num(r.damageBoostMultiplier, 1)),
    joinedAt: str(r.joinedAt) || new Date(0).toISOString(),
  };
};

/** Roster completo (clave = tiktok uniqueId) — mismo patrón que likerTallies/gifterTallies. */
const normalizeBattleRoster = (raw: unknown): LiveOverlayBattleRoster => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const roster: LiveOverlayBattleRoster = {};
  for (const [user, value] of Object.entries(raw as Record<string, unknown>)) {
    const fighter = normalizeBattleFighter(value);
    if (fighter && user) roster[user] = fighter;
  }
  return roster;
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
    viewerCount:
      typeof (row as { viewerCount?: unknown }).viewerCount === "number"
        ? Math.max(0, (row as { viewerCount: number }).viewerCount)
        : 0,
    battle: normalizeBattleConfig((row as { battle?: unknown }).battle),
    // Proyección de solo-lectura: aplica el daño de burn/poison pendiente
    // para que la barra de HP se vea viva entre eventos, sin escribir nada.
    battleRoster: applyPendingBattleDot(
      normalizeBattleRoster((row as { battleRoster?: unknown }).battleRoster)
    ),
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
  viewerCount: number;
  battle: LiveOverlayBattleConfig;
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
  const battleJson = next.battle as unknown as Prisma.InputJsonValue;
  const likeCount = Math.max(0, Math.trunc(next.likeCount));
  const viewerCount = Math.max(0, Math.trunc(next.viewerCount));

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
      viewerCount,
      battle: battleJson,
    },
    update: {
      currentCard: currentCardJson,
      rarityCounters: rarityJson,
      scenes: scenesJson,
      bracket: bracketJson,
      videoClips: videoClipsJson,
      chatFeed: chatFeedJson,
      likeCount,
      viewerCount,
      battle: battleJson,
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
    viewerCount: Math.max(0, (saved as { viewerCount: number }).viewerCount ?? 0),
    battle: normalizeBattleConfig((saved as { battle?: unknown }).battle),
    battleRoster: applyPendingBattleDot(
      normalizeBattleRoster((saved as { battleRoster?: unknown }).battleRoster)
    ),
    updatedAt: saved.updatedAt.toISOString(),
  };
};

// El updater devuelve un PARCIAL; lo mezclamos con el estado actual, así los
// updaters existentes (que no tocan bracket) lo preservan automáticamente.
// TODO el ciclo leer→mezclar→guardar corre bajo el lock de fila (withRowLock):
// una acción de Live Desk y un evento de TikTok que lleguen casi juntos ya no
// pueden pisarse — el segundo espera a que el primero termine y parte del
// estado ya actualizado, no de uno viejo.
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
    viewerCount: patch.viewerCount ?? current.viewerCount,
    battle: patch.battle ?? current.battle,
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
  alert: { emoji?: string; text: string; subtitle?: string; accent?: string; avatar?: string },
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
            avatar: alert.avatar ?? "",
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
  item: { user: string; avatar?: string; text: string }
) =>
  updateState(token, (state) => ({
    chatFeed: [
      ...state.chatFeed,
      {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user: item.user,
        avatar: item.avatar ?? "",
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

/** Fija el conteo de viewers en vivo. */
export const setLiveOverlayViewerCount = (token: string, count: number) =>
  updateState(token, () => ({
    viewerCount: Math.max(0, Math.trunc(count)),
  }));

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
  amount: number,
  avatar: string
): Promise<LiveOverlayState> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  const tally = normalizeTally(row ? (row as Record<string, unknown>)[column] : null);
  const prev = tally[user];
  tally[user] = {
    count: (prev?.count ?? 0) + amount,
    avatar: avatar || prev?.avatar || "",
  };
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

export const bumpLiveOverlayTopLikers = (token: string, user: string, amount: number, avatar = "") =>
  bumpTikTokTally(token, "likerTallies", user, amount, avatar);

export const bumpLiveOverlayTopGifters = (token: string, user: string, amount: number, avatar = "") =>
  bumpTikTokTally(token, "gifterTallies", user, amount, avatar);

/**
 * Conteo de UN usuario específico (esté o no en el top N mostrado) — para
 * verificar en vivo si sus eventos están llegando bien, sin depender de que
 * aparezca en el ranking.
 */
export const getLiveOverlayUserTally = async (
  token: string,
  user: string
): Promise<{ likes: number; gifts: number }> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  const likerTally = normalizeTally(row ? (row as Record<string, unknown>).likerTallies : null);
  const gifterTally = normalizeTally(row ? (row as Record<string, unknown>).gifterTallies : null);
  return { likes: likerTally[user]?.count ?? 0, gifts: gifterTally[user]?.count ?? 0 };
};

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
    viewerCount: 0,
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

// ---------------------------------------------------------------------------
// Team Battle ("Side Battle"): equipos A/B, un círculo por espectador.
// `battle` (config) va por el camino normal de updateState/PersistPayload,
// igual que `bracket` — se edita ocasionalmente desde Live Desk. `battleRoster`
// va por un camino propio (como likerTallies/gifterTallies): se muta en cada
// gift/like/comment durante una ronda activa, así que no tiene sentido
// arrastrarlo por el ciclo genérico de PersistPayload.
// ---------------------------------------------------------------------------

/** Config editable desde Live Desk (nombres, keywords, HP, modo, mapeo de poderes, fondo). */
export const setLiveOverlayBattleConfig = (
  token: string,
  patch: Partial<
    Omit<LiveOverlayBattleConfig, "active" | "roundStartedAt" | "roundEndsAt">
  >
) =>
  updateState(token, (state) => ({
    battle: { ...state.battle, ...patch },
  }));

/**
 * Lee config+roster frescos, deja que el mutator devuelva un parche de
 * cualquiera de los dos (o `null` para no-op), y persiste ambos en un solo
 * `update`. La mayoría de los eventos (join/gift/like) solo tocan el roster;
 * el auto-ataque (`applyLiveOverlayBattleAutoFire`) necesita tocar también
 * `battle.lastAutoFireAt`, por eso el mutator puede devolver ambos.
 *
 * CONCURRENCIA: a diferencia de likerTallies/gifterTallies (que aceptan
 * perder una actualización rara porque solo afecta un ranking cosmético),
 * acá SÍ importa — confirmado en vivo: con el auto-ataque escribiendo el
 * roster cada 1.5-2s desde CUALQUIER pestaña con el overlay abierto, un join
 * real llegó a perderse por completo (dos escrituras leyeron el mismo roster
 * viejo y la segunda pisó a la primera). La solución NO es volver a
 * transacciones con SELECT...FOR UPDATE (eso ya se probó y falló por el
 * timeout de 5s de Prisma bajo ráfagas, ver nota arriba) — es optimistic
 * concurrency reusando la columna `updatedAt` que ya existe: el UPDATE solo
 * aplica si nadie escribió desde que leímos, y si alguien sí escribió,
 * reintenta desde una lectura fresca. Es una sola sentencia rápida por
 * intento, sin fila bloqueada ni riesgo de timeout.
 */
const withBattleState = async (
  token: string,
  mutator: (
    config: LiveOverlayBattleConfig,
    roster: LiveOverlayBattleRoster
  ) => { config?: Partial<LiveOverlayBattleConfig>; roster?: LiveOverlayBattleRoster } | null,
  attempt = 0
): Promise<LiveOverlayState> => {
  const row = await prisma.liveOverlayState.findUnique({ where: { token } });
  const config = normalizeBattleConfig(row ? (row as Record<string, unknown>).battle : null);
  const rawRoster = normalizeBattleRoster(
    row ? (row as Record<string, unknown>).battleRoster : null
  );
  // Asienta el daño de burn/poison pendiente ANTES del evento nuevo, así
  // nunca se pierde ni se cuenta dos veces (ver applyPendingBattleDot).
  const settledRoster = applyPendingBattleDot(rawRoster);
  const result = mutator(config, settledRoster);
  const rosterSettledOnly = settledRoster !== rawRoster;
  // Si el mutator no hizo nada (ronda inactiva, evento duplicado, etc.) pero
  // SÍ hubo daño sostenido que asentar, igual persistimos eso — si no, no
  // escribimos nada (mismo comportamiento de antes para los no-ops reales).
  if (result === null && !rosterSettledOnly) return getLiveOverlayState(token);

  const nextConfig = result?.config ? { ...config, ...result.config } : config;
  const nextRoster = result?.roster ?? settledRoster;
  const battleJson = nextConfig as unknown as Prisma.InputJsonValue;
  const rosterJson = nextRoster as unknown as Prisma.InputJsonValue;
  if (!row) {
    await prisma.liveOverlayState.create({
      data: {
        token,
        rarityCounters: createDefaultRarityCounters() as unknown as Prisma.InputJsonValue,
        battle: battleJson,
        battleRoster: rosterJson,
      },
    });
    return getLiveOverlayState(token);
  }

  // CAS con un contador entero (`battleVersion`), NO con `updatedAt`: dos
  // escrituras concurrentes reales pueden recibir el MISMO timestamp
  // (resolución de milisegundos), lo que dejaba pasar una escritura vieja
  // como si nada hubiera cambiado — confirmado en vivo (una unión real se
  // perdió con 6 requests en paralelo aun con el chequeo por updatedAt). Un
  // entero que solo avanza en updates exitosos no tiene ese problema.
  const written = await prisma.liveOverlayState.updateMany({
    where: { token, battleVersion: row.battleVersion },
    data: { battle: battleJson, battleRoster: rosterJson, battleVersion: { increment: 1 } },
  });
  if (written.count === 0) {
    // Alguien más escribió la fila justo entre nuestra lectura y este
    // UPDATE (ej. un auto-ataque). Reintenta desde una lectura fresca en vez
    // de perder este evento. En producción real esto casi no debería competir
    // más que de a 2 (un evento de TikTok vs. un tick de auto-ataque), porque
    // el Worker ya serializa los eventos de TikTok entre sí — el tope alto es
    // solo colchón ante una ráfaga rara, con un pequeño jitter para que los
    // reintentos no vuelvan a chocar todos en el mismo instante.
    if (attempt >= 20) {
      console.error("[battle] withBattleState: se agotaron los reintentos por contención", { token });
      return getLiveOverlayState(token);
    }
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 40));
    return withBattleState(token, mutator, attempt + 1);
  }
  return getLiveOverlayState(token);
};

/** Wrapper para mutators que solo tocan el roster (join/gift/like). */
const withBattleRoster = (
  token: string,
  mutator: (
    config: LiveOverlayBattleConfig,
    roster: LiveOverlayBattleRoster
  ) => LiveOverlayBattleRoster | null
): Promise<LiveOverlayState> =>
  withBattleState(token, (config, roster) => {
    const nextRoster = mutator(config, roster);
    return nextRoster === null ? null : { roster: nextRoster };
  });

const createFighter = (
  team: LiveOverlayBattleTeam,
  avatar: string,
  displayName: string,
  maxHp: number
): LiveOverlayBattleFighter => ({
  team,
  avatar,
  displayName,
  hp: maxHp,
  maxHp,
  kills: 0,
  shieldHp: 0,
  shieldUntil: null,
  frozenUntil: null,
  burnUntil: null,
  burnDmgPerTick: 0,
  burnLastTickAt: null,
  poisonUntil: null,
  poisonDmgPerTick: 0,
  poisonLastTickAt: null,
  rapidFireUntil: null,
  damageBoostUntil: null,
  damageBoostMultiplier: 1,
  joinedAt: new Date().toISOString(),
});

/** Inicia una ronda nueva: vacía el roster y arma los tiempos según el modo. */
export const startLiveOverlayBattleRound = async (token: string): Promise<LiveOverlayState> => {
  await prisma.liveOverlayState.upsert({
    where: { token },
    create: {
      token,
      rarityCounters: createDefaultRarityCounters() as unknown as Prisma.InputJsonValue,
      battleRoster: {} as unknown as Prisma.InputJsonValue,
    },
    update: { battleRoster: {} as unknown as Prisma.InputJsonValue },
  });
  return updateState(token, (state) => {
    const now = Date.now();
    const config = state.battle;
    return {
      battle: {
        ...config,
        active: true,
        roundStartedAt: new Date(now).toISOString(),
        roundEndsAt:
          config.winMode === "timed" && config.durationMs
            ? new Date(now + config.durationMs).toISOString()
            : null,
        recentEvents: [],
      },
    };
  });
};

/** Termina la ronda manualmente — el resultado se sigue derivando del HP/kills final. */
export const endLiveOverlayBattleRound = (token: string) =>
  updateState(token, (state) => ({
    battle: { ...state.battle, active: false },
  }));

/**
 * Detecta si un comentario matchea la palabra clave de unión de algún equipo.
 * Compara solo el primer "token" alfanumérico del comentario (trim + minúsculas)
 * contra la keyword configurada, para no matchear de más (ej. keyword "1" no
 * debe activarse con un comentario "100%").
 */
export const matchLiveOverlayBattleJoinKeyword = (
  config: LiveOverlayBattleConfig,
  text: string
): LiveOverlayBattleTeam | null => {
  const firstWord = text.trim().split(/\s+/)[0] ?? "";
  const token = firstWord.replace(/[^a-zA-Z0-9]+$/, "").toLowerCase();
  if (!token) return null;
  const a = config.teamAKeyword.trim().toLowerCase();
  const b = config.teamBKeyword.trim().toLowerCase();
  if (a && token === a) return "A";
  if (b && token === b) return "B";
  return null;
};

/** Une a un espectador a un equipo (no-op si la ronda no está activa/ya terminó, o si ya está en el roster). */
export const joinLiveOverlayBattleTeam = (
  token: string,
  user: string,
  avatar: string,
  team: LiveOverlayBattleTeam
) =>
  withBattleRoster(token, (config, roster) => {
    if (!user || roster[user]) return null;
    const outcome = deriveLiveOverlayBattleOutcome(config, roster);
    if (outcome.ended) return null;
    return { ...roster, [user]: createFighter(team, avatar, user, config.maxHp) };
  });

const resolveGiftPower = (
  config: LiveOverlayBattleConfig,
  giftName: string,
  diamondValue: number
): LiveOverlayBattlePower => {
  const key = giftName.trim().toLowerCase();
  const mapped = key ? config.giftPowerMap[key] : undefined;
  if (mapped) return mapped;
  const tiers =
    config.diamondTierFallback.length > 0
      ? config.diamondTierFallback
      : DEFAULT_BATTLE_DIAMOND_TIERS;
  let chosen = tiers[0];
  for (const tier of tiers) {
    if (diamondValue >= tier.min) chosen = tier;
  }
  return chosen.power;
};

const livingMembers = (
  roster: LiveOverlayBattleRoster,
  team: LiveOverlayBattleTeam
): string[] =>
  Object.entries(roster)
    .filter(([, f]) => f.team === team && f.hp > 0)
    .map(([user]) => user);

const pickRandom = <T,>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const picked: T[] = [];
  while (copy.length > 0 && picked.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
};

const opposingTeam = (team: LiveOverlayBattleTeam): LiveOverlayBattleTeam =>
  team === "A" ? "B" : "A";

/** Cuánto daño nominal lleva un "empuje" — es sobre todo un efecto visual. */
const BATTLE_KNOCKBACK_DAMAGE = 15;
/** Caída de daño por salto de un poder "chain" (cada salto pega menos). */
const BATTLE_CHAIN_DECAY = 0.7;

/** Multiplicador de daño activo de un fighter (poder "damageBoost"), o 1 si no tiene. */
const damageBoostMultiplierOf = (fighter: LiveOverlayBattleFighter, now: number): number =>
  fighter.damageBoostUntil && Date.parse(fighter.damageBoostUntil) > now
    ? fighter.damageBoostMultiplier
    : 1;

/** True si el fighter tiene "rapidFire" activo (dispara el doble en auto-ataque). */
const hasRapidFire = (fighter: LiveOverlayBattleFighter, now: number): boolean =>
  !!fighter.rapidFireUntil && Date.parse(fighter.rapidFireUntil) > now;

/**
 * Aplica daño respetando el escudo activo (si lo hay), salvo que
 * `ignoreShield` sea true (poder "pierce" — lo atraviesa sin gastarlo).
 * Devuelve si el golpe mató.
 */
const applyDamage = (
  fighter: LiveOverlayBattleFighter,
  amount: number,
  now: number,
  ignoreShield = false
): { fighter: LiveOverlayBattleFighter; killed: boolean } => {
  let remaining = amount;
  let shieldHp = fighter.shieldHp;
  if (!ignoreShield) {
    if (shieldHp > 0 && fighter.shieldUntil && Date.parse(fighter.shieldUntil) > now) {
      const absorbed = Math.min(shieldHp, remaining);
      shieldHp -= absorbed;
      remaining -= absorbed;
    } else {
      shieldHp = 0;
    }
  }
  const hp = Math.max(0, fighter.hp - remaining);
  const killed = fighter.hp > 0 && hp === 0;
  return { fighter: { ...fighter, hp, shieldHp }, killed };
};

/**
 * Aplica un poder YA RESUELTO al roster (mutando `next` in-place) y devuelve
 * a quién afectó — el mismo código que dispara un regalo real y el botón de
 * "modo prueba" del panel de admin, así probar un poder a mano ejercita
 * exactamente el mismo camino (targeting, muertes, animación) que vería un
 * espectador real, no un atajo aparte que se puede desincronizar.
 */
const applyResolvedBattlePower = (
  next: LiveOverlayBattleRoster,
  attackerUser: string,
  power: LiveOverlayBattlePower,
  now: number
): string[] => {
  const attacker = next[attackerUser];
  const enemyTeam = opposingTeam(attacker.team);
  // Para el letrero "qué pasó" del overlay — a quién afectó esta acción.
  const affectedTargets: string[] = [];

  const dealHit = (targetUser: string, amount: number, ignoreShield = false) => {
    const target = next[targetUser];
    if (!target) return;
    const boosted = amount * damageBoostMultiplierOf(next[attackerUser], now);
    const { fighter, killed } = applyDamage(target, boosted, now, ignoreShield);
    next[targetUser] = fighter;
    if (killed) next[attackerUser] = { ...next[attackerUser], kills: next[attackerUser].kills + 1 };
    affectedTargets.push(targetUser);
  };

  switch (power.kind) {
      case "hit": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) dealHit(targetUser, power.amount);
        break;
      }
      case "nuke": {
        for (const targetUser of livingMembers(next, enemyTeam)) dealHit(targetUser, power.amount);
        break;
      }
      case "heal": {
        const current = next[attackerUser];
        next[attackerUser] = { ...current, hp: Math.min(current.maxHp, current.hp + power.amount) };
        affectedTargets.push(attackerUser);
        break;
      }
      case "healAll": {
        for (const [u, f] of Object.entries(next)) {
          if (f.team === attacker.team) {
            next[u] = { ...f, hp: Math.min(f.maxHp, f.hp + power.amount) };
            affectedTargets.push(u);
          }
        }
        break;
      }
      case "shield": {
        const current = next[attackerUser];
        next[attackerUser] = {
          ...current,
          shieldHp: power.amount,
          shieldUntil: new Date(now + power.durationMs).toISOString(),
        };
        affectedTargets.push(attackerUser);
        break;
      }
      case "freeze": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) {
          next[targetUser] = {
            ...next[targetUser],
            frozenUntil: new Date(now + power.durationMs).toISOString(),
          };
          affectedTargets.push(targetUser);
        }
        break;
      }
      case "aoe": {
        for (const targetUser of pickRandom(livingMembers(next, enemyTeam), power.targets)) {
          dealHit(targetUser, power.amount);
        }
        break;
      }
      case "chain": {
        pickRandom(livingMembers(next, enemyTeam), power.hops).forEach((targetUser, i) => {
          dealHit(targetUser, Math.round(power.amount * Math.pow(BATTLE_CHAIN_DECAY, i)));
        });
        break;
      }
      case "pierce": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) dealHit(targetUser, power.amount, true);
        break;
      }
      case "burn": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) {
          next[targetUser] = {
            ...next[targetUser],
            burnUntil: new Date(now + power.durationMs).toISOString(),
            burnDmgPerTick: power.dmgPerTick,
            burnLastTickAt: new Date(now).toISOString(),
          };
          affectedTargets.push(targetUser);
        }
        break;
      }
      case "poison": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) {
          next[targetUser] = {
            ...next[targetUser],
            poisonUntil: new Date(now + power.durationMs).toISOString(),
            poisonDmgPerTick: power.dmgPerTick,
            poisonLastTickAt: new Date(now).toISOString(),
          };
          affectedTargets.push(targetUser);
        }
        break;
      }
      case "knockback": {
        const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
        if (targetUser) dealHit(targetUser, BATTLE_KNOCKBACK_DAMAGE);
        break;
      }
      case "growMaxHp": {
        const current = next[attackerUser];
        const maxHp = current.maxHp + power.amount;
        next[attackerUser] = { ...current, maxHp, hp: Math.min(maxHp, current.hp + power.amount) };
        affectedTargets.push(attackerUser);
        break;
      }
      case "rapidFire": {
        const current = next[attackerUser];
        next[attackerUser] = {
          ...current,
          rapidFireUntil: new Date(now + power.durationMs).toISOString(),
        };
        affectedTargets.push(attackerUser);
        break;
      }
      case "damageBoost": {
        const current = next[attackerUser];
        next[attackerUser] = {
          ...current,
          damageBoostUntil: new Date(now + power.durationMs).toISOString(),
          damageBoostMultiplier: power.multiplier,
        };
        affectedTargets.push(attackerUser);
        break;
      }
    }

  return affectedTargets;
};

const buildBattleEvent = (
  attackerUser: string,
  team: LiveOverlayBattleTeam,
  power: LiveOverlayBattlePower,
  affectedTargets: string[],
  now: number
): LiveOverlayBattleEvent => ({
  id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
  at: new Date(now).toISOString(),
  user: attackerUser,
  team,
  kind: power.kind,
  targets: affectedTargets,
});

/**
 * Aplica el poder de un regalo al roster. Si el gifter no está en el roster
 * todavía, se auto-asigna al equipo con menos miembros (ningún regalo se
 * pierde por no haberse "anotado" antes). No-op si la ronda no está activa.
 */
export const applyLiveOverlayBattleGiftPower = (
  token: string,
  input: {
    user: string;
    avatar: string;
    giftName: string;
    diamondCount: number;
    repeatCount: number;
  }
) =>
  withBattleState(token, (config, roster) => {
    if (!input.user) return null;
    const outcome = deriveLiveOverlayBattleOutcome(config, roster);
    if (outcome.ended) return null;

    const next: LiveOverlayBattleRoster = { ...roster };
    let attacker = next[input.user];
    if (!attacker) {
      const teamACount = Object.values(next).filter((f) => f.team === "A").length;
      const teamBCount = Object.values(next).filter((f) => f.team === "B").length;
      const team: LiveOverlayBattleTeam = teamACount <= teamBCount ? "A" : "B";
      attacker = createFighter(team, input.avatar, input.user, config.maxHp);
      next[input.user] = attacker;
    } else if (input.avatar && input.avatar !== attacker.avatar) {
      attacker = { ...attacker, avatar: input.avatar };
      next[input.user] = attacker;
    }

    const diamondValue = Math.max(0, input.diamondCount) * Math.max(1, input.repeatCount);
    const power = resolveGiftPower(config, input.giftName, diamondValue);
    const now = Date.now();
    const affectedTargets = applyResolvedBattlePower(next, input.user, power, now);
    const event = buildBattleEvent(input.user, attacker.team, power, affectedTargets, now);
    return {
      config: { recentEvents: [...config.recentEvents, event].slice(-LIVE_OVERLAY_BATTLE_EVENT_MAX) },
      roster: next,
    };
  });

/**
 * Modo prueba (panel de admin): aplica un poder elegido a mano a un
 * fighter YA en el roster — mismo camino que un regalo real (targeting,
 * evento en el log, animación), sin pasar por el mapeo de nombre de regalo.
 * A diferencia de un regalo real, es no-op si el usuario no existe todavía
 * (en modo prueba el operador decide explícitamente quién entra al roster
 * con "unirme"/"agregar bot", no queremos auto-crearlo aquí también).
 */
export const applyLiveOverlayBattleTestPower = (
  token: string,
  input: { user: string; power: LiveOverlayBattlePower }
) =>
  withBattleState(token, (config, roster) => {
    if (!input.user || !roster[input.user]) return null;
    const outcome = deriveLiveOverlayBattleOutcome(config, roster);
    if (outcome.ended) return null;

    const next: LiveOverlayBattleRoster = { ...roster };
    const now = Date.now();
    const affectedTargets = applyResolvedBattlePower(next, input.user, input.power, now);
    const event = buildBattleEvent(input.user, next[input.user].team, input.power, affectedTargets, now);
    return {
      config: { recentEvents: [...config.recentEvents, event].slice(-LIVE_OVERLAY_BATTLE_EVENT_MAX) },
      roster: next,
    };
  });

/**
 * Curación menor por likes — deliberadamente pequeña y tope-ada: la atribución
 * de likes por usuario está confirmadamente incompleta bajo carga (no es bug
 * nuestro, es TikTok), así que no debe ser el mecanismo decisivo del juego.
 */
export const applyLiveOverlayBattleLikeHeal = (token: string, user: string, count: number) =>
  withBattleRoster(token, (config, roster) => {
    if (!user || !roster[user] || count <= 0) return null;
    const outcome = deriveLiveOverlayBattleOutcome(config, roster);
    if (outcome.ended) return null;
    const fighter = roster[user];
    if (fighter.hp <= 0) return null;
    return {
      ...roster,
      [user]: { ...fighter, hp: Math.min(fighter.maxHp, fighter.hp + Math.min(count, 20)) },
    };
  });

/**
 * Auto-ataque real (no cosmético): mientras la ronda está activa y no
 * terminó, cada equipo dispara un golpe chico a un enemigo vivo al azar cada
 * `autoFireCooldownMs`, así el juego nunca se ve "congelado" entre regalos —
 * igual que Side Battle. Se llama desde el endpoint de polling público
 * (`/api/live-overlay/state`), NO desde un cron ni el Worker de Cloudflare:
 * ese endpoint ya se pide cada 1-2.5s desde cualquier overlay abierto durante
 * una ronda activa, así que reusarlo da un tick real sin infraestructura
 * nueva. El chequeo de cooldown vive en el servidor y se relee fresco en cada
 * llamada, así que aunque varias pestañas hagan polling a la vez, como mucho
 * se dispara un poquito más seguido de lo esperado (no se pierde ni se
 * acumula) — mismo perfil de riesgo que el resto del estado no-transaccional.
 */
export const applyLiveOverlayBattleAutoFire = (token: string) =>
  withBattleState(token, (config, roster) => {
    if (!config.active || !config.autoFireEnabled) return null;
    const outcome = deriveLiveOverlayBattleOutcome(config, roster);
    if (outcome.ended) return null;

    const now = Date.now();
    const last = config.lastAutoFireAt ? Date.parse(config.lastAutoFireAt) : 0;
    if (now - last < config.autoFireCooldownMs) return null;

    const next: LiveOverlayBattleRoster = { ...roster };
    // TODOS los que estaban vivos al empezar el tick disparan una vez — se
    // fija la lista de antemano para que morir a mitad del tick no le quite
    // su disparo a nadie más (y para que la cantidad de acción escale con
    // cuánta gente se haya unido, no con un tope fijo de 1 por equipo).
    const attackersThisTick = Object.entries(roster)
      .filter(([, f]) => f.hp > 0)
      .map(([user, f]) => ({ user, team: f.team }));

    let changed = false;
    const fireOneShot = (attackerUser: string, enemyTeam: LiveOverlayBattleTeam) => {
      const [targetUser] = pickRandom(livingMembers(next, enemyTeam), 1);
      if (!targetUser) return;
      const amount = config.autoFireAmount * damageBoostMultiplierOf(next[attackerUser], now);
      const { fighter, killed } = applyDamage(next[targetUser], amount, now);
      next[targetUser] = fighter;
      if (killed) next[attackerUser] = { ...next[attackerUser], kills: next[attackerUser].kills + 1 };
      changed = true;
    };
    for (const attacker of attackersThisTick) {
      if (next[attacker.user].hp <= 0) continue; // ya lo mataron en este mismo tick
      const enemyTeam = opposingTeam(attacker.team);
      fireOneShot(attacker.user, enemyTeam);
      // "rapidFire": dispara una segunda vez en el mismo tick.
      if (next[attacker.user].hp > 0 && hasRapidFire(next[attacker.user], now)) {
        fireOneShot(attacker.user, enemyTeam);
      }
    }

    if (!changed) return null;
    return { config: { lastAutoFireAt: new Date(now).toISOString() }, roster: next };
  });
