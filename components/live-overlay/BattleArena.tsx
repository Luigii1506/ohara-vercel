"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BATTLE_POWER_DISPLAY,
  deriveLiveOverlayBattleOutcome,
  type LiveOverlayBattleConfig,
  type LiveOverlayBattleFighter,
  type LiveOverlayBattlePower,
  type LiveOverlayBattleRoster,
  type LiveOverlayBattleTeam,
} from "@/lib/live-overlay/types";
import {
  ONE_SHOT_EFFECT,
  PERSISTENT_STATUS_EFFECT,
  PersistentAura,
  PowerEffectView,
  PROJECTILE_SPRITE,
  SHIELD_IMAGE,
  type BattleEffectDef,
} from "@/components/live-overlay/BattleEffects";
import { playOverlaySfx } from "@/lib/live-overlay/sfx";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";

/** Sonido por tipo de poder — todo lo que no está acá cae en "hit" (golpe genérico). */
const POWER_SFX: Partial<Record<LiveOverlayBattlePower["kind"], string>> = {
  nuke: "explosion",
  heal: "ding",
  healAll: "ding",
  shield: "pop",
  freeze: "whoosh",
  growMaxHp: "levelup",
  rapidFire: "pop",
  damageBoost: "pop",
};

/**
 * Poderes que pegan a todos los objetivos a la vez (no hay "un" viaje que
 * mostrar) o que no tienen un enemigo del otro lado — se quedan con el burst
 * instantáneo de siempre, sin proyectil. El resto (target único: hit, freeze,
 * burn, knockback, chain) sí lanza proyectil-que-viaja.
 */
const NO_PROJECTILE_KINDS = new Set<LiveOverlayBattlePower["kind"]>([
  "nuke",
  "healAll",
  "heal",
  "shield",
  "growMaxHp",
  "rapidFire",
  "damageBoost",
]);

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

/**
 * Un disparo viajando de un punto a otro — puramente visual, se auto-destruye.
 * Con `spriteDef` anima un sprite temático (bola de fuego, esquirla de hielo,
 * etc); sin él, el punto de color genérico de siempre (kinds sin sprite
 * propio todavía).
 */
function Projectile({
  from,
  to,
  color,
  spriteDef,
  onDone,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  spriteDef?: BattleEffectDef;
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
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: "left 350ms linear, top 350ms linear",
      }}
    >
      {spriteDef ? (
        <PowerEffectView def={spriteDef} loop />
      ) : (
        <div
          className={`h-2.5 w-2.5 rounded-full ${color}`}
          style={{ boxShadow: "0 0 8px 2px currentColor" }}
        />
      )}
    </div>
  );
}

