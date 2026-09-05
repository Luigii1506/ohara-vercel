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
  "alert",
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

// ===========================================================================
// Interacción en vivo de TikTok (chat + likes acumulados)
// ---------------------------------------------------------------------------
// Los gifts/follows se muestran como escenas `alert` (una por evento, en cola,
// ver triggerLiveOverlayAlert). El chat y el contador de likes son datos que no
// encajan en el modelo de escena-por-slot, así que viven como campos propios.
// ===========================================================================
export type LiveOverlayChatItem = {
  id: string;
  user: string;
  avatar: string;
  text: string;
  receivedAt: string;
};

export const LIVE_OVERLAY_CHAT_FEED_MAX = 12;

/**
 * Ranking de la sesión: top likers (por cantidad de likes) / top regaladores
 * (por DIAMANTES gastados, no por cantidad de regalos — un regalo caro pesa
 * más que varios baratos).
 */
export type LiveOverlayLeaderboardEntry = { user: string; count: number; avatar: string };

// El overlay solo MUESTRA el top 3, pero guardamos más (10) porque el loop de
// "batalla de gifters" (ver OverlayCanvasClient) necesita un plantel más
// grande contra el que el campeón vaya peleando.
export const LIVE_OVERLAY_LEADERBOARD_SIZE = 10;

// ===========================================================================
// Team Battle ("Side Battle"): equipos A/B, un círculo-avatar por espectador
// que se une comentando la palabra clave de su equipo. Regalos/likes disparan
// poderes contra el equipo rival. El resultado de la ronda (quién va ganando,
// quién ganó) NUNCA se guarda como flag — se deriva en cada lectura a partir
// de config + roster + hora actual (ver deriveLiveOverlayBattleOutcome más
// abajo), así no hay carrera por "quién cierra la ronda primero".
// ===========================================================================
export type LiveOverlayBattleTeam = "A" | "B";

export type LiveOverlayBattlePower =
  | { kind: "hit"; amount: number }
  | { kind: "aoe"; amount: number; targets: number }
  | { kind: "chain"; amount: number; hops: number }
  | { kind: "pierce"; amount: number }
  | { kind: "freeze"; durationMs: number }
  | { kind: "burn"; dmgPerTick: number; durationMs: number }
  | { kind: "poison"; dmgPerTick: number; durationMs: number }
  | { kind: "knockback" }
  | { kind: "heal"; amount: number }
  | { kind: "healAll"; amount: number }
  | { kind: "shield"; amount: number; durationMs: number }
  | { kind: "nuke"; amount: number }
  | { kind: "growMaxHp"; amount: number }
  | { kind: "rapidFire"; durationMs: number }
  | { kind: "damageBoost"; multiplier: number; durationMs: number };

export type LiveOverlayBattleDiamondTier = {
  min: number;
  power: LiveOverlayBattlePower;
};

export type LiveOverlayBattleWinMode =
  | "elimination"
  | "firstToKills"
  | "timed"
  | "sandbox";

export type LiveOverlayBattleConfig = {
  active: boolean;
  teamAName: string;
  teamBName: string;
  teamAKeyword: string;
  teamBKeyword: string;
  maxHp: number;
  winMode: LiveOverlayBattleWinMode;
  killTarget: number | null;
  durationMs: number | null;
  roundStartedAt: string | null;
  roundEndsAt: string | null;
  giftPowerMap: Record<string, LiveOverlayBattlePower>;
  diamondTierFallback: LiveOverlayBattleDiamondTier[];
  backgroundUrl: string | null;
  // Auto-ataque real (no solo cosmético): cada equipo se pega solo cada
  // `autoFireCooldownMs` mientras el chat/regalos están tranquilos, para que
  // la ronda nunca se vea "congelada" — igual que Side Battle. Se dispara
  // desde el endpoint de polling público (ver store.ts), no desde un cron ni
  // el Worker de Cloudflare.
  autoFireEnabled: boolean;
  autoFireCooldownMs: number;
  autoFireAmount: number;
  lastAutoFireAt: string | null;
  // Log corto de las últimas acciones (regalo → poder) para que el overlay
  // pueda mostrar "quién hizo qué" — sin esto, un golpe/curación/veneno se
  // ven todos igual (solo la barra de HP cambiando), confirmado confuso al
  // probar en vivo. NO incluye disparos de auto-ataque (serían demasiado
  // seguidos) — solo acciones disparadas por un regalo real.
  recentEvents: LiveOverlayBattleEvent[];
};

export type LiveOverlayBattleEvent = {
  id: string;
  at: string;
  user: string;
  team: LiveOverlayBattleTeam;
  kind: LiveOverlayBattlePower["kind"];
  targets: string[];
};

export const LIVE_OVERLAY_BATTLE_EVENT_MAX = 6;

