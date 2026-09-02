"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  normalizeLiveOverlayState,
  type LiveOverlayScene,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";
import FxLayer, { type FxVariant } from "@/components/live-overlay/scenes/FxLayer";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import { playOverlaySfx, ensureOverlayAudio } from "@/lib/live-overlay/sfx";
import BracketView from "@/components/live-overlay/BracketView";

type OverlayCanvasClientProps = {
  token: string;
};

// Fighter de la variante "brawl" de la batalla de gifters: cuerpo de mono en
// CSS puro (sin assets) con el avatar del usuario como cabeza. El challenger
// es el mismo dibujo espejeado (scale-x en un wrapper aparte, no en el que
// anima posición/rotación, para que ambos transforms no se pisen).
function BrawlFighter({
  role,
  user,
  avatar,
}: {
  role: "champion" | "challenger";
  user: string;
  avatar: string;
}) {
  const isChampion = role === "champion";
  const bodyColor = isChampion ? "bg-amber-700" : "bg-slate-400";
  const headBorder = isChampion ? "border-amber-300" : "border-white/50";
  const nameColor = isChampion ? "text-amber-300" : "text-white/70";
  // Nota: el nombre del keyframe va como STRING LITERAL completo en cada rama
  // del ternario (no interpolado) porque Tailwind detecta las clases con
  // [animation:...] escaneando el texto fuente tal cual — si se arma con una
  // variable JS, nunca encuentra la clase completa y no genera el CSS.
  const bodyAnimationClass = isChampion
    ? "[animation:overlay-brawl-champion-body_3s_ease-out_forwards]"
    : "[animation:overlay-brawl-challenger-body_3s_ease-out_forwards]";

  return (
    <div className={`flex flex-col items-center gap-1 ${bodyAnimationClass}`}>
      <div className={`relative h-28 w-20 ${isChampion ? "" : "scale-x-[-1]"}`}>
        <div className={`absolute left-0 top-2 h-5 w-5 rounded-full ${bodyColor}`} />
        <div className={`absolute right-0 top-2 h-5 w-5 rounded-full ${bodyColor}`} />
        <div
          className={`absolute -bottom-1 left-1/2 h-8 w-2 origin-top -translate-x-1/2 rotate-45 rounded-full ${bodyColor}`}
        />
        <div className={`absolute left-2 top-[70px] h-6 w-3 rounded-full ${bodyColor}`} />
        <div className={`absolute right-2 top-[70px] h-6 w-3 rounded-full ${bodyColor}`} />
        <div
          className={`absolute left-[-2px] top-11 h-3 w-7 origin-right rounded-full ${bodyColor}`}
        />
        <div
          className={`absolute left-1/2 top-9 h-10 w-9 -translate-x-1/2 rounded-2xl ${bodyColor}`}
        />
        <div
          className={`absolute right-[-6px] top-11 h-3 w-8 origin-left rounded-full ${bodyColor} ${
            isChampion
              ? "[animation:overlay-brawl-champion-arm_3s_ease-out_forwards]"
              : "rotate-[10deg]"
          }`}
        />
        <div
          className={`absolute left-1/2 top-0 h-11 w-11 -translate-x-1/2 overflow-hidden rounded-full border-4 ${headBorder} shadow-[0_6px_16px_rgba(0,0,0,0.5)] ${
            isChampion ? "" : "grayscale"
          }`}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-black/60" />
          )}
        </div>
        {!isChampion ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg leading-none [animation:overlay-brawl-stars_3s_ease-out_forwards]">
            💫
          </span>
        ) : null}
      </div>
      <span
        className={`max-w-[110px] truncate rounded-full bg-black/85 px-3 py-0.5 text-xs font-black ${nameColor}`}
      >
        {user}
      </span>
    </div>
  );
}

// Fighter de la variante "doodle": boceto simple (cabeza + cuerpo de líneas,
// cara que cambia de neutral a golpeado) inspirado en los overlays de
// batalla PK de TikTok LIVE (referencia: @zhe.77/video/7674405520719154452).
// A diferencia de esa referencia NO tiene fondo de arena propio — el widget
// se queda chico y transparente para no tapar la cámara del streamer.
function DoodleFighter({
  role,
  user,
  diamonds,
  maxDiamonds,
}: {
  role: "champion" | "challenger";
  user: string;
  diamonds: number;
  maxDiamonds: number;
}) {
  const isChampion = role === "champion";
  const accent = isChampion ? "#fbbf24" : "#cbd5e1"; // amber-400 / slate-300
  const nameColor = isChampion ? "text-amber-300" : "text-white/80";
  const barPct = Math.max(
    6,
    Math.min(100, Math.round((diamonds / Math.max(maxDiamonds, 1)) * 100))
  );
  // Mismo timeline de posición/rotación que la variante "brawl" — solo
  // cambia el dibujo de adentro, no la coreografía de entrada/choque/KO.
  const bodyAnimationClass = isChampion
    ? "[animation:overlay-brawl-champion-body_3s_ease-out_forwards]"
    : "[animation:overlay-brawl-challenger-body_3s_ease-out_forwards]";

  return (
    <div className={`flex flex-col items-center gap-1 ${bodyAnimationClass}`}>
      <span className="h-[18px] text-lg leading-none">{isChampion ? "👑" : ""}</span>
      <div className={isChampion ? "" : "scale-x-[-1]"}>
        <svg width="64" height="100" viewBox="0 0 80 130" style={{ overflow: "visible" }}>
          <line x1="40" y1="38" x2="40" y2="80" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          <line x1="40" y1="80" x2="26" y2="112" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          <line x1="40" y1="80" x2="54" y2="112" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          <line x1="40" y1="46" x2="20" y2="64" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          <g
            style={{ transformOrigin: "40px 46px" }}
            className={isChampion ? "[animation:overlay-doodle-arm_3s_ease-out_forwards]" : undefined}
          >
            <line x1="40" y1="46" x2="62" y2="60" stroke={accent} strokeWidth="4" strokeLinecap="round" />
            <line x1="62" y1="60" x2="76" y2="42" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="40" cy="22" r="17" fill="rgba(0,0,0,0.55)" stroke={accent} strokeWidth="4" />
          <g
            className={
              isChampion ? undefined : "[animation:overlay-doodle-face-neutral-out_3s_ease-out_forwards]"
            }
          >
            <circle cx="34" cy="20" r="2" fill="white" />
            <circle cx="46" cy="20" r="2" fill="white" />
            <path d="M 33 28 Q 40 31 47 28" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
          {!isChampion ? (
            <g
              style={{ opacity: 0 }}
              className="[animation:overlay-doodle-face-hit-in_3s_ease-out_forwards]"
            >
              <path d="M 31 17 L 37 23 M 37 17 L 31 23" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M 43 17 L 49 23 M 49 17 L 43 23" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M 33 29 Q 40 24 47 29" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          ) : null}
        </svg>
      </div>
      <div className="flex w-16 flex-col items-center gap-0.5">
        <span
          className={`max-w-[90px] truncate rounded-full bg-black/85 px-2 py-0.5 text-[10px] font-black ${nameColor}`}
        >
          {user}
        </span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/60">
          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: accent }} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Fighter de la variante "sprite": arte real en vez de dibujado a mano.
