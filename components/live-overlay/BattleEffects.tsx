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
      frameCount: number;
      frameWidth: number;
      frameHeight: number;
      displaySize: number;
      fps: number;
    }
  | { mode: "static"; src: string; width: number; height: number };

const pad4 = (i: number) => String(i).padStart(4, "0");

/** Un golpe de impacto genérico (hit/aoe/pierce) — sheet de 7 frames. */
const HIT_SHEET: BattleEffectDef = {
  mode: "sheet",
  src: `${BASE}/hit/Hit Effect 01 1.png`,
  cols: 7,
  frameCount: 7,
  frameWidth: 48,
  frameHeight: 48,
  displaySize: 90,
  fps: 24,
};

const FIRE: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/fire/fire_1f_40_${i + 1}.png`,
  frameCount: 40,
  width: 70,
  height: 106,
  fps: 30,
};

const ICE: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/ice/Ice VFX 1/Separated Frames/VFX 1 Hit${i + 1}.png`,
  frameCount: 8,
  width: 96,
  height: 64,
  fps: 20,
};

const EXPLOSION: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/explosion/blue-ring-explosion-39frames/Blue Ring Explosion${i + 1}.png`,
  // La carpeta se llama "39frames" pero el pack real solo trae 19 (confirmado
  // contra el GIF fuente) — usar 39 aquí hacía que la animación intentara
  // cargar frames inexistentes (404 → ícono de imagen rota a mitad de la
  // explosión).
  frameCount: 19,
  width: 160,
  height: 160,
  fps: 24,
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

const LIGHTNING: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/lightning/oga-bonus-lightning-animation-11frames/${i}.png`,
  frameCount: 11,
  width: 130,
  height: 65,
  fps: 24,
};

/** El pack de explosión disponible es un anillo AZUL — se tiñe a naranja/fuego
 * para que "nuke" se lea como explosión y no como un efecto de hielo. */
export const EXPLOSION_TINT = "hue-rotate(180deg) saturate(2.2) brightness(1.15)";

const POISON_BURST: BattleEffectDef = {
  mode: "frames",
  frame: (i) => `${BASE}/poison/${pad4(i)}.png`,
  frameCount: 30,
  width: 90,
  height: 90,
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
  aoe: HIT_SHEET,
  pierce: HIT_SHEET,
  chain: LIGHTNING,
  nuke: EXPLOSION,
  burn: FIRE,
  freeze: ICE,
  poison: POISON_BURST,
  heal: HEAL_SHEET,
  healAll: HEAL_SHEET,
  growMaxHp: STARBURST,
  knockback: WIND_STATIC,
};

/** Reproduce un efecto UNA vez en una posición fija (% de la arena) y se auto-destruye. */
export function PowerEffectView({
  def,
  onDone,
  tint,
}: {
  def: BattleEffectDef;
  onDone: () => void;
  tint?: string;
}) {
  const [frame, setFrame] = useState(0);
  const frameCount = def.mode === "static" ? 1 : def.frameCount;
  const fps = def.mode === "static" ? 2 : def.fps;

  useEffect(() => {
    const durationMs = def.mode === "static" ? 500 : Math.ceil((frameCount / fps) * 1000);
    const doneTimer = window.setTimeout(onDone, durationMs);
    if (def.mode === "static") return () => window.clearTimeout(doneTimer);
    const interval = window.setInterval(() => {
      setFrame((f) => Math.min(f + 1, frameCount - 1));
    }, 1000 / fps);
    return () => {
      window.clearTimeout(doneTimer);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const scale = def.displaySize / def.frameHeight;
    const sheetWidth = def.frameWidth * def.frameCount * scale;
    const sheetHeight = def.frameHeight * scale;
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
          backgroundPosition: `-${frame * def.frameWidth * scale}px 0px`,
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