/** Ícono + etiqueta en español por tipo de poder — para el letrero "qué pasó" y el panel de admin. */
export const BATTLE_POWER_DISPLAY: Record<
  LiveOverlayBattlePower["kind"],
  { emoji: string; label: string }
> = {
  hit: { emoji: "⚔️", label: "Golpe" },
  nuke: { emoji: "💣", label: "Bomba" },
  aoe: { emoji: "💥", label: "Salpicadura" },
  chain: { emoji: "⚡", label: "Cadena" },
  pierce: { emoji: "🗡️", label: "Perforante" },
  freeze: { emoji: "❄️", label: "Congelar" },
  burn: { emoji: "🔥", label: "Quemar" },
  poison: { emoji: "☠️", label: "Envenenar" },
  knockback: { emoji: "👊", label: "Empujón" },
  heal: { emoji: "💚", label: "Curarse" },
  healAll: { emoji: "💙", label: "Curar equipo" },
  shield: { emoji: "🛡️", label: "Escudo" },
  growMaxHp: { emoji: "⭐", label: "Power-up de HP" },
  rapidFire: { emoji: "🌀", label: "Disparo rápido" },
  damageBoost: { emoji: "💪", label: "Subir ataque" },
};

export const DEFAULT_BATTLE_DIAMOND_TIERS: LiveOverlayBattleDiamondTier[] = [
  { min: 0, power: { kind: "hit", amount: 30 } },
  { min: 10, power: { kind: "hit", amount: 80 } },
  { min: 100, power: { kind: "hit", amount: 220 } },
  { min: 500, power: { kind: "nuke", amount: 150 } },
];

export const createDefaultBattleConfig = (): LiveOverlayBattleConfig => ({
  active: false,
  teamAName: "Equipo A",
  teamBName: "Equipo B",
  teamAKeyword: "1",
  teamBKeyword: "2",
  maxHp: 1000,
  winMode: "timed",
  killTarget: 10,
  durationMs: 3 * 60 * 1000,
  roundStartedAt: null,
  roundEndsAt: null,
  giftPowerMap: {},
  diamondTierFallback: DEFAULT_BATTLE_DIAMOND_TIERS,
  backgroundUrl: null,
  autoFireEnabled: true,
  autoFireCooldownMs: 1500,
  autoFireAmount: 12,
  lastAutoFireAt: null,
  recentEvents: [],
});

export type LiveOverlayBattleFighter = {
  team: LiveOverlayBattleTeam;
  avatar: string;
  displayName: string;
  hp: number;
  maxHp: number;
  kills: number;
  shieldHp: number;
  shieldUntil: string | null;
  frozenUntil: string | null;
  burnUntil: string | null;
  burnDmgPerTick: number;
  burnLastTickAt: string | null;
  poisonUntil: string | null;
  poisonDmgPerTick: number;
  poisonLastTickAt: string | null;
  rapidFireUntil: string | null;
  damageBoostUntil: string | null;
  damageBoostMultiplier: number;
  joinedAt: string;
};

/** Clave = tiktok uniqueId. Igual patrón que likerTallies/gifterTallies. */
export type LiveOverlayBattleRoster = Record<string, LiveOverlayBattleFighter>;

export type LiveOverlayBattleOutcome = {
  ended: boolean;
  winner: LiveOverlayBattleTeam | null; // null = en curso, o empate/sandbox sin ganador
  teamAHp: number;
  teamBHp: number;
  teamAAlive: number;
  teamBAlive: number;
  teamAKills: number;
  teamBKills: number;
};

/**
 * Calcula si la ronda terminó y quién ganó SIN escribir nada — se deriva de
 * config + roster + hora actual en cada lectura, así no hay carrera por
 * "quién cierra la ronda primero". Es una función pura (sin acceso a DB) para
 * poder usarse tanto en el servidor (store.ts) como en el cliente
 * (BattleArena, Live Desk) sin arrastrar Prisma al bundle del navegador.
 */