function FighterCircle({
  user,
  fighter,
  now,
  size,
  baseMaxHp,
  home,
  justHealed,
  justPoweredUp,
  knockedBack,
  dying,
  damageFloat,
}: {
  user: string;
  fighter: LiveOverlayBattleFighter;
  now: number;
  size: number;
  baseMaxHp: number;
  home: { x: number; y: number };
  justHealed: boolean;
  justPoweredUp: boolean;
  knockedBack: boolean;
  dying: boolean;
  damageFloat: { amount: number; at: number } | null;
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
      style={{ left: `${home.x}%`, top: `${home.y}%`, animation: "battle-enter 380ms ease-out" }}
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
              {/* Loop persistente mientras dura el status — antes esto era
                  invisible salvo por el anillo de color + emoji fijo, nunca
                  una animación real corriendo (a diferencia de rapidFire/
                  damageBoost, que arriba SÍ ya tenían su aura en loop). */}
              {burnActive && PERSISTENT_STATUS_EFFECT.burn && (
                <PowerEffectView def={PERSISTENT_STATUS_EFFECT.burn} loop />
              )}
              {frozenActive && PERSISTENT_STATUS_EFFECT.freeze && (
                <PowerEffectView def={PERSISTENT_STATUS_EFFECT.freeze} loop />
              )}
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
              {damageFloat && now - damageFloat.at < 900 && (
                <span
                  key={damageFloat.at}
                  className="pointer-events-none absolute -top-1 text-sm font-black text-rose-300"
                  style={{ animation: "battle-float-up 900ms ease-out" }}
                >
                  -{damageFloat.amount}
                </span>
              )}
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
    {
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      color: string;
      spriteDef?: BattleEffectDef;
    }[]
  >([]);
  const spawnProjectile = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    spriteDef?: BattleEffectDef
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setProjectiles((p) => [...p, { id, from, to, color, spriteDef }]);
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
  // Evita tratar a TODOS los que ya estaban peleando como "recién unidos" en
  // el primer render tras montar/refrescar el overlay (prevRosterRef arranca
  // vacío, así que sin esta bandera el primer diff vería a todo el roster
  // existente como nuevo).
  const hasSyncedRosterRef = useRef(false);
  const [healAt, setHealAt] = useState<Record<string, number>>({});
  const [powerUpAt, setPowerUpAt] = useState<Record<string, number>>({});
  const [dyingUntil, setDyingUntil] = useState<Record<string, number>>({});
  const [damageFloatAt, setDamageFloatAt] = useState<Record<string, { amount: number; at: number }>>({});
  useEffect(() => {
    const prev = prevRosterRef.current;
    const isFirstSync = !hasSyncedRosterRef.current;
    const healUpdates: Record<string, number> = {};
    const powerUpUpdates: Record<string, number> = {};
    const deathUpdates: Record<string, number> = {};
    const damageFloatUpdates: Record<string, { amount: number; at: number }> = {};
    for (const [user, fighter] of Object.entries(roster)) {
      const before = prev[user];
      // Recién se une (no en el primer sync tras montar/refrescar — ahí todo
      // el roster existente sonaría como "nuevo" de golpe, todos a la vez).
      if (!before && !isFirstSync) {
        playOverlaySfx("pop");
      }
      if (before && fighter.hp < before.hp) {
        damageFloatUpdates[user] = { amount: Math.round(before.hp - fighter.hp), at: Date.now() };
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
        playOverlaySfx("ko");
        triggerScreenImpact("rgba(239,68,68,0.3)");
      }
    }
    prevRosterRef.current = roster;
    hasSyncedRosterRef.current = true;
    if (Object.keys(damageFloatUpdates).length > 0) {
      setDamageFloatAt((current) => ({ ...current, ...damageFloatUpdates }));
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
    fresh.forEach((e) => {
      seenEventIdsRef.current.add(e.id);
      // Solo poderes disparados por regalo/modo-prueba llegan acá (el
      // auto-ataque de fondo no manda recentEvents a propósito) — así el
      // sonido suena en cada acción real sin volverse ruido a la cadencia de
      // metralleta del auto-ataque.
      playOverlaySfx(POWER_SFX[e.kind] ?? "hit");
      if (e.kind === "nuke") triggerScreenImpact("rgba(251,146,60,0.4)");
    });
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
    //
    // Para poderes de un solo objetivo enemigo (hit/freeze/burn/knockback/
    // chain) el impacto ya NO aparece instantáneo: primero se lanza un
    // proyectil (temático si hay uno, si no el punto genérico de siempre)
    // desde el atacante hacia el objetivo, y el burst de impacto se dispara
    // recién cuando "llega" — pedido explícito del usuario ("tirar una bola
    // de fuego que viaja e impacta"). nuke/healAll pegan a todo el equipo a
    // la vez (no hay "un" viaje que mostrar) y los self-buffs (heal/shield/
    // growMaxHp/rapidFire/damageBoost) tampoco tienen enemigo del otro lado
    // — esos siguen como burst instantáneo.
    const newEffects: { id: string; def: BattleEffectDef; x: number; y: number; tint?: string }[] = [];
    for (const e of fresh) {
      const def = ONE_SHOT_EFFECT[e.kind];
      if (!def) continue;

      const affected = e.targets.length > 0 ? e.targets : [e.user];
      const isSelfOnly = affected.length === 1 && affected[0] === e.user;
      const wantsProjectile = !isSelfOnly && !NO_PROJECTILE_KINDS.has(e.kind);

      affected.forEach((target, i) => {
        const fighter = roster[target];
        if (!fighter) return;
        const targetPos = homePercent(target, fighter.team);
        if (wantsProjectile) {
          const attacker = roster[e.user];
          const fromPos = attacker ? homePercent(e.user, attacker.team) : targetPos;
          spawnProjectile(
            fromPos,
            targetPos,
            e.team === "A" ? "bg-rose-400" : "bg-indigo-400",
            PROJECTILE_SPRITE[e.kind]
          );
          window.setTimeout(() => {
            setPowerEffects((current) => [
              ...current,
              { id: `${e.id}-${i}`, def, ...targetPos },
            ]);
          }, 380);
        } else {
          newEffects.push({ id: `${e.id}-${i}`, def, ...targetPos });
        }
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

  // MVP del cierre de ronda: mayor daño infligido, desempate por kills y
  // luego por antigüedad — se calcula siempre (barato) pero solo se muestra
  // cuando la ronda termina.
  const mvp = useMemo(() => {
    let best: [string, LiveOverlayBattleFighter] | null = null;
    for (const entry of Object.entries(roster)) {
      const [, f] = entry;
      if (
        !best ||
        f.damageDealt > best[1].damageDealt ||
        (f.damageDealt === best[1].damageDealt && f.kills > best[1].kills) ||
        (f.damageDealt === best[1].damageDealt &&
          f.kills === best[1].kills &&
          f.joinedAt < best[1].joinedAt)
      ) {
        best = entry;
      }
    }
    return best;
  }, [roster]);

  // Sonido de arranque — se compara contra el `roundStartedAt` YA conocido al
  // montar (no contra null), así reabrir el overlay a mitad de una ronda ya
  // en curso no dispara el sonido de golpe.
  const roundKeyRef = useRef<string | null>(config.roundStartedAt);
  const endedNotifiedRef = useRef(outcome.ended);
  const [victoryBurstKey, setVictoryBurstKey] = useState<number | null>(null);

  // Impacto a pantalla completa (nuke / muerte) — antes TODO pasaba "adentro
  // del círculo" (un sprite de ~100px sobre el avatar), así que un golpe
  // grande no se leía de un vistazo rápido a la stream.
  const shakeContainerRef = useRef<HTMLDivElement | null>(null);
  const [shakeAt, setShakeAt] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ color: string; at: number } | null>(null);
  const triggerScreenImpact = (color: string) => {
    setShakeAt(Date.now());
    setFlash({ color, at: Date.now() });
  };
  useEffect(() => {
    // Reinicia la animación CSS a mano (en vez de con `key`, que remontaría
    // TODO lo de adentro y perdería el estado de cada FighterCircle) — forzar
    // un reflow entre "none" y el valor real hace que el navegador la
    // reproduzca de nuevo aunque dos shakes lleguen seguidos.
    const el = shakeContainerRef.current;
    if (!el || shakeAt == null) return;
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "battle-screen-shake 320ms ease-out";
  }, [shakeAt]);
  useEffect(() => {
    if (config.roundStartedAt && config.roundStartedAt !== roundKeyRef.current) {
      roundKeyRef.current = config.roundStartedAt;
      endedNotifiedRef.current = false;
      setVictoryBurstKey(null);
      playOverlaySfx("alert");
    }
  }, [config.roundStartedAt]);
  useEffect(() => {
    if (outcome.ended && !endedNotifiedRef.current) {
      endedNotifiedRef.current = true;
      playOverlaySfx("levelup");
      setVictoryBurstKey(Date.now());
      triggerScreenImpact("rgba(250,204,21,0.4)");
    }
  }, [outcome.ended]);

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
        @keyframes battle-enter {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
          70% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes battle-screen-shake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-8px, 4px); }
          40% { transform: translate(7px, -5px); }
          60% { transform: translate(-5px, -3px); }
          80% { transform: translate(4px, 3px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes battle-screen-flash {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
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
        <div ref={shakeContainerRef} className="relative h-full w-full">
          {flash && now - flash.at < 400 && (
            <div
              key={flash.at}
              className="pointer-events-none absolute inset-0 z-[55]"
              style={{ background: flash.color, animation: "battle-screen-flash 350ms ease-out forwards" }}
            />
          )}
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-center gap-4 pt-2">
            {teamHeader("A")}
            {config.winMode === "timed" && config.roundEndsAt && (
              <span className="mt-0.5 rounded bg-black/60 px-2 py-1 text-xs font-mono font-bold text-white">
                {formatCountdown(Date.parse(config.roundEndsAt) - now)}
              </span>
            )}
            {teamHeader("B")}
          </div>

          {/* Leyenda de cómo unirse — sin esto nadie que llega a mitad de
              stream sabe qué comentar para participar. */}
          {!outcome.ended && (
            <div className="absolute inset-x-2 top-11 z-10 flex justify-center">
              <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/90">
                💬 Comenta <b>{config.teamAKeyword}</b> o <b>{config.teamBKeyword}</b> para unirte
              </span>
            </div>
          )}

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
                justHealed={!!healAt[user] && now - healAt[user] < 900}
                justPoweredUp={!!powerUpAt[user] && now - powerUpAt[user] < 900}
                knockedBack={!!knockbackAt[user] && now - knockbackAt[user] < 150}
                dying={fighter.hp <= 0 && !!dyingUntil[user] && now <= dyingUntil[user]}
                damageFloat={damageFloatAt[user] ?? null}
              />
            ))}

            {projectiles.map((p) => (
              <Projectile
                key={p.id}
                from={p.from}
                to={p.to}
                color={p.color}
                spriteDef={p.spriteDef}
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
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60">
              <span className="rounded-lg bg-black/70 px-6 py-3 text-xl font-black uppercase tracking-wide text-white">
                {outcome.winner
                  ? `¡Ganó ${outcome.winner === "A" ? config.teamAName : config.teamBName}!`
                  : "Empate"}
              </span>
              {mvp && mvp[1].damageDealt > 0 && (
                <span className="rounded-full bg-amber-400/90 px-4 py-1.5 text-sm font-bold text-black">
                  🏆 MVP: {mvp[1].displayName || mvp[0]} ({Math.round(mvp[1].damageDealt)} dmg)
                </span>
              )}
            </div>
          )}
          {victoryBurstKey !== null && (
            <ConfettiLayer key={victoryBurstKey} onDone={() => setVictoryBurstKey(null)} />
          )}
        </div>
      )}
    </div>
  );
}
