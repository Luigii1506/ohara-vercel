"use client";

import { useEffect, useRef } from "react";

export type FxVariant = "coins" | "fireworks" | "manga";

type Props = {
  variant: FxVariant;
  durationMs?: number;
  onDone?: () => void;
};

// Paleta chroma-safe (sin verdes/teales).
const COLORS = ["#ff2d6f", "#f5b301", "#ffffff", "#ff7a1a", "#3b82f6", "#a855f7"];
const DEFAULT_DURATION: Record<FxVariant, number> = {
  coins: 3500,
  fireworks: 3000,
  manga: 1000,
};

const rnd = () => Math.random();

/**
 * Efectos one-shot en canvas puro (sin librerías/archivos, chroma-safe):
 * monedas cayendo, fuegos artificiales y líneas de acción manga.
 */
export default function FxLayer({ variant, durationMs, onDone }: Props) {
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

    const duration = durationMs ?? DEFAULT_DURATION[variant];

    // ---- COINS ----
    type Coin = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      spin: number;
      spinV: number;
    };
    const coins: Coin[] = [];
    if (variant === "coins") {
      for (let i = 0; i < 150; i += 1) {
        coins.push({
          x: rnd() * width,
          y: -20 - rnd() * height * 0.6,
          vx: (rnd() - 0.5) * 2,
          vy: 4 + rnd() * 6,
          size: 16 + rnd() * 16,
          spin: rnd() * Math.PI,
          spinV: (rnd() - 0.5) * 0.35,
        });
      }
    }

    // ---- FIREWORKS ----
    type Fp = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      born: number;
      life: number;
      color: string;
      size: number;
    };
    const fps: Fp[] = [];
    if (variant === "fireworks") {
      const bursts = 5;
      for (let b = 0; b < bursts; b += 1) {
        const cx = width * (0.18 + rnd() * 0.64);
        const cy = height * (0.14 + rnd() * 0.42);
        const born = b * 320 + rnd() * 160;
        const color = COLORS[Math.floor(rnd() * COLORS.length)];
        const n = 48;
        for (let k = 0; k < n; k += 1) {
          const a = (k / n) * Math.PI * 2 + rnd() * 0.12;
          const sp = 2.5 + rnd() * 5.5;
          fps.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            born,
            life: 850 + rnd() * 500,
            color,
            size: 2.5 + rnd() * 3,
          });
        }
      }
    }

    // ---- MANGA (speed lines) ----
    type Line = { angle: number; w: number; color: string };
    const lines: Line[] = [];
    const mcx = width / 2;
    const mcy = height * 0.42;
    const maxR = Math.hypot(width, height);
    if (variant === "manga") {
      const N = 66;
      for (let i = 0; i < N; i += 1) {
        const roll = rnd();
        lines.push({
          angle: (i / N) * Math.PI * 2 + (rnd() - 0.5) * 0.06,
          w: 6 + rnd() * 14,
          color: roll < 0.12 ? "#ffd766" : roll < 0.2 ? "#ff2d6f" : "#ffffff",
        });
      }
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      if (variant === "coins") {
        const fade = elapsed < duration * 0.72
          ? 1
          : Math.max(0, 1 - (elapsed - duration * 0.72) / (duration * 0.28));
        ctx.globalAlpha = fade;
        for (const c of coins) {
          c.vy += 0.15;
          c.x += c.vx;
          c.y += c.vy;
          c.spin += c.spinV;
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(Math.abs(Math.cos(c.spin)) * 0.9 + 0.12, 1);
          ctx.beginPath();
          ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#f5b301";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#a9760a";
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, c.size / 3.4, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffe486";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else if (variant === "fireworks") {
        ctx.globalAlpha = 1;
        for (const p of fps) {
          if (elapsed < p.born) continue;
          const local = elapsed - p.born;
          if (local > p.life) continue;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.06;
          p.vx *= 0.985;
          p.vy *= 0.985;
          ctx.globalAlpha = Math.max(0, 1 - local / p.life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // manga
        const p = elapsed / duration;
        const grow = Math.min(1, p / 0.35);
        const ease = 1 - Math.pow(1 - grow, 3);
        const alpha =
          p < 0.15 ? p / 0.15 : p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
        ctx.globalAlpha = alpha;
        for (const l of lines) {
          const rin = maxR * 0.2 * (1 - ease);
          const dx = Math.cos(l.angle);
          const dy = Math.sin(l.angle);
          ctx.beginPath();
          ctx.moveTo(mcx + dx * rin, mcy + dy * rin);
          ctx.lineTo(mcx + dx * maxR, mcy + dy * maxR);
          ctx.lineWidth = l.w;
          ctx.strokeStyle = l.color;
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        onDoneRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [variant, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[60] h-full w-full"
    />
  );
}