// Pack "Animated Stick Figure Character 2D" de RGS_Dev (CC0, sin atribución
// necesaria) — ver public/live-overlay/sprites/LICENSE.txt. Frames sueltos
// (PNG) reproducidos por JS a un FPS fijo, sin sprite sheet ni CSS steps().
// ===========================================================================
type StickSpriteVariant = "sword" | "fighter";
type StickSpriteClip = "idle" | "attack" | "hit" | "death";

const STICK_SPRITE_FRAME_COUNTS: Record<StickSpriteVariant, Partial<Record<StickSpriteClip, number>>> = {
  sword: { idle: 8, attack: 11 },
  fighter: { idle: 8, hit: 4, death: 10 },
};

// Tamaño real (px) de cada frame YA RECORTADO (el pack original tiene mucho
// padding transparente en un lienzo de 512x512 — se recortó por lote antes
// de subirlo a public/). Se escala un multiplicador fijo en vez de forzar
// todos los clips a una misma caja: "attack" es un lienzo más ancho que
// "idle" porque el personaje se estira al atacar, así que si se metieran
// ambos en el mismo cuadro el personaje se vería más chico durante el golpe.
const STICK_SPRITE_NATURAL_SIZE: Record<StickSpriteVariant, Partial<Record<StickSpriteClip, { w: number; h: number }>>> = {
  sword: { idle: { w: 180, h: 180 }, attack: { w: 340, h: 235 } },
  fighter: {
    idle: { w: 215, h: 265 },
    hit: { w: 215, h: 265 },
    death: { w: 215, h: 265 },
  },
};
const STICK_SPRITE_SCALE = 0.55;

function stickSpriteSrc(variant: StickSpriteVariant, clip: StickSpriteClip, frameIndex: number): string {
  const n = String(frameIndex + 1).padStart(2, "0");
  return `/live-overlay/sprites/${variant}/${clip}-${n}.png`;
}

// Recorre los frames de UN clip a un FPS fijo. Si `loop` es false se congela
// en el último frame (ej. death) en vez de reiniciar. `resetKey` fuerza
// volver al frame 0 cuando cambia (ej. al pasar de "idle" a "attack").
function useSpriteFrameIndex(frameCount: number, fps: number, loop: boolean, resetKey: string): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    const interval = window.setInterval(() => {
      setFrame((f) => {
        const next = f + 1;
        if (next >= frameCount) return loop ? 0 : frameCount - 1;
        return next;
      });
    }, 1000 / fps);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount, fps, loop, resetKey]);
  return frame;
}

function StickSpriteFighter({
  role,
  user,
  diamonds,
  maxDiamonds,
  clip,
}: {
  role: "champion" | "challenger";
  user: string;
  diamonds: number;
  maxDiamonds: number;
  clip: StickSpriteClip;
}) {
  const isChampion = role === "champion";
  const variant: StickSpriteVariant = isChampion ? "sword" : "fighter";
  const accent = isChampion ? "#fbbf24" : "#cbd5e1"; // amber-400 / slate-300
  const nameColor = isChampion ? "text-amber-300" : "text-white/80";
  const barPct = Math.max(
    6,
    Math.min(100, Math.round((diamonds / Math.max(maxDiamonds, 1)) * 100))
  );
  const frameCount = STICK_SPRITE_FRAME_COUNTS[variant][clip] ?? 1;
  const loop = clip === "idle";
  const fps = loop ? 8 : 16;
  // Al cambiar de clip (ej. attack de 11 frames → idle de 8), el render de
  // transición puede llegar ANTES de que el efecto del hook reinicie el
  // frame a 0 — sin este clamp se pide un archivo que no existe (404, ej.
  // "idle-11.png") por un frame.
  const rawFrame = useSpriteFrameIndex(frameCount, fps, loop, clip);
  const frame = Math.min(rawFrame, frameCount - 1);
  const size = STICK_SPRITE_NATURAL_SIZE[variant][clip] ?? { w: 180, h: 180 };

  return (
    <div className="flex flex-col items-center gap-1 [animation:overlay-sprite-fighter-in_3s_ease-out_forwards]">
      <span className="h-[18px] text-lg leading-none">{isChampion ? "👑" : ""}</span>
      {/* El clip "attack" tiene dos señales de dirección que NO coinciden en
          el arte original: la mirada (un solo ojo visible durante el swing)
          apunta a la derecha, pero el streak de movimiento de la espada se
          extiende a la izquierda. Lo que el ojo humano nota más es hacia
          dónde MIRA el personaje, no el streak — confirmado en producción:
          tanto "campeón izquierda + espejeado" como "campeón derecha + sin
          espejear" hacían que la mirada apuntara LEJOS del retador y se
          reportó como "al revés" las dos veces, aunque en ambos casos la
          espada sí llegaba bien. Por eso el campeón va a la DERECHA y SÍ se
          espejea: así la mirada (espejeada, ahora hacia la izquierda) cae
          sobre el retador aunque el streak quede técnicamente invertido. */}
      <img
        src={stickSpriteSrc(variant, clip, frame)}
        alt=""
        style={{ width: size.w * STICK_SPRITE_SCALE, height: size.h * STICK_SPRITE_SCALE }}
        className={`object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)] ${isChampion ? "scale-x-[-1]" : ""}`}
      />
      <div className="flex w-16 flex-col items-center gap-0.5">
        <span
          className={`max-w-[90px] truncate rounded-full bg-black/85 px-2 py-0.5 text-[10px] font-black ${nameColor}`}
        >
          {user}
        </span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/60">
          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: accent }} />
        </div>
      </div>
    </div>
  );
}

