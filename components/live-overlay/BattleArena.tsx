"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BATTLE_POWER_DISPLAY,
  deriveLiveOverlayBattleOutcome,
  type LiveOverlayBattleConfig,
  type LiveOverlayBattleFighter,
  type LiveOverlayBattleRoster,
  type LiveOverlayBattleTeam,
} from "@/lib/live-overlay/types";
import {
  EXPLOSION_TINT,
  ONE_SHOT_EFFECT,
  PersistentAura,
  PowerEffectView,
  SHIELD_IMAGE,
  type BattleEffectDef,
} from "@/components/live-overlay/BattleEffects";

const POISON_TINT = "hue-rotate(100deg) saturate(3.5) brightness(0.95)";
const RAPID_FIRE_TINT = "sepia(1) saturate(6) hue-rotate(35deg) brightness(1.3)";
const DAMAGE_BOOST_TINT = "sepia(1) saturate(8) hue-rotate(-50deg) brightness(1.05)";

type BattleArenaProps = {
  config: LiveOverlayBattleConfig;
  roster: LiveOverlayBattleRoster;
  variant: "embedded" | "dedicated";
};

/** Hash simple y estable para posiciones/animaciones desincronizadas por usuario. */
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const opposingTeamOf = (team: LiveOverlayBattleTeam): LiveOverlayBattleTeam =>
  team === "A" ? "B" : "A";

/** Cuánto dura la animación de "muere y desaparece" antes de quitar del todo el círculo. */
const DEATH_FADE_MS = 650;

/**
 * Posición "hogar" de un círculo, en porcentaje de TODA la arena (no de su
 * mitad) — así ataques/proyectiles entre equipos comparten un solo sistema de
 * coordenadas. Determinística por username, para que cualquier cliente que
 * renderiza llegue a la misma posición sin sincronizar nada por el backend.
 */
const homePercent = (user: string, team: LiveOverlayBattleTeam): { x: number; y: number } => {
  const rangeStart = team === "A" ? 8 : 58;
  const x = rangeStart + (hashString(`${user}_x`) % 34);
  const y = 20 + (hashString(`${user}_y`) % 60);
  return { x, y };
};

const formatCountdown = (ms: number): string => {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};

function HitFlash() {
  const [frame, setFrame] = useState(1);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((f) => (f >= 4 ? 4 : f + 1));
    }, 60);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <img
      src={`/live-overlay/sprites/hit-effect/flash-0${frame}.png`}
      alt=""
      className="pointer-events-none absolute inset-0 m-auto h-[140%] w-[140%] object-contain opacity-90"
    />
  );
}

/** Un disparo viajando de un punto a otro — puramente visual, se auto-destruye. */
function Projectile({
  from,
  to,
  color,
  onDone,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  onDone: () => void;
}) {
  const [pos, setPos] = useState(from);
  useEffect(() => {
    // Un frame después de montar, movemos el punto al destino — la
    // transition de CSS hace el resto. Cada Projectile es una instancia
    // fresca (key única por evento), así que corre exactamente una vez.
    const raf = requestAnimationFrame(() => setPos(to));
    const timeout = window.setTimeout(onDone, 380);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: "left 350ms linear, top 350ms linear",
        boxShadow: "0 0 8px 2px currentColor",
      }}
    />
  );
}

