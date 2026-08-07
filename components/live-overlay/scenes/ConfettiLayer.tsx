"use client";

import { useEffect, useRef } from "react";

type ConfettiLayerProps = {
  /** Duración de la ráfaga en ms (después se detiene y limpia). */
  durationMs?: number;
  /** Se llama una vez cuando la ráfaga termina su transición. */
  onDone?: () => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  wobble: number;
  wobbleSpeed: number;
  color: string;
  shape: "rect" | "circle";
};

// Paleta temática (One Piece / Ohara). IMPORTANTE: el overlay va sobre fondo
// verde chroma (#28ce2b) que TikTok/OBS vuelve transparente, así que NADA de
// verdes/teales o el chroma key se comería esas partículas. Rojo, dorado,
// blanco, naranja, azul, morado, rosa — todos lejos del verde.
const COLORS = [
  "#ff2d6f",
  "#f5b301",
  "#ffffff",
  "#ff7a1a",
  "#3b82f6",
  "#a855f7",
];

/**
 * Ráfaga de confeti one-shot. Se monta con `key={triggeredAt}` desde el overlay,
 * así corre una sola vez por disparo. Canvas puro (sin librerías externas) para
 * cumplir el CSP del overlay.
 */
export default function ConfettiLayer({
  durationMs = 4500,
  onDone,
}: ConfettiLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 710;
    const height = parent?.clientHeight ?? 1265;
    canvas.width = width;
    canvas.height = height;

    const particleCount = 260;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i += 1) {
      // Dos CAÑONES en los LADOS a media-baja altura (no en el borde inferior),
      // disparando en diagonal hacia arriba y al centro. Modelo canvas-confetti:
      // velocidad de disparo ALTA que se frena por resistencia del aire (drag) y
      // luego cae flotando (gravedad). El origen está a ~58% de alto.
      const fromLeft = i % 2 === 0;
      const angle = (55 + Math.random() * 35) * (Math.PI / 180); // 55°–90° sobre horizontal
      const speed = 21 + Math.random() * 15; // 21–36 (disparo fuerte)
      particles.push({
        x: fromLeft ? -8 : width + 8,
        y: height * 0.58 + (Math.random() - 0.5) * 70,
        vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
        vy: -Math.sin(angle) * speed,
        size: 7 + Math.random() * 9,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.35,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.06,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }

    // drag = resistencia del aire (frena el disparo rápido → el "pop"); gravity
    // acelera la caída. Velocidad terminal ≈ gravity/(1-drag).
    const gravity = 0.35;
    const drag = 0.93;
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const fadeStart = durationMs * 0.72;
      const alpha =
        elapsed < fadeStart
          ? 1
          : Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart));

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = alpha;

      for (const p of particles) {
        // Resistencia del aire en el disparo, luego gravedad domina (caída).
        p.vx *= drag;
        p.vy *= drag;
        p.vy += gravity;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.8; // aleteo horizontal
        p.y += p.vy;
        p.rot += p.vrot;

        // Efecto de "papel" que voltea: escala horizontal según el wobble.
        const flip = Math.cos(p.wobble);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, flip);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        onDoneRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[60] h-full w-full"
    />
  );
}
