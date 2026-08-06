"use client";

import { useEffect, useRef } from "react";

type ConfettiLayerProps = {
  /** Duración de la ráfaga en ms (después se detiene y limpia). */
  durationMs?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shape: "rect" | "circle";
};

// Paleta temática (One Piece / Ohara): rojo, dorado, teal, blanco, rosa.
const COLORS = ["#ff2d6f", "#f5b301", "#12b5a5", "#ffffff", "#ff7a1a", "#3b82f6"];

/**
 * Ráfaga de confeti one-shot. Se monta con `key={triggeredAt}` desde el overlay,
 * así corre una sola vez por disparo. Canvas puro (sin librerías externas) para
 * cumplir el CSP del overlay.
 */
export default function ConfettiLayer({ durationMs = 4500 }: ConfettiLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    const particleCount = 220;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i += 1) {
      // Dos "cañones" desde arriba a los lados + lluvia general.
      const fromLeft = i % 2 === 0;
      particles.push({
        x: fromLeft ? width * 0.15 : width * 0.85,
        y: height * 0.12 + Math.random() * height * 0.1,
        vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 4),
        vy: -4 - Math.random() * 6,
        size: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }

    const gravity = 0.16;
    const drag = 0.995;
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const fadeStart = durationMs * 0.6;
      const alpha =
        elapsed < fadeStart
          ? 1
          : Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart));

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = alpha;

      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
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
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
