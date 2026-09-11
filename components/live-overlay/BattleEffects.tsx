"use client";

import { useEffect, useState } from "react";
import type { LiveOverlayBattlePower } from "@/lib/live-overlay/types";

const BASE = "/live-overlay/effects";

/**
 * Un efecto es o bien una SECUENCIA de archivos numerados (frame() arma la
 * ruta de cada uno), o un SPRITE SHEET (un solo PNG con varios frames en fila,
 * se recorta con background-position), o una imagen ESTÁTICA animada por CSS
 * (para los packs que traen una sola ilustración por variante, no una
 * animación cuadro por cuadro).
 */
export type BattleEffectDef =
  | { mode: "frames"; frame: (i: number) => string; frameCount: number; width: number; height: number; fps: number }
  | {
      mode: "sheet";
      src: string;
      cols: number;
      // Grillas de más de una fila (ej. 4x4, 8x7) — si no se pasa, se asume
      // todo en una sola fila (comportamiento de siempre).
      rows?: number;
      frameCount: number;
      frameWidth: number;
      frameHeight: number;
      displaySize: number;
      fps: number;
    }
  | { mode: "static"; src: string; width: number; height: number };

const pad4 = (i: number) => String(i).padStart(4, "0");

/**
 * Golpe de impacto genérico (hit) — pack elegido por el usuario
 * ("Hit Animation - Frame by frame", OpenGameArt CC0) sobre el sheet
 * original: grilla 4x4, 16 frames, 1024x1024 total (256px/frame).
 */
const HIT_SHEET: BattleEffectDef = {
  mode: "sheet",
  src: `${BASE}/hit-v2/hit-yellow.png`,
  cols: 4,
  rows: 4,
  frameCount: 16,
  frameWidth: 256,
  frameHeight: 256,
  displaySize: 110,
  fps: 24,
};

/**
 * Fuego elegido por el usuario ("Free Flame Effects Sprite Pack", CraftPix)
 * — pack con múltiples variantes; se usó "flame4" (columna de fuego
 * ardiendo, forma estable cuadro a cuadro) para el burst de impacto Y el
 * loop persistente mientras dura "burn" — antes esto era un placeholder
 * genérico, ahora es fuego real ardiendo sobre el objetivo.
 */
const FIRE: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/fire-burn-loop/frame_${String(i).padStart(2, "0")}.png`,
  frameCount: 53,
  width: 70,
  height: 83,
  fps: 30,
};

/**
 * Bola de fuego que viaja hacia el objetivo (mismo pack, variante "flame2":
 * orbe redondo que crece/pulsa) — pedido explícito del usuario ("tirar una
 * bola de fuego que viaja e impacta").
 */
const FIRE_PROJECTILE: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/fire-projectile/frame_${String(i).padStart(2, "0")}.png`,
  frameCount: 16,
  width: 56,
  height: 56,
  fps: 24,
};

const ICE: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/ice/Ice VFX 1/Separated Frames/VFX 1 Hit${i + 1}.png`,
  frameCount: 8,
  width: 96,
  height: 64,
  fps: 20,
};

/**
 * Proyectil de hielo para "freeze" (pack Icicle Spell, OpenGameArt CC-BY 3.0):
 * grilla de 8 direcciones x 8 frames, 512x512 total (64px/frame). Se usa UNA
 * sola fila (dirección) como carámbano volando — no hace falta orientar por
 * dirección real ya que el proyectil siempre viaja en línea recta entre dos
 * puntos calculados en runtime.
 */
const ICICLE_PROJECTILE: BattleEffectDef = {
  mode: "sheet",
  src: `${BASE}/hielo-icicle/icicle.png`,
  // La grilla real de la imagen es 8x8 (8 direcciones x 8 frames) — hay que
  // declarar las 8 filas reales para que el backgroundSize calculado
  // coincida con el archivo, aunque frameCount se corte en 8 para quedarnos
  // solo con la primera fila (una dirección) como proyectil.
  cols: 8,
  rows: 8,
  frameCount: 8,
  frameWidth: 64,
  frameHeight: 64,
  displaySize: 48,
  fps: 20,
};

/** Nuke — elegida entre 4 candidatas comparadas en vivo (untiedgames "X-plosion"). */
const EXPLOSION: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/nuke/frame${String(i).padStart(4, "0")}.png`,
  frameCount: 64,
  width: 130,
  height: 130,
  fps: 30,
};

const HEAL_SHEET: BattleEffectDef = {
  mode: "sheet",
  src: `${BASE}/heal/1 Magic/8.png`,
  cols: 8,
  frameCount: 8,
  frameWidth: 72,
  frameHeight: 72,
  displaySize: 90,
  fps: 18,
};

const STARBURST: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/starburst/burst${pad4(i + 1)}.png`,
  frameCount: 60,
  width: 110,
  height: 110,
  fps: 40,
};

/**
 * Rayo elegido por el usuario ("Lightning Lines Pixel Art Effect",
 * sanctumpixel/itch.io) — se usa tanto para el burst de impacto de "chain"
 * como para el proyectil que viaja (ver PROJECTILE_SPRITE más abajo).
 */
const LIGHTNING: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/lightning-v2/lightning_line3a${i + 1}.png`,
  frameCount: 12,
  width: 100,
  height: 100,
  fps: 24,
};

