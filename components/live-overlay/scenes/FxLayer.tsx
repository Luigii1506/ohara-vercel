"use client";

import { useEffect, useRef } from "react";

export type FxVariant = "coins" | "fireworks" | "manga";

type Props = {
  variant: FxVariant;
  durationMs?: number;
  onDone?: () => void;
};

// Paleta chroma-safe (sin verdes/teales).
const FIREWORK_COLORS = ["#ff2d6f", "#f5b301", "#ffffff", "#ff7a1a", "#7db3ff", "#c99bff"];
const DEFAULT_DURATION: Record<FxVariant, number> = {
  coins: 2800,
  fireworks: 2800,
  manga: 850,
};

const rnd = () => Math.random();
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Efectos one-shot en canvas puro (chroma-safe): monedas, fuegos artificiales y
 * líneas manga. Diseñados suaves y NO invasivos (glow suave, fades con easing,
 * pocas partículas, duración de un par de segundos).
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
    const W = parent?.clientWidth ?? 710;
    const H = parent?.clientHeight ?? 1265;
    canvas.width = W;
    canvas.height = H;

    const duration = durationMs ?? DEFAULT_DURATION[variant];

    // ---------------- COINS: lluvia dorada elegante ----------------
    type Coin = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      spin: number;
      spinV: number;
      wob: number;
      wobV: number;
    };
    const coins: Coin[] = [];
    if (variant === "coins") {
      for (let i = 0; i < 55; i += 1) {
        coins.push({
          x: rnd() * W,
          y: -40 - rnd() * H * 0.5,
          vx: (rnd() - 0.5) * 1,
          vy: 2.4 + rnd() * 3,
          size: 14 + rnd() * 12,
          spin: rnd() * Math.PI * 2,
          spinV: (rnd() - 0.5) * 0.16,
          wob: rnd() * Math.PI * 2,
          wobV: 0.03 + rnd() * 0.035,
        });
      }
    }

    // ---------------- FIREWORKS: estallidos con glow ----------------
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
    type Ring = { x: number; y: number; born: number; color: string };
    const fps: Fp[] = [];
    const rings: Ring[] = [];
    if (variant === "fireworks") {
      const bursts = 3;
      for (let b = 0; b < bursts; b += 1) {
        const cx = W * (0.28 + rnd() * 0.44);
        const cy = H * (0.2 + rnd() * 0.3);
        const born = b * 480 + rnd() * 120;
        const color = FIREWORK_COLORS[Math.floor(rnd() * FIREWORK_COLORS.length)];
        rings.push({ x: cx, y: cy, born, color });
        const n = 58;
        for (let k = 0; k < n; k += 1) {
          const a = (k / n) * Math.PI * 2 + rnd() * 0.08;
          // dos anillos de velocidad para un estallido más lleno
          const sp = (k % 2 === 0 ? 2.6 : 4.2) + rnd() * 1.4;
          fps.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            born,
            life: 1100 + rnd() * 500,
            color,
            size: 2 + rnd() * 2.4,
          });
        }
      }
    }

    // ---------------- MANGA: líneas de foco SOLO en los bordes ----------------
    type Line = { angle: number; w: number; len: number };
    const lines: Line[] = [];
    const mcx = W / 2;
    const mcy = H * 0.42;
    const maxR = Math.hypot(W, H) / 2 + 40;
    if (variant === "manga") {
      const N = 60;
      for (let i = 0; i < N; i += 1) {
        lines.push({
          angle: (i / N) * Math.PI * 2 + (rnd() - 0.5) * 0.05,
          w: 2 + rnd() * 5,
          len: 0.22 + rnd() * 0.16, // fracción del radio (banda exterior)
        });
      }
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = elapsed / duration;
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";

      if (variant === "coins") {
        const fade = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
        for (const c of coins) {
          c.vy += 0.05;
          c.wob += c.wobV;
          c.x += c.vx + Math.sin(c.wob) * 0.5;
          c.y += c.vy;
          c.spin += c.spinV;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(c.x, c.y);
          ctx.scale(Math.abs(Math.cos(c.spin)) * 0.85 + 0.15, 1);
          ctx.shadowColor = "rgba(245,179,1,0.9)";
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#f7c948";
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(150,100,10,0.6)";
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, c.size / 3.6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,238,170,0.9)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      } else if (variant === "fireworks") {
        // anillo de destello inicial
        for (const r of rings) {
          const local = elapsed - r.born;
          if (local < 0 || local > 420) continue;
          const p = local / 420;
          ctx.save();
          ctx.globalAlpha = (1 - p) * 0.8;
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 3 * (1 - p) + 0.5;
          ctx.shadowColor = r.color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(r.x, r.y, easeOut(p) * 70, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // partículas con glow
        ctx.save();
        for (const p of fps) {
          if (elapsed < p.born) continue;
          const local = elapsed - p.born;
          if (local > p.life) continue;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.045;
          p.vx *= 0.985;
          p.vy *= 0.985;
          const lp = local / p.life;
          const flick = lp > 0.55 ? 0.6 + 0.4 * Math.sin(local * 0.05) : 1;
          ctx.globalAlpha = Math.max(0, (1 - lp * lp)) * flick;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.restore();
      } else {
        // manga: banda de líneas en los bordes, centro limpio (no invasivo)
        const appear = easeOut(Math.min(1, t / 0.25));
        const fade = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
        const alpha = appear * fade * 0.8;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = "rgba(255,255,255,0.6)";
        ctx.shadowBlur = 6;
        for (const l of lines) {
          const dx = Math.cos(l.angle);
          const dy = Math.sin(l.angle);
          const outer = maxR;
          const inner = maxR * (1 - l.len * appear); // crece desde el borde hacia dentro
          ctx.lineWidth = l.w;
          ctx.beginPath();
          ctx.moveTo(mcx + dx * inner, mcy + dy * inner);
          ctx.lineTo(mcx + dx * outer, mcy + dy * outer);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
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