// Destello de impacto (4 frames, no-loop) del mismo pack, para el momento
// del choque de la variante "sprite". `resetKey` se pasa desde afuera para
// reiniciar el frame cada vez que aparece (una key nueva por ronda).
function HitFlashSprite({ resetKey }: { resetKey: string }) {
  const frame = useSpriteFrameIndex(4, 16, false, resetKey);
  const n = String(frame + 1).padStart(2, "0");
  return (
    <img
      src={`/live-overlay/sprites/hit-effect/flash-${n}.png`}
      alt=""
      className="pointer-events-none absolute h-32 w-auto object-contain"
    />
  );
}

const EMPTY_STATE: LiveOverlayState = {
  currentCard: null,
  rarityCounters: LIVE_OVERLAY_RARITY_COUNTER_KEYS.reduce(
    (accumulator, key) => {
      accumulator[key] = 0;
      return accumulator;
    },
    {} as LiveOverlayState["rarityCounters"]
  ),
  scenes: [],
  bracket: null,
  videoClips: [],
  chatFeed: [],
  likeCount: 0,
  topLikers: [],
  topGifters: [],
  viewerCount: 0,
  updatedAt: new Date(0).toISOString(),
};

export default function OverlayCanvasClient({ token }: OverlayCanvasClientProps) {
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);
  // Ráfagas de confeti (botón 🎊). Cada disparo AGREGA una ráfaga; las anteriores
  // terminan su transición sin reiniciarse. Cada una se auto-quita al terminar.
  const [confettiBursts, setConfettiBursts] = useState<string[]>([]);
  const lastConfettiTrigger = useRef<string | null | undefined>(undefined);
  const burstSeq = useRef(0);
  const lastSoundTrigger = useRef<string | null | undefined>(undefined);
  // Sello one-shot (¡VENDIDO! etc): se muestra un momento y se auto-oculta.
  const [stampView, setStampView] = useState<{
    key: string;
    text: string;
    subtitle: string;
  } | null>(null);
  const lastStampTrigger = useRef<string | null | undefined>(undefined);
  const stampTimer = useRef<number | undefined>(undefined);
  // Combo: UNA unidad (confeti + sonido + sello) que dura 3s y se auto-elimina.
  // Un combo nuevo reemplaza al anterior por completo (nunca se apilan).
  const [comboView, setComboView] = useState<{
    key: string;
    confetti: boolean;
    emoji: string;
    label: string;
    stampText: string;
    stampSubtitle: string;
  } | null>(null);
  const lastComboTrigger = useRef<string | null | undefined>(undefined);
  const comboTimer = useRef<number | undefined>(undefined);
  // Escena de video (clip de R2). Se reproduce al dispararse y se oculta al
  // terminar (o al detenerlo).
  const [videoView, setVideoView] = useState<{
    key: string;
    url: string;
    kind: "audio" | "video";
    loop: boolean;
    muted: boolean;
    fit: "cover" | "contain";
    startSec?: number;
    endSec?: number;
  } | null>(null);
  const lastVideoTrigger = useRef<string | null | undefined>(undefined);
  // Efectos fx (monedas/fuegos/manga): se apilan como el confeti.
  const [fxBursts, setFxBursts] = useState<{ key: string; variant: FxVariant }[]>(
    []
  );
  const lastFxTrigger = useRef<string | null | undefined>(undefined);
  // Brillo holográfico sobre la carta.
  const [shineKey, setShineKey] = useState<string | null>(null);
  const lastShineTrigger = useRef<string | null | undefined>(undefined);
  const shineTimer = useRef<number | undefined>(undefined);

  const lastUpdatedAt = useRef<string | null>(null);

  // Aplica un estado (venga del socket o del polling) manteniendo sincronizado
  // el updatedAt para el polling condicional.
  const applyState = useCallback((next: Partial<LiveOverlayState> | null) => {
    const norm = normalizeLiveOverlayState(next);
    lastUpdatedAt.current = norm.updatedAt;
    setState(norm);
  }, []);

  // Empujón instantáneo por WebSocket (ohara-live-worker). Si no está
  // configurado, `connected` queda en false y caemos a polling rápido.
  const { connected } = useOverlaySocket({ token, onState: applyState });

  // Polling condicional: mandamos el último updatedAt y el endpoint responde
  // vacío si no cambió. Rápido (1s) cuando NO hay socket; lento (15s, red de
  // seguridad) cuando el socket está conectado.
  const loadState = useCallback(async () => {
    try {
      const since = lastUpdatedAt.current
        ? `&since=${encodeURIComponent(lastUpdatedAt.current)}`
        : "";
      const response = await fetch(
        `/api/live-overlay/state?token=${encodeURIComponent(token)}${since}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to load overlay state");
      const data = await response.json();
      if (data.changed === false) return; // sin cambios, conservamos el estado
      applyState(data.state ?? EMPTY_STATE);
    } catch (error) {
      console.error("[overlay] failed to load state:", error);
    }
  }, [token, applyState]);

  useEffect(() => {
    loadState();
    const interval = window.setInterval(loadState, connected ? 15000 : 1000);
    return () => window.clearInterval(interval);
  }, [loadState, connected]);

  // Escenas activas del stack.
  const confetti = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "confetti"
  );
  const banner = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "banner" && s.visible
  );
  const sound = state.scenes.find((s: LiveOverlayScene) => s.type === "sound");
  const mode = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "mode" && s.visible
  );
  const goal = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "goal" && s.visible
  );
  const stamp = state.scenes.find((s: LiveOverlayScene) => s.type === "stamp");
  const combo = state.scenes.find((s: LiveOverlayScene) => s.type === "combo");
  const video = state.scenes.find((s: LiveOverlayScene) => s.type === "video");
  const fx = state.scenes.find((s: LiveOverlayScene) => s.type === "fx");
  const shine = state.scenes.find((s: LiveOverlayScene) => s.type === "shine");

  // Dispara el confeti cuando triggeredAt cambia (dedupe: no se repite en cada
  // poll). Además, por FRESCURA: solo se reproduce si el disparo es reciente,
  // así se ve aunque el overlay acabe de cargar, pero un disparo viejo NO se
  // repite al refrescar OBS.
  useEffect(() => {
    // Escena de confeti removida (limpiar/combo): NO cancelamos las ráfagas en
    // curso, las dejamos terminar su transición. Solo reseteamos el dedupe.
    if (!confetti) {
      lastConfettiTrigger.current = null;
      return;
    }
    const trigger = confetti.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastConfettiTrigger.current;
    lastConfettiTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    // Ventana generosa (ttl + margen para el polling y desfase de reloj).
    if (ageMs <= (confetti.ttlMs ?? 4500) + 6000) {
      const id = `${trigger}#${burstSeq.current++}`;
      setConfettiBursts((b) => [...b, id]);
    }
  }, [confetti, confetti?.triggeredAt, confetti?.ttlMs]);

  // Muestra el sello cuando su triggeredAt cambia (frescura) y lo auto-oculta
  // tras su ttl.
  useEffect(() => {
    // Escena de sello removida (ej. combo nuevo sin sello / limpiar) → oculta.
    if (!stamp) {
      lastStampTrigger.current = null;
      window.clearTimeout(stampTimer.current);
      setStampView(null);
      return;
    }
    const trigger = stamp.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastStampTrigger.current;
    lastStampTrigger.current = trigger;
    if (!isNew) return;
    const ttl = stamp.ttlMs ?? 2800;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > ttl + 4000) return; // disparo viejo (refresh): no mostrar
    setStampView({
      key: trigger,
      text: String(stamp.props?.text ?? ""),
      subtitle: String(stamp.props?.subtitle ?? ""),
    });
    window.clearTimeout(stampTimer.current);
    stampTimer.current = window.setTimeout(
      () => setStampView(null),
      Math.max(400, ttl - Math.max(0, ageMs))
    );
  }, [stamp, stamp?.triggeredAt, stamp?.ttlMs, stamp?.props?.text, stamp?.props?.subtitle]);

  useEffect(() => () => window.clearTimeout(stampTimer.current), []);

  // Combo: una unidad atómica. Al llegar un combo nuevo (triggeredAt), reemplaza
  // al anterior (confeti + sonido + sello) y se auto-elimina a los 3s.
  useEffect(() => {
    if (!combo) {
      lastComboTrigger.current = null;
      window.clearTimeout(comboTimer.current);
      setComboView(null);
      return;
    }
    const trigger = combo.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastComboTrigger.current;
    lastComboTrigger.current = trigger;
    if (!isNew) return;
    const ttl = combo.ttlMs ?? 3000;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > ttl + 4000) return; // disparo viejo (refresh): no reproducir
    const props = combo.props || {};
    if (props.sfx) playOverlaySfx(String(props.sfx));
    setComboView({
      key: trigger,
      confetti: !!props.confetti,
      emoji: String(props.emoji ?? ""),
      label: String(props.label ?? ""),
      stampText: String(props.stampText ?? ""),
      stampSubtitle: String(props.stampSubtitle ?? ""),
    });
    window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(
      () => setComboView(null),
      Math.max(400, ttl - Math.max(0, ageMs))
    );
  }, [combo, combo?.triggeredAt]);

  useEffect(() => () => window.clearTimeout(comboTimer.current), []);

  // Escena de video: reproduce el clip cuando su triggeredAt cambia.
  useEffect(() => {
    if (!video) {
      lastVideoTrigger.current = null;
      setVideoView(null);
      return;
    }
    const trigger = video.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastVideoTrigger.current;
    lastVideoTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 5 * 60 * 1000) return; // no relanzar un disparo muy viejo
    const p = (video.props || {}) as Record<string, unknown>;
    const url = String(p.url ?? "");
    if (!url) return;
    setVideoView({
      key: trigger,
      url,
      kind: p.kind === "audio" ? "audio" : "video",
      loop: p.loop === true,
      muted: p.muted === true,
      fit: p.fit === "contain" ? "contain" : "cover",
      startSec: typeof p.startSec === "number" ? p.startSec : undefined,
      endSec: typeof p.endSec === "number" ? p.endSec : undefined,
    });
  }, [video, video?.triggeredAt]);

  // fx (monedas/fuegos/manga): agrega una ráfaga por cada disparo nuevo.
  useEffect(() => {
    const trigger = fx?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastFxTrigger.current;
    lastFxTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 8000) return;
    const variant = String(fx?.props?.variant ?? "coins") as FxVariant;
    setFxBursts((b) => [...b, { key: trigger, variant }]);
  }, [fx?.triggeredAt, fx?.props?.variant]);

  // Brillo holográfico sobre la carta (se auto-oculta).
  useEffect(() => {
    const trigger = shine?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastShineTrigger.current;
    lastShineTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 6000) return;
    setShineKey(trigger);
    window.clearTimeout(shineTimer.current);
    shineTimer.current = window.setTimeout(() => setShineKey(null), 1200);
  }, [shine?.triggeredAt]);

  useEffect(() => () => window.clearTimeout(shineTimer.current), []);

  // ===========================================================================
  // Batalla de gifters: loop de exhibición, puramente visual (no toca el
  // backend). El actual #1 del ranking de regalos (más diamantes) pelea cada
  // ~5s contra el siguiente de la lista, en orden, y SIEMPRE gana — es
  // determinista, no al azar. Al llegar al final vuelve a empezar desde el
  // 2° lugar. Si cambia quién es el #1 real, el próximo tick ya pelea con el
  // campeón nuevo.
  //
  // Hay más de un estilo visual para la misma pelea (mismo estado, distinto
  // render). Por ahora se elige a mano acá; más adelante esto será elegible
  // desde el Live Desk.
  // ===========================================================================
  const BATTLE_VISUAL_STYLE: "clash" | "brawl" | "doodle" | "sprite" = "sprite";
  // La variante "sprite" es un loop CONTINUO, no ráfagas con huecos: el
  // campeón nunca desaparece, solo van entrando retadores uno tras otro sin
  // corte — apenas termina la derrota de uno, arranca la entrada del
  // siguiente en la misma cadena de timeouts (ver runNextChallenger).
  const BATTLE_ENTRANCE_MS = 700;
  const BATTLE_STANDOFF_MS = 2200;
  const BATTLE_CLASH_MS = 900;
  const BATTLE_DEFEAT_MS = 2200;
  const challengerIndexRef = useRef(1);
  const [battle, setBattle] = useState<{
    key: string;
    // Fases de la variante "sprite": entrance (idle/idle) → standoff (idle/
    // idle, más largo) → clash (ataque/golpe) → defeat (idle/muerte).
    phase: "entrance" | "standoff" | "clash" | "defeat";
    champion: { user: string; avatar: string; diamonds: number };
    challenger: { user: string; avatar: string; diamonds: number };
  } | null>(null);

  // `state.topGifters` es un array NUEVO en cada actualización de estado
  // (aunque el contenido no cambie) — si el loop dependiera de esa
  // referencia, se reiniciaría en cada poll/mensaje del socket. Por eso lee
  // siempre el valor más fresco desde una ref en vez de depender de él.
  const latestGiftersRef = useRef(state.topGifters);
  useEffect(() => {
    latestGiftersRef.current = state.topGifters;
  }, [state.topGifters]);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const runNextChallenger = () => {
      if (cancelled) return;
      const gifters = latestGiftersRef.current;
      if (gifters.length < 2) {
        // Todavía no hay suficientes gifters para pelear — reintenta pronto
        // en vez de dejar el loop muerto para siempre.
        schedule(runNextChallenger, 2000);
        return;
      }
      if (challengerIndexRef.current >= gifters.length) {
        challengerIndexRef.current = 1;
      }
      const champion = gifters[0];
      const challenger = gifters[challengerIndexRef.current];
      challengerIndexRef.current += 1;
      const key = `${champion.user}-vs-${challenger.user}-${Date.now()}`;
      setBattle({
        key,
        phase: "entrance",
        champion: { user: champion.user, avatar: champion.avatar, diamonds: champion.count },
        challenger: { user: challenger.user, avatar: challenger.avatar, diamonds: challenger.count },
      });
      // Solo aplica si sigue siendo la MISMA ronda (por key) — evita que un
      // timer atrasado pise el estado de una ronda posterior.
      const withSameRound = (updater: (b: NonNullable<typeof battle>) => typeof battle) =>
        setBattle((b) => (b && b.key === key ? updater(b) : b));

      schedule(() => withSameRound((b) => ({ ...b, phase: "standoff" })), BATTLE_ENTRANCE_MS);
      schedule(
        () => withSameRound((b) => ({ ...b, phase: "clash" })),
        BATTLE_ENTRANCE_MS + BATTLE_STANDOFF_MS
      );
      schedule(
        () => withSameRound((b) => ({ ...b, phase: "defeat" })),
        BATTLE_ENTRANCE_MS + BATTLE_STANDOFF_MS + BATTLE_CLASH_MS
      );
      schedule(
        runNextChallenger,
        BATTLE_ENTRANCE_MS + BATTLE_STANDOFF_MS + BATTLE_CLASH_MS + BATTLE_DEFEAT_MS
      );
    };

    runNextChallenger();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Reproduce el SFX cuando su triggeredAt cambia (misma lógica de frescura).
  useEffect(() => {
    const trigger = sound?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastSoundTrigger.current;
    lastSoundTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs <= 8000) {
      playOverlaySfx(String(sound?.props?.sfx ?? "ding"));
    }
  }, [sound?.triggeredAt, sound?.props?.sfx]);

  // Desbloqueo de audio. En OBS suele arrancar solo; en un navegador de prueba
  // el audio queda bloqueado hasta el primer gesto. Mostramos un aviso mientras
  // esté bloqueado y lo desbloqueamos al primer clic/tecla.
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    ensureOverlayAudio().then((ready) => mounted && setAudioReady(ready));
    const unlock = async () => {
      const ready = await ensureOverlayAudio();
      if (mounted) setAudioReady(ready);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      mounted = false;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const goalCurrent = Math.max(0, Number(goal?.props?.current ?? 0));
  const goalTarget = Math.max(1, Number(goal?.props?.target ?? 100));
  const goalPct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));

  return (
    // Contenedor a pantalla completa (gutter oscuro para preview en navegador).
    // En OBS pon la Browser Source EXACTAMENTE a 710×1265 y el lienzo la llena.
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      {/* Lienzo FIJO 710×1265 (vertical) — fondo verde chroma-key. */}
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden bg-[#28ce2b]">
        <style>{`
          @keyframes overlay-card-in {
            0%   { opacity: 0; transform: translateY(48px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes overlay-mode-in {
            0%   { opacity: 0; transform: translateY(-24px) scale(0.8); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes overlay-stamp-in {
            0%   { opacity: 0; transform: scale(2.2); }
            60%  { opacity: 1; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes overlay-shine {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(120%); }
          }
          @keyframes overlay-glass {
            0%   { opacity: 0; transform: scale(0.82) translateY(12px); filter: blur(6px); }
            12%  { opacity: 1; transform: scale(1.03) translateY(0); filter: blur(0); }
            20%  { transform: scale(1); }
            80%  { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.03); }
          }
          @keyframes overlay-battle-group {
            0%   { opacity: 1; }
            90%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes overlay-battle-champion {
            0%   { opacity: 0; transform: translateX(-30px) scale(0.9); }
            15%  { opacity: 1; transform: translateX(-8px) scale(1); }
            35%  { transform: translateX(-8px) scale(1); }
            42%  { transform: translateX(-8px) scale(1.25); }
            50%  { transform: translateX(-8px) scale(1.05); }
            58%  { transform: translateX(-8px) scale(1.15); }
            100% { transform: translateX(-8px) scale(1.1); }
          }
          @keyframes overlay-battle-challenger {
            0%   { opacity: 0; transform: translate(30px, 0) scale(0.9) rotate(0deg); }
            15%  { opacity: 1; transform: translate(8px, 0) scale(1) rotate(0deg); }
            35%  { transform: translate(8px, 0) scale(1) rotate(0deg); }
            55%  { opacity: 1; transform: translate(8px, 10px) scale(0.9) rotate(-15deg); }
            75%  { opacity: 0; transform: translate(8px, 60px) scale(0.5) rotate(-45deg); }
            100% { opacity: 0; transform: translate(8px, 60px) scale(0.5) rotate(-45deg); }
          }
          @keyframes overlay-battle-impact {
            0%   { opacity: 0; transform: scale(0.3) rotate(0deg); }
            30%  { opacity: 0; transform: scale(0.3) rotate(0deg); }
            38%  { opacity: 1; transform: scale(1.5) rotate(-10deg); }
            55%  { opacity: 0; transform: scale(2) rotate(10deg); }
            100% { opacity: 0; transform: scale(2) rotate(10deg); }
          }
          @keyframes overlay-brawl-champion-body {
            0%   { opacity: 0; transform: translateX(-30px); }
            15%  { opacity: 1; transform: translateX(-8px); }
            35%  { transform: translateX(-8px); }
            42%  { transform: translateX(6px); }
            50%  { transform: translateX(-4px); }
            100% { transform: translateX(-8px); }
          }
          @keyframes overlay-brawl-champion-arm {
            0%   { transform: rotate(-15deg); }
            35%  { transform: rotate(-15deg); }
            42%  { transform: rotate(55deg); }
            50%  { transform: rotate(10deg); }
            100% { transform: rotate(-15deg); }
          }
          @keyframes overlay-brawl-challenger-body {
            0%   { opacity: 0; transform: translate(30px, 0) rotate(0deg); }
            15%  { opacity: 1; transform: translate(8px, 0) rotate(0deg); }
            35%  { transform: translate(8px, 0) rotate(0deg); }
            44%  { transform: translate(18px, -4px) rotate(8deg); }
            55%  { opacity: 1; transform: translate(26px, 24px) rotate(75deg); }
            75%  { opacity: 0.6; transform: translate(36px, 60px) rotate(150deg); }
            90%  { opacity: 0; transform: translate(42px, 78px) rotate(180deg); }
            100% { opacity: 0; transform: translate(42px, 78px) rotate(180deg); }
          }
          @keyframes overlay-brawl-stars {
            0%   { opacity: 0; transform: translateY(0) scale(0.5) rotate(0deg); }
            40%  { opacity: 0; transform: translateY(0) scale(0.5) rotate(0deg); }
            46%  { opacity: 1; transform: translateY(-6px) scale(1) rotate(15deg); }
            62%  { opacity: 1; transform: translateY(-10px) scale(1.05) rotate(-15deg); }
            75%  { opacity: 0; transform: translateY(-14px) scale(0.9) rotate(15deg); }
            100% { opacity: 0; transform: translateY(-14px) scale(0.9) rotate(15deg); }
          }
          @keyframes overlay-doodle-arm {
            0%   { transform: rotate(-10deg); }
            35%  { transform: rotate(-10deg); }
            42%  { transform: rotate(70deg); }
            50%  { transform: rotate(15deg); }
            100% { transform: rotate(-10deg); }
          }
          @keyframes overlay-doodle-face-neutral-out {
            0%   { opacity: 1; }
            40%  { opacity: 1; }
            48%  { opacity: 0; }
            100% { opacity: 0; }
          }
          @keyframes overlay-doodle-face-hit-in {
            0%   { opacity: 0; }
            40%  { opacity: 0; }
            48%  { opacity: 1; }
            100% { opacity: 1; }
          }
          @keyframes overlay-sprite-fighter-in {
            0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
            20%  { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
        {/* Contadores: SIEMPRE los 5, píldoras compactas en el borde izquierdo. */}
        <div className="absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
          {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
            <div
              key={rarity}
              className="-ml-8 flex items-center gap-3 rounded-full border-[3px] border-cyan-400 bg-black py-2 pl-11 pr-6 shadow-[0_6px_22px_rgba(0,0,0,0.45)]"
            >
              <span className="text-3xl font-black uppercase leading-none tracking-tight text-white">
                {rarity}
              </span>
              <span className="text-4xl font-black leading-none text-[#ff2d6f]">
                {state.rarityCounters[rarity]}
              </span>
            </div>
          ))}
        </div>

        {/* Carta en vivo: anclada por ARRIBA (top fijo) para que al agrandar la
            imagen crezca solo hacia abajo, donde hay espacio. El `key` por id
            re-dispara la animación de entrada cada vez que cambia la carta. */}
        {state.currentCard ? (
          <div
            key={state.currentCard.id}
            className="absolute inset-x-0 top-[273px] flex flex-col items-center gap-3 [animation:overlay-card-in_0.55s_cubic-bezier(0.22,1,0.36,1)]"
          >
            {state.currentCard.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.currentCard.imageUrl}
                alt={state.currentCard.code}
                className="w-[350px] rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
              />
            ) : null}

            <div className="w-[290px] rounded-2xl bg-black/80 px-4 py-3.5 text-center text-white backdrop-blur">
              <div className="text-4xl font-black leading-none tracking-tight">
                {state.currentCard.code}
              </div>
              {state.currentCard.rarity || state.currentCard.alternateArt ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-base font-bold uppercase tracking-wide text-amber-300">
                  {state.currentCard.rarity ? (
                    <span>{state.currentCard.rarity}</span>
                  ) : null}
                  {state.currentCard.alternateArt ? (
                    <span>· {state.currentCard.alternateArt}</span>
                  ) : null}
                </div>
              ) : null}
              {state.currentCard.price != null ? (
                <div className="mt-2 text-4xl font-black text-[#ff2d6f]">
                  $
                  {Number(state.currentCard.price).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ===================== ESCENAS (stack de capas) ===================== */}

        {/* Modalidad: letrero animado arriba (SUBASTA, BATALLAS, PACKS…) */}
        {mode ? (
          <div className="absolute inset-x-0 top-6 z-20 flex justify-center px-6">
            <div
              key={String(mode.props.label)}
              className="flex items-center gap-3 rounded-2xl border-[3px] px-8 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] [animation:overlay-mode-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                background: "rgba(0,0,0,0.82)",
                borderColor: (mode.props.accent as string) || "#f5b301",
              }}
            >
              {mode.props.emoji ? (
                <span className="text-4xl leading-none">
                  {String(mode.props.emoji)}
                </span>
              ) : null}
              <span className="text-4xl font-black uppercase tracking-wider text-white">
                {String(mode.props.label)}
              </span>
            </div>
          </div>
        ) : null}

        {/* Barra de meta */}
        {goal ? (
          <div className="absolute inset-x-0 top-[92px] z-20 flex justify-center px-8">
            <div className="w-[560px] max-w-full rounded-2xl bg-black/80 px-5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xl font-black uppercase tracking-wide text-white">
                  {String(goal.props.label || "Meta")}
                </span>
                <span className="text-xl font-black tabular-nums text-amber-300">
                  {goalCurrent}
                  {goal.props.unit ? ` ${String(goal.props.unit)}` : ""}
                  <span className="text-white/50"> / {goalTarget}</span>
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${goalPct}%`,
                    background:
                      (goal.props.accent as string) ||
                      "linear-gradient(90deg,#ff2d6f,#f5b301)",
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Banner persistente (lower-third) */}
        {banner ? (
          <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center px-6">
            <div
              className="max-w-[620px] rounded-2xl border-[3px] px-8 py-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur"
              style={{
                background: "rgba(0,0,0,0.82)",
                borderColor:
                  (banner.props.accent as string) || "#f5b301",
              }}
            >
              <div className="text-4xl font-black leading-tight text-white">
                {String(banner.props.text ?? "")}
              </div>
              {banner.props.subtitle ? (
                <div className="mt-1 text-xl font-bold uppercase tracking-wide text-amber-300">
                  {String(banner.props.subtitle)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Sello one-shot (¡VENDIDO! etc) — centrado, encima de la carta */}
        {stampView ? (
          <div
            key={stampView.key}
            className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-center [animation:overlay-stamp-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            <div className="-rotate-6 rounded-3xl border-[6px] border-white bg-[#ff2d6f] px-10 py-5 shadow-[0_16px_60px_rgba(0,0,0,0.6)]">
              <span className="text-7xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">
                {stampView.text}
              </span>
            </div>
            {stampView.subtitle ? (
              <span className="mt-3 -rotate-6 text-3xl font-black uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {stampView.subtitle}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Combo (confeti + sello) como unidad de 3s, se reemplaza y auto-elimina.
            El contenedor llena el lienzo para que el canvas del confeti tenga
            tamaño (710×1265). */}
        {comboView ? (
          <div
            key={`combo-${comboView.key}`}
            className="pointer-events-none absolute inset-0 z-[55]"
          >
            {comboView.confetti ? <ConfettiLayer durationMs={3000} /> : null}
            {comboView.emoji || comboView.stampText || comboView.label ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex min-w-[300px] flex-col items-center gap-3 rounded-[2rem] border border-white/15 bg-[rgba(16,12,30,0.8)] px-16 py-10 text-center shadow-[0_24px_90px_rgba(0,0,0,0.55),0_0_60px_rgba(255,45,111,0.25)] backdrop-blur-xl [animation:overlay-glass_3s_cubic-bezier(0.34,1.4,0.5,1)_forwards]">
                  {comboView.emoji ? (
                    <span className="text-8xl leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
                      {comboView.emoji}
                    </span>
                  ) : null}
                  <span className="text-6xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                    {comboView.stampText || comboView.label}
                  </span>
                  {comboView.stampSubtitle ? (
                    <span className="text-2xl font-bold uppercase tracking-[0.2em] text-white/60">
                      {comboView.stampSubtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Ráfagas de confeti suelto (botón 🎊). Se apilan y cada una termina
            su transición sin reiniciar a las demás. */}
        {confettiBursts.map((id) => (
          <ConfettiLayer
            key={id}
            durationMs={confetti?.ttlMs ?? 4500}
            onDone={() =>
              setConfettiBursts((b) => b.filter((x) => x !== id))
            }
          />
        ))}

        {/* Efectos fx (monedas / fuegos / burbujas), apilables */}
        {fxBursts.map((b) => (
          <FxLayer
            key={b.key}
            variant={b.variant}
            onDone={() =>
              setFxBursts((x) => x.filter((y) => y.key !== b.key))
            }
          />
        ))}

        {/* Brillo: barrido de luz diagonal a pantalla completa (siempre visible) */}
        {shineKey ? (
          <div
            key={shineKey}
            className="pointer-events-none absolute inset-0 z-[62] overflow-hidden"
          >
            <div
              className="absolute inset-y-0 -left-1/3 -right-1/3 [animation:overlay-shine_1.1s_ease-out_forwards]"
              style={{
                background:
                  "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.45) 48%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.45) 52%, transparent 58%)",
              }}
            />
          </div>
        ) : null}

        {/* Escena de VIDEO (clip de R2). El letterbox (contain) queda en verde
            chroma → OBS lo vuelve transparente. */}
        {videoView && videoView.url ? (
          videoView.kind === "audio" ? (
            // Audio: sin visual, solo reproduce el segmento.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              key={videoView.key}
              src={
                videoView.startSec != null
                  ? `${videoView.url}#t=${videoView.startSec}${
                      videoView.endSec != null ? `,${videoView.endSec}` : ""
                    }`
                  : videoView.url
              }
              autoPlay
              loop={videoView.loop}
              onEnded={() => {
                if (!videoView.loop) setVideoView(null);
              }}
            />
          ) : (
            <div className="absolute inset-0 z-[75]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                key={videoView.key}
                src={
                  videoView.startSec != null
                    ? `${videoView.url}#t=${videoView.startSec}${
                        videoView.endSec != null ? `,${videoView.endSec}` : ""
                      }`
                    : videoView.url
                }
                autoPlay
                playsInline
                muted={videoView.muted}
                loop={videoView.loop}
                className={`h-full w-full ${
                  videoView.fit === "contain"
                    ? "object-contain"
                    : "object-cover"
                }`}
                onEnded={() => {
                  if (!videoView.loop) setVideoView(null);
                }}
              />
            </div>
          )
        ) : null}

        {/* Escena BRACKET a pantalla completa (opaca → sobrevive al chroma).
            Cubre todo cuando está activa. */}
        {state.bracket?.active ? (
          <div className="absolute inset-0 z-[80]">
            <BracketView bracket={state.bracket} />
          </div>
        ) : null}

        {/* Ranking de la sesión: top likers / top regaladores (por cantidad) */}
        {state.topLikers.length > 0 || state.topGifters.length > 0 ? (
          <div className="absolute right-4 top-24 z-30 flex max-w-[220px] flex-col gap-2">
            {state.topLikers.length > 0 ? (
              <div className="rounded-xl bg-black/75 px-3 py-2 backdrop-blur">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#ff2d6f]">
                  ❤️ Top Likes
                </div>
                {state.topLikers.slice(0, 3).map((e, i) => (
                  <div
                    key={e.user}
                    className="flex items-center justify-between gap-2 text-xs font-bold text-white"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {e.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.avatar}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="truncate">
                        {i + 1}. {e.user}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white/70">
                      {e.count.toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {state.topGifters.length > 0 ? (
              <div className="rounded-xl bg-black/75 px-3 py-2 backdrop-blur">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
                  🎁 Top Regalos
                </div>
                {state.topGifters.slice(0, 3).map((e, i) => (
                  <div
                    key={e.user}
                    className="flex items-center justify-between gap-2 text-xs font-bold text-white"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {e.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.avatar}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="truncate">
                        {i + 1}. {e.user}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white/70">
                      💎{e.count.toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Batalla de gifters: loop de exhibición (campeón = #1 en diamantes,
            siempre gana). Zona libre entre la carta y el banner inferior. */}
        {battle ? (
          <div
            // La variante "sprite" es un loop continuo: el campeón nunca se
            // desmonta, así que este contenedor usa una key ESTABLE (no
            // battle.key) y no lleva la animación de fade del grupo — solo
            // el retador (key={battle.key} más abajo) se remonta cada ronda.
            // Las demás variantes (legacy) mantienen el fade-in/out por ronda.
            key={BATTLE_VISUAL_STYLE === "sprite" ? "sprite-stage" : battle.key}
            className={`pointer-events-none absolute inset-x-0 top-[950px] z-40 flex items-center justify-center gap-6 ${
              BATTLE_VISUAL_STYLE === "sprite" ? "" : "[animation:overlay-battle-group_3s_ease-out_forwards]"
            }`}
          >
            {BATTLE_VISUAL_STYLE === "sprite" ? (
              <>
                {/* Retador a la izquierda, campeón a la derecha (y el
                    campeón SÍ se espejea, ver StickSpriteFighter) — así su
                    mirada durante el ataque cae sobre el retador en vez de
                    verse hacia la orilla de la pantalla. */}
                <StickSpriteFighter
                  key={battle.key}
                  role="challenger"
                  user={battle.challenger.user}
                  diamonds={battle.challenger.diamonds}
                  maxDiamonds={battle.champion.diamonds}
                  clip={
                    battle.phase === "clash"
                      ? "hit"
                      : battle.phase === "defeat"
                        ? "death"
                        : "idle"
                  }
                />
                {battle.phase === "clash" ? <HitFlashSprite resetKey={battle.key} /> : null}
                <StickSpriteFighter
                  role="champion"
                  user={battle.champion.user}
                  diamonds={battle.champion.diamonds}
                  maxDiamonds={battle.champion.diamonds}
                  clip={battle.phase === "clash" ? "attack" : "idle"}
                />
              </>
            ) : BATTLE_VISUAL_STYLE === "doodle" ? (
              <>
                <DoodleFighter
                  role="champion"
                  user={battle.champion.user}
                  diamonds={battle.champion.diamonds}
                  maxDiamonds={battle.champion.diamonds}
                />
                <span className="absolute text-6xl leading-none [animation:overlay-battle-impact_3s_ease-out_forwards]">
                  💥
                </span>
                <DoodleFighter
                  role="challenger"
                  user={battle.challenger.user}
                  diamonds={battle.challenger.diamonds}
                  maxDiamonds={battle.champion.diamonds}
                />
              </>
            ) : BATTLE_VISUAL_STYLE === "brawl" ? (
              <>
                <BrawlFighter
                  role="champion"
                  user={battle.champion.user}
                  avatar={battle.champion.avatar}
                />
                <span className="absolute text-6xl leading-none [animation:overlay-battle-impact_3s_ease-out_forwards]">
                  💥
                </span>
                <BrawlFighter
                  role="challenger"
                  user={battle.challenger.user}
                  avatar={battle.challenger.avatar}
                />
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1.5 [animation:overlay-battle-champion_3s_ease-out_forwards]">
                  {battle.champion.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={battle.champion.avatar}
                      alt=""
                      className="h-20 w-20 rounded-full border-4 border-amber-300 object-cover shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full border-4 border-amber-300 bg-black/60" />
                  )}
                  <span className="max-w-[110px] truncate rounded-full bg-black/85 px-3 py-0.5 text-xs font-black text-amber-300">
                    {battle.champion.user}
                  </span>
                </div>

                <span className="absolute text-6xl leading-none [animation:overlay-battle-impact_3s_ease-out_forwards]">
                  💥
                </span>

                <div className="flex flex-col items-center gap-1.5 [animation:overlay-battle-challenger_3s_ease-out_forwards]">
                  {battle.challenger.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={battle.challenger.avatar}
                      alt=""
                      className="h-20 w-20 rounded-full border-4 border-white/50 object-cover shadow-[0_10px_28px_rgba(0,0,0,0.55)] grayscale"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full border-4 border-white/50 bg-black/60" />
                  )}
                  <span className="max-w-[110px] truncate rounded-full bg-black/85 px-3 py-0.5 text-xs font-black text-white/70">
                    {battle.challenger.user}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Aviso de audio bloqueado (solo hasta el primer clic; en OBS no sale) */}
        {!audioReady ? (
          <div className="absolute bottom-4 left-1/2 z-[70] -translate-x-1/2 animate-pulse rounded-full bg-black/85 px-5 py-2.5 text-base font-bold text-white shadow-lg">
            🔊 Clic para activar sonido
          </div>
        ) : null}
      </div>
    </div>
  );
}