const WIND_STATIC: BattleEffectDef = {
  mode: "static",
  src: `${BASE}/wind/Wind Effect 01/Wind Hit Effect.png`,
  width: 96,
  height: 64,
};

export const SHIELD_IMAGE = `${BASE}/shield/Shield Small size Blue/Shield Round Smooth Blue/Shield Round Smooth Static 128x128 Blue.png`;

/** Auras "en blanco" (pensadas para tintar) — se usan mientras el estado está activo. */
export const AURA_FRAME = (style: 1 | 2, i: number) =>
  `${BASE}/aura/style-00${style}-white-60frames/00${style}_FX_${pad4(i)}.png`;
export const AURA_FRAME_COUNT = 60;

/** Efecto de un solo disparo por tipo de poder — golpea/curación/etc, no estados con duración. */
export const ONE_SHOT_EFFECT: Partial<Record<LiveOverlayBattlePower["kind"], BattleEffectDef>> = {
  hit: HIT_SHEET,
  chain: LIGHTNING,
  nuke: EXPLOSION,
  burn: FIRE,
  freeze: ICE,
  heal: HEAL_SHEET,
  healAll: HEAL_SHEET,
  growMaxHp: STARBURST,
  knockback: WIND_STATIC,
};

/**
 * Loop persistente mientras el status con duración sigue activo (fuego
 * ardiendo, hielo brillando) — antes esto era invisible salvo por un anillo
 * de color + emoji fijo, nunca una animación real corriendo.
 */
export const PERSISTENT_STATUS_EFFECT: Partial<Record<"burn" | "freeze", BattleEffectDef>> = {
  burn: FIRE,
  freeze: ICE,
};

/**
 * Proyectil temático que viaja del atacante al objetivo antes de que se vea
 * el impacto — pedido explícito del usuario ("tirar una bola de fuego...").
 * Kinds sin entrada acá siguen usando el punto de color genérico existente
 * (`Projectile` en BattleArena.tsx) hasta que haya un sprite temático real.
 */
export const PROJECTILE_SPRITE: Partial<Record<LiveOverlayBattlePower["kind"], BattleEffectDef>> = {
  freeze: ICICLE_PROJECTILE,
  chain: LIGHTNING,
  burn: FIRE_PROJECTILE,
};

/**
 * Reproduce un efecto en una posición fija (% de la arena).
 * Por defecto una sola vez (se auto-destruye vía `onDone`); con `loop` sigue
 * para siempre (usado para estados con duración — fuego/veneno/hielo activos
 * — el padre decide cuándo desmontarlo según el `*Until` del fighter, no una
 * duración fija de la animación).
 */
export function PowerEffectView({
  def,
  onDone,
  tint,
  loop = false,
}: {
  def: BattleEffectDef;
  onDone?: () => void;
  tint?: string;
  loop?: boolean;
}) {
  const [frame, setFrame] = useState(0);
  const frameCount = def.mode === "static" ? 1 : def.frameCount;
  const fps = def.mode === "static" ? 2 : def.fps;

  useEffect(() => {
    const doneTimer = loop
      ? null
      : window.setTimeout(
          () => onDone?.(),
          def.mode === "static" ? 500 : Math.ceil((frameCount / fps) * 1000)
        );
    if (def.mode === "static") return () => { if (doneTimer) window.clearTimeout(doneTimer); };
    const interval = window.setInterval(() => {
      setFrame((f) => (loop ? (f + 1) % frameCount : Math.min(f + 1, frameCount - 1)));
    }, 1000 / fps);
    return () => {
      if (doneTimer) window.clearTimeout(doneTimer);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  if (def.mode === "frames") {
    return (
      <img
        src={def.frame(frame)}
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain"
        style={{ width: def.width, height: def.height, maxWidth: "none", filter: tint }}
      />
    );
  }
  if (def.mode === "sheet") {
    const rows = def.rows ?? 1;
    const scale = def.displaySize / def.frameHeight;
    const sheetWidth = def.frameWidth * def.cols * scale;
    const sheetHeight = def.frameHeight * rows * scale;
    const col = frame % def.cols;
    const row = Math.floor(frame / def.cols);
    return (
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: def.displaySize,
          height: def.displaySize,
          // Comillas obligatorias: los nombres de archivo de estos packs traen
          // espacios ("Hit Effect 01 1.png") y un url() sin comillas con
          // espacios es CSS inválido — el navegador lo descarta en silencio
          // (sin error en consola) y el div queda sin imagen.
          backgroundImage: `url("${def.src}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${sheetWidth}px ${sheetHeight}px`,
          backgroundPosition: `-${col * def.frameWidth * scale}px -${row * def.frameHeight * scale}px`,
          filter: tint,
        }}
      />
    );
  }
  return (
    <img
      src={def.src}
      alt=""
      className="battle-fx-static-burst pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain"
      style={{ width: def.width, height: def.height, maxWidth: "none", filter: tint }}
    />
  );
}

/** Aura continua (disparo rápido / subir ataque) mientras el estado sigue activo. */
export function PersistentAura({ style, tint, size }: { style: 1 | 2; tint: string; size: number }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((f) => (f + 1) % AURA_FRAME_COUNT);
    }, 1000 / 30);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <img
      src={AURA_FRAME(style, frame)}
      alt=""
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain opacity-70"
      style={{ width: size, height: size, maxWidth: "none", zIndex: -1, filter: tint }}
    />
  );
}