export const deriveLiveOverlayBattleOutcome = (
  config: LiveOverlayBattleConfig,
  roster: LiveOverlayBattleRoster,
  now: number = Date.now()
): LiveOverlayBattleOutcome => {
  let teamAHp = 0;
  let teamBHp = 0;
  let teamAAlive = 0;
  let teamBAlive = 0;
  let teamAKills = 0;
  let teamBKills = 0;
  for (const fighter of Object.values(roster)) {
    if (fighter.team === "A") {
      teamAHp += fighter.hp;
      teamAKills += fighter.kills;
      if (fighter.hp > 0) teamAAlive += 1;
    } else {
      teamBHp += fighter.hp;
      teamBKills += fighter.kills;
      if (fighter.hp > 0) teamBAlive += 1;
    }
  }
  const rosterSize = Object.keys(roster).length;

  let ended = !config.active;
  let winner: LiveOverlayBattleTeam | null = null;

  if (config.active) {
    if (config.winMode === "timed" && config.roundEndsAt && now >= Date.parse(config.roundEndsAt)) {
      ended = true;
    } else if (config.winMode === "elimination" && rosterSize > 0) {
      if (teamAAlive === 0 && teamBAlive > 0) {
        ended = true;
        winner = "B";
      } else if (teamBAlive === 0 && teamAAlive > 0) {
        ended = true;
        winner = "A";
      }
    } else if (config.winMode === "firstToKills" && config.killTarget) {
      if (teamAKills >= config.killTarget) {
        ended = true;
        winner = "A";
      } else if (teamBKills >= config.killTarget) {
        ended = true;
        winner = "B";
      }
    }
  }

  if (ended && !winner) {
    if (teamAHp > teamBHp) winner = "A";
    else if (teamBHp > teamAHp) winner = "B";
  }

  return { ended, winner, teamAHp, teamBHp, teamAAlive, teamBAlive, teamAKills, teamBKills };
};

/** Cada cuánto se aplica un "tick" de daño sostenido (burn/poison). */
const BATTLE_DOT_TICK_MS = 1000;

/**
 * Aplica el daño de burn/poison PENDIENTE desde el último tick registrado
 * hasta `now` (o hasta que la duración del efecto expire, lo que pase
 * primero). Es una proyección pura — no persiste nada por sí sola. Se usa en
 * dos lugares (store.ts): de forma NO destructiva al leer el estado (para que
 * la barra de HP se vea viva entre eventos de TikTok), y para "asentar" el
 * daño pendiente antes de aplicar un evento nuevo (join/gift/like), así el
 * daño sostenido nunca se pierde ni se cuenta dos veces.
 */
export const applyPendingBattleDot = (
  roster: LiveOverlayBattleRoster,
  now: number = Date.now()
): LiveOverlayBattleRoster => {
  let changed = false;
  const next: LiveOverlayBattleRoster = {};
  for (const [user, original] of Object.entries(roster)) {
    let fighter = original;
    if (fighter.hp > 0) {
      (["burn", "poison"] as const).forEach((effect) => {
        const untilKey = `${effect}Until` as const;
        const dmgKey = `${effect}DmgPerTick` as const;
        const lastTickKey = `${effect}LastTickAt` as const;
        const until = fighter[untilKey];
        if (!until) return;
        const untilMs = Date.parse(until);
        const start = fighter[lastTickKey] ? Date.parse(fighter[lastTickKey]!) : now;
        const end = Math.min(now, untilMs);
        const ticks = Math.max(0, Math.floor((end - start) / BATTLE_DOT_TICK_MS));
        if (ticks > 0) {
          const dmg = ticks * fighter[dmgKey];
          fighter = {
            ...fighter,
            hp: Math.max(0, fighter.hp - dmg),
            [lastTickKey]: new Date(start + ticks * BATTLE_DOT_TICK_MS).toISOString(),
          };
          changed = true;
        }
        if (untilMs <= now) {
          fighter = { ...fighter, [untilKey]: null, [dmgKey]: 0, [lastTickKey]: null };
          changed = true;
        }
      });
    }
    next[user] = fighter;
  }
  return changed ? next : roster;
};

export type LiveOverlayState = {
  currentCard: LiveOverlayCard | null;
  rarityCounters: LiveOverlayRarityCounters;
  scenes: LiveOverlayScene[];
  bracket: LiveOverlayBracket | null;
  videoClips: LiveOverlayVideoClip[];
  chatFeed: LiveOverlayChatItem[];
  likeCount: number;
  topLikers: LiveOverlayLeaderboardEntry[];
  topGifters: LiveOverlayLeaderboardEntry[];
  viewerCount: number;
  battle: LiveOverlayBattleConfig;
  battleRoster: LiveOverlayBattleRoster;
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
    chatFeed: Array.isArray(s?.chatFeed) ? s!.chatFeed! : [],
    likeCount:
      typeof s?.likeCount === "number" && Number.isFinite(s.likeCount)
        ? s.likeCount
        : 0,
    topLikers: Array.isArray(s?.topLikers) ? s!.topLikers! : [],
    topGifters: Array.isArray(s?.topGifters) ? s!.topGifters! : [],
    viewerCount:
      typeof s?.viewerCount === "number" && Number.isFinite(s.viewerCount)
        ? s.viewerCount
        : 0,
    battle:
      s?.battle && typeof s.battle === "object"
        ? { ...createDefaultBattleConfig(), ...s.battle }
        : createDefaultBattleConfig(),
    battleRoster:
      s?.battleRoster && typeof s.battleRoster === "object"
        ? (s.battleRoster as LiveOverlayBattleRoster)
        : {},
    updatedAt:
      typeof s?.updatedAt === "string"
        ? s!.updatedAt!
        : new Date(0).toISOString(),
  };
};