function FighterCircle({
  user,
  fighter,
  now,
  size,
  baseMaxHp,
  home,
  justHit,
  justHealed,
  justPoweredUp,
  knockedBack,
  dying,
}: {
  user: string;
  fighter: LiveOverlayBattleFighter;
  now: number;
  size: number;
  baseMaxHp: number;
  home: { x: number; y: number };
  justHit: boolean;
  justHealed: boolean;
  justPoweredUp: boolean;
  knockedBack: boolean;
  dying: boolean;
}) {
  const alive = fighter.hp > 0;
  // El radio se calcula contra el HP BASE de la ronda (config.maxHp), no
  // contra fighter.maxHp — así un power-up "growMaxHp" (que sube fighter.maxHp
  // por encima del base) realmente agranda el círculo más allá de su tamaño
  // inicial, en vez de solo mover el ratio hp/maxHp que se queda en 1.0.
  const hpRatio = Math.max(0, Math.min(4, fighter.hp / baseMaxHp));
  const diameter = Math.max(size * 0.5, size * Math.sqrt(hpRatio || 0.02));
  const shieldActive = fighter.shieldHp > 0 && !!fighter.shieldUntil && Date.parse(fighter.shieldUntil) > now;
  const frozenActive = !!fighter.frozenUntil && Date.parse(fighter.frozenUntil) > now;
  const poisonActive = !!fighter.poisonUntil && Date.parse(fighter.poisonUntil) > now;
  const burnActive = !!fighter.burnUntil && Date.parse(fighter.burnUntil) > now;
  const rapidFireActive = !!fighter.rapidFireUntil && Date.parse(fighter.rapidFireUntil) > now;
  const damageBoostActive = !!fighter.damageBoostUntil && Date.parse(fighter.damageBoostUntil) > now;

  // Un solo "estado dominante" decide TANTO el color del anillo COMO el
  // ícono permanente — antes solo quemar/envenenar tenían ícono; escudo (y
  // cualquier otro estado con duración) ahora también, para que se note sin
  // tener que fijarse en el color del anillo.
  const statusBadge = shieldActive
    ? { ring: "ring-amber-300", emoji: "🛡️" }
    : frozenActive
      ? { ring: "ring-sky-300", emoji: "❄️" }
      : poisonActive
        ? { ring: "ring-purple-400", emoji: "☠️" }
        : burnActive
          ? { ring: "ring-orange-500", emoji: "🔥" }
          : damageBoostActive
            ? { ring: "ring-red-500", emoji: "💪" }
            : rapidFireActive
              ? { ring: "ring-lime-300", emoji: "🌀" }
              : null;
  const ringClass = statusBadge?.ring ?? (fighter.team === "A" ? "ring-rose-400" : "ring-indigo-400");

  const wanderVariant = 1 + (hashString(user) % 4);
  const wanderDuration = 5.5 + (hashString(`${user}_d`) % 30) / 10;
  const wanderDelay = -(hashString(`${user}_t`) % Math.round(wanderDuration * 1000));
  // Empuje: hacia AFUERA del centro (más adentro de su propia mitad), lejos
  // de quien lo atacó. Se hace en un wrapper aparte del que anima el
  // deambular, así los dos transforms se SUMAN en vez de pisarse entre sí.
  const knockDir = fighter.team === "A" ? -1 : 1;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${home.x}%`, top: `${home.y}%` }}
    >
      <div
        style={{
          transform: knockedBack ? `translateX(${knockDir * 34}px)` : "translateX(0px)",
          transition: knockedBack ? "transform 120ms ease-out" : "transform 320ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div
          className={`battle-wander-${wanderVariant}`}
          style={{
            animationDuration: `${wanderDuration}s`,
            animationDelay: `${wanderDelay}ms`,
            // Congelado de verdad deja de moverse — antes el anillo cambiaba
            // de color pero el personaje seguía deambulando igual, confirmado
            // confuso al probar en vivo.
            animationPlayState: frozenActive ? "paused" : "running",
          }}
        >
          <div
            className="relative flex flex-col items-center gap-1"
            style={{
              opacity: dying ? 0 : 1,
              transform: dying ? "scale(0.15)" : "scale(1)",
              transition: `opacity ${DEATH_FADE_MS}ms ease, transform ${DEATH_FADE_MS}ms ease`,
            }}
          >
            <div className="relative flex items-center justify-center">
              {rapidFireActive && <PersistentAura style={1} tint={RAPID_FIRE_TINT} size={diameter * 1.7} />}
              {damageBoostActive && <PersistentAura style={2} tint={DAMAGE_BOOST_TINT} size={diameter * 1.7} />}
              {shieldActive && (
                <img
                  src={SHIELD_IMAGE}
                  alt=""
                  className="battle-shield-pulse pointer-events-none absolute inset-0 m-auto h-[150%] w-[150%] object-contain"
                />
              )}
              {justHealed && (
                <span
                  className="pointer-events-none absolute inset-0 m-auto animate-ping rounded-full border-4 border-emerald-400"
                  style={{ width: diameter, height: diameter }}
                />
              )}
              {justPoweredUp && (
                <span
                  className="pointer-events-none absolute inset-0 m-auto animate-ping rounded-full border-4 border-yellow-300"
                  style={{ width: diameter * 1.15, height: diameter * 1.15 }}
                />
              )}
              <div
                className={`overflow-hidden rounded-full ring-4 ${ringClass} ${alive ? "" : "grayscale"} ${
                  frozenActive ? "brightness-125 saturate-[0.4]" : ""
                }`}
                style={{ width: diameter, height: diameter, transition: "width 300ms ease, height 300ms ease" }}
              >
                {fighter.avatar ? (
                  <img src={fighter.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-black/60" />
                )}
              </div>
              {justHit && <HitFlash />}
              {justHealed && (
                <span className="pointer-events-none absolute -top-1 text-lg" style={{ animation: "battle-float-up 900ms ease-out" }}>
                  💚
                </span>
              )}
              {justPoweredUp && (
                <span className="pointer-events-none absolute -top-1 text-lg" style={{ animation: "battle-float-up 900ms ease-out" }}>
                  ⭐
                </span>
              )}
              {statusBadge && (
                <span className="pointer-events-none absolute -right-1 -top-1 text-sm">{statusBadge.emoji}</span>
              )}
            </div>
            <div className="h-1 w-14 overflow-hidden rounded-full bg-black/60">
              <div
                className={fighter.team === "A" ? "h-full bg-rose-400" : "h-full bg-indigo-400"}
                style={{
                  width: `${Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100))}%`,
                  transition: "width 300ms ease",
                }}
              />
            </div>
            <span className="max-w-[6.5rem] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {fighter.displayName || user} · {fighter.hp}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BattleArena({ config, roster, variant }: BattleArenaProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // 100ms (no 500ms): efectos cortos como el empujón (150ms) necesitan que
    // este reloj compartido pase por dentro de su ventana al menos una vez —
    // con un tick de 500ms un efecto de 150ms podía caer justo entre dos
    // ticks y nunca llegar a pintarse.
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  const [projectiles, setProjectiles] = useState<
    { id: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string }[]
  >([]);
  const spawnProjectile = (from: { x: number; y: number }, to: { x: number; y: number }, color: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setProjectiles((p) => [...p, { id, from, to, color }]);
  };
  const removeProjectile = (id: string) =>
    setProjectiles((p) => p.filter((proj) => proj.id !== id));

  // Detecta golpes reales (HP bajó desde la última lectura) para el flash de
  // impacto y para lanzar un proyectil desde un enemigo vivo al azar; muertes
  // (HP cruzó de >0 a 0) para la animación de desaparición; curaciones (HP
  // subió) para el pulso verde; y power-ups de HP (maxHp subió) para el
  // pulso dorado — antes estos dos últimos eran invisibles (solo cambiaba un
  // número), confirmado confuso al probar en vivo.
  const prevRosterRef = useRef<LiveOverlayBattleRoster>({});
  const [hitAt, setHitAt] = useState<Record<string, number>>({});
  const [healAt, setHealAt] = useState<Record<string, number>>({});
  const [powerUpAt, setPowerUpAt] = useState<Record<string, number>>({});
  const [dyingUntil, setDyingUntil] = useState<Record<string, number>>({});
  useEffect(() => {
    const prev = prevRosterRef.current;
    const hitUpdates: Record<string, number> = {};
    const healUpdates: Record<string, number> = {};
    const powerUpUpdates: Record<string, number> = {};
    const deathUpdates: Record<string, number> = {};
    for (const [user, fighter] of Object.entries(roster)) {
      const before = prev[user];
      if (before && fighter.hp < before.hp) {
        hitUpdates[user] = Date.now();
        const attackTeam = opposingTeamOf(fighter.team);
        const attackers = Object.entries(roster).filter(([, f]) => f.team === attackTeam && f.hp > 0);
        const [attackerUser] =
          attackers[Math.floor(Math.random() * attackers.length)] ?? [user];
        spawnProjectile(
          homePercent(attackerUser, attackTeam),
          homePercent(user, fighter.team),
          attackTeam === "A" ? "bg-rose-400" : "bg-indigo-400"
        );
      }
      if (before && fighter.maxHp > before.maxHp) {
        powerUpUpdates[user] = Date.now();
      } else if (before && fighter.hp > before.hp) {
        healUpdates[user] = Date.now();
      }
      if (before && before.hp > 0 && fighter.hp <= 0) {
        deathUpdates[user] = Date.now() + DEATH_FADE_MS;
      }
    }
    prevRosterRef.current = roster;
    if (Object.keys(hitUpdates).length > 0) {
      setHitAt((current) => ({ ...current, ...hitUpdates }));
    }
    if (Object.keys(healUpdates).length > 0) {
      setHealAt((current) => ({ ...current, ...healUpdates }));
    }
    if (Object.keys(powerUpUpdates).length > 0) {
      setPowerUpAt((current) => ({ ...current, ...powerUpUpdates }));
    }
    if (Object.keys(deathUpdates).length > 0) {
      setDyingUntil((current) => ({ ...current, ...deathUpdates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  // Letrero "qué pasó": traduce config.recentEvents (regalo → poder) a
  // toasts de texto que aparecen un momento y se desvanecen — sin esto, un
  // golpe/curación/veneno/etc. se ven todos igual (solo la barra de HP
  // cambiando), confirmado confuso al probar en vivo.
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: string; text: string; team: LiveOverlayBattleTeam }[]>([]);
  const [knockbackAt, setKnockbackAt] = useState<Record<string, number>>({});
  // Animación específica por tipo de poder (fuego para quemar, hielo para
  // congelar, explosión para la bomba, etc.) — antes TODO usaba el mismo
  // flash genérico, confirmado confuso ("todo se ve igual de animado").
  const [powerEffects, setPowerEffects] = useState<
    { id: string; def: BattleEffectDef; x: number; y: number; tint?: string }[]
  >([]);
  const removePowerEffect = (id: string) =>
    setPowerEffects((current) => current.filter((e) => e.id !== id));
  useEffect(() => {
    const fresh = config.recentEvents.filter((e) => !seenEventIdsRef.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenEventIdsRef.current.add(e.id));
    const newToasts = fresh.map((e) => {
      const display = BATTLE_POWER_DISPLAY[e.kind];
      const targetsLabel = e.targets.length > 0 ? ` → ${e.targets.join(", ")}` : "";
      return { id: e.id, text: `${display.emoji} ${e.user} usó ${display.label}${targetsLabel}`, team: e.team };
    });
    setToasts((current) => [...current, ...newToasts].slice(-4));
    newToasts.forEach((t) => {
      window.setTimeout(() => {
        setToasts((current) => current.filter((c) => c.id !== t.id));
      }, 3200);
    });
    // El evento SÍ dice qué tipo de poder fue (a diferencia de solo mirar si
    // el HP bajó) — así "empujón" puede disparar su propia animación de
    // sacudida en vez de verse exactamente igual que un golpe normal.
    const knockUpdates: Record<string, number> = {};
    for (const e of fresh) {
      if (e.kind === "knockback") {
        for (const target of e.targets) knockUpdates[target] = Date.now();
      }
    }
    if (Object.keys(knockUpdates).length > 0) {
      setKnockbackAt((current) => ({ ...current, ...knockUpdates }));
    }
    // Animación específica del poder, una por cada objetivo afectado (o sobre
    // quien lo usó, para curarse/escudo/power-ups que no tienen "targets"
    // enemigos). growMaxHp/shield ya tienen su propio pulso/ícono aparte —
    // aquí solo se listan los que tienen un asset de un solo uso.
    const newEffects: { id: string; def: BattleEffectDef; x: number; y: number; tint?: string }[] = [];
    for (const e of fresh) {
      const def = ONE_SHOT_EFFECT[e.kind];
      if (!def) continue;
      const tint = e.kind === "poison" ? POISON_TINT : e.kind === "nuke" ? EXPLOSION_TINT : undefined;
      const affected = e.targets.length > 0 ? e.targets : [e.user];
      affected.forEach((target, i) => {
        const fighter = roster[target];
        if (!fighter) return;
        newEffects.push({
          id: `${e.id}-${i}`,
          def,
          ...homePercent(target, fighter.team),
          tint,
        });
      });
    }
    if (newEffects.length > 0) {
      setPowerEffects((current) => [...current, ...newEffects]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.recentEvents]);

  const outcome = useMemo(() => deriveLiveOverlayBattleOutcome(config, roster, now), [config, roster, now]);

  // Los caídos "mueren y desaparecen": se ven un instante (grises, encogiendo)
  // y luego se quitan de la arena por completo — un fighter recién unido
  // puede seguir ocupando el lugar de su equipo aunque otro haya caído antes.
  const fighterEntries = useMemo(
    () =>
      Object.entries(roster).filter(([user, fighter]) => {
        if (fighter.hp > 0) return true;
        const until = dyingUntil[user];
        return !!until && now <= until;
      }),
    [roster, dyingUntil, now]
  );

  const started = !!config.roundStartedAt;
  const circleSize = variant === "embedded" ? 64 : 96;

  const teamHeader = (team: LiveOverlayBattleTeam) => {
    const name = team === "A" ? config.teamAName : config.teamBName;
    const hp = team === "A" ? outcome.teamAHp : outcome.teamBHp;
    const kills = team === "A" ? outcome.teamAKills : outcome.teamBKills;
    const accent = team === "A" ? "text-rose-300" : "text-indigo-300";
    return (
      <div className="flex flex-col items-center gap-0.5 px-2 text-center">
        <span className={`text-sm font-bold uppercase tracking-wide ${accent}`}>{name}</span>
        <span className="text-xs font-semibold text-white/80">❤️ {hp}</span>
        {config.winMode === "firstToKills" && (
          <span className="text-[10px] text-white/60">
            {kills}/{config.killTarget ?? 0} kills
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={
        variant === "dedicated" && config.backgroundUrl
          ? {
              backgroundImage: `url(${config.backgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <style>{`
        @keyframes battle-wander-1 {
          0%, 100% { transform: translate(0px, 0px); }
          25% { transform: translate(52px, -38px); }
          50% { transform: translate(-34px, 26px); }
          75% { transform: translate(32px, 44px); }
        }
        @keyframes battle-wander-2 {
          0%, 100% { transform: translate(0px, 0px); }
          30% { transform: translate(-56px, -26px); }
          60% { transform: translate(38px, -50px); }
          85% { transform: translate(-26px, 32px); }
        }
        @keyframes battle-wander-3 {
          0%, 100% { transform: translate(0px, 0px); }
          20% { transform: translate(32px, 38px); }
          55% { transform: translate(-50px, -20px); }
          80% { transform: translate(20px, -44px); }
        }
        @keyframes battle-wander-4 {
          0%, 100% { transform: translate(0px, 0px); }
          35% { transform: translate(-38px, 44px); }
          65% { transform: translate(56px, 12px); }
          90% { transform: translate(-20px, -38px); }
        }
        .battle-wander-1 { animation-name: battle-wander-1; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .battle-wander-2 { animation-name: battle-wander-2; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .battle-wander-3 { animation-name: battle-wander-3; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .battle-wander-4 { animation-name: battle-wander-4; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes battle-float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-28px); }
        }
        @keyframes battle-shield-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        .battle-shield-pulse { animation: battle-shield-pulse 1.6s ease-in-out infinite; }
        @keyframes battle-fx-static-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
        }
        .battle-fx-static-burst { animation: battle-fx-static-burst 500ms ease-out; }
      `}</style>

      {!started ? (
        <div className="flex h-full w-full items-center justify-center">
          <span className="rounded bg-black/50 px-4 py-2 text-sm font-semibold text-white/70">
            Esperando batalla…
          </span>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-center gap-4 pt-2">
            {teamHeader("A")}
            {config.winMode === "timed" && config.roundEndsAt && (
              <span className="mt-0.5 rounded bg-black/60 px-2 py-1 text-xs font-mono font-bold text-white">
                {formatCountdown(Date.parse(config.roundEndsAt) - now)}
              </span>
            )}
            {teamHeader("B")}
          </div>

          {/* Letrero "qué pasó" — para que quede claro qué acción se probó/disparó. */}
          <div className="absolute inset-x-2 top-16 z-30 flex flex-col items-center gap-1">
            {toasts.map((t) => (
              <span
                key={t.id}
                className={`max-w-full truncate rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg ${
                  t.team === "A" ? "bg-rose-600/90" : "bg-indigo-600/90"
                }`}
              >
                {t.text}
              </span>
            ))}
          </div>

          <div className="absolute inset-0 top-12">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />

            {fighterEntries.map(([user, fighter]) => (
              <FighterCircle
                key={user}
                user={user}
                fighter={fighter}
                now={now}
                size={circleSize}
                baseMaxHp={config.maxHp}
                home={homePercent(user, fighter.team)}
                justHit={!!hitAt[user] && now - hitAt[user] < 400}
                justHealed={!!healAt[user] && now - healAt[user] < 900}
                justPoweredUp={!!powerUpAt[user] && now - powerUpAt[user] < 900}
                knockedBack={!!knockbackAt[user] && now - knockbackAt[user] < 150}
                dying={fighter.hp <= 0 && !!dyingUntil[user] && now <= dyingUntil[user]}
              />
            ))}

            {projectiles.map((p) => (
              <Projectile
                key={p.id}
                from={p.from}
                to={p.to}
                color={p.color}
                onDone={() => removeProjectile(p.id)}
              />
            ))}

            {powerEffects.map((e) => (
              <div
                key={e.id}
                className="pointer-events-none absolute z-40"
                style={{ left: `${e.x}%`, top: `${e.y}%` }}
              >
                <PowerEffectView def={e.def} tint={e.tint} onDone={() => removePowerEffect(e.id)} />
              </div>
            ))}
          </div>

          {outcome.ended && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
              <span className="rounded-lg bg-black/70 px-6 py-3 text-xl font-black uppercase tracking-wide text-white">
                {outcome.winner
                  ? `¡Ganó ${outcome.winner === "A" ? config.teamAName : config.teamBName}!`
                  : "Empate"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
