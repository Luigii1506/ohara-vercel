"use client";

import { useEffect, useRef } from "react";

export type FxVariant = "coins" | "fireworks" | "bubbles";

type Props = {
  variant: FxVariant;
  durationMs?: number;
  onDone?: () => void;
};

const FIREWORK_COLORS = ["#ff2d6f", "#f5b301", "#ffffff", "#ff7a1a", "#7db3ff", "#c99bff"];
const BUBBLE_COLORS = ["rgba(180,220,255,", "rgba(255,255,255,", "rgba(255,190,225,", "rgba(200,235,255,"];
const DEFAULT_DURATION: Record<FxVariant, number> = {
  coins: 2800,
  fireworks: 2800,
  bubbles: 3600,
};

const rnd = () => Math.random();
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Sprite de moneda con glow horneado (se dibuja 1 vez, luego drawImage → rápido). */
const makeCoinSprite = (): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const s = document.createElement("canvas");
  s.width = 80;
  s.height = 80;
  const c = s.getContext("2d");
  if (!c) return null;
  const glow = c.createRadialGradient(40, 40, 8, 40, 40, 40);
  glow.addColorStop(0, "rgba(245,179,1,0.45)");
  glow.addColorStop(1, "rgba(245,179,1,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, 80, 80);
  const body = c.createRadialGradient(33, 33, 4, 40, 40, 22);
  body.addColorStop(0, "#ffe9a8");
  body.addColorStop(1, "#e0a41a");
  c.beginPath();
  c.arc(40, 40, 21, 0, Math.PI * 2);
  c.fillStyle = body;
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = "rgba(150,100,10,0.7)";
  c.stroke();
  c.beginPath();
  c.arc(40, 40, 12, 0, Math.PI * 2);
  c.strokeStyle = "rgba(255,240,180,0.9)";
  c.lineWidth = 2;
  c.stroke();
  return s;
};

/**
 * Efectos one-shot en canvas puro (chroma-safe): monedas (sprite, sin lag),
 * fuegos artificiales (con glow) y burbujas (aros → centro transparente que se
 * ve en el stream). Suaves, no invasivos, ~3s.
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

    // ---- COINS ----
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
    const coinSprite = variant === "coins" ? makeCoinSprite() : null;
    if (variant === "coins") {
      for (let i = 0; i < 50; i += 1) {
        coins.push({
          x: rnd() * W,
          y: -40 - rnd() * H * 0.5,
          vx: (rnd() - 0.5) * 1,
          vy: 2.6 + rnd() * 3,
          size: 15 + rnd() * 12,
          spin: rnd() * Math.PI * 2,
          spinV: (rnd() - 0.5) * 0.16,
          wob: rnd() * Math.PI * 2,
          wobV: 0.03 + rnd() * 0.035,
        });
      }
    }

    // ---- FIREWORKS ----
    type Fp = {
      x: number; y: number; vx: number; vy: number;
      born: number; life: number; color: string; size: number;
    };
    type Ring = { x: number; y: number; born: number; color: string };
    const fps: Fp[] = [];
    const rings: Ring[] = [];
    if (variant === "fireworks") {
      for (let b = 0; b < 3; b += 1) {
        const cx = W * (0.28 + rnd() * 0.44);
        const cy = H * (0.2 + rnd() * 0.3);
        const born = b * 480 + rnd() * 120;
        const color = FIREWORK_COLORS[Math.floor(rnd() * FIREWORK_COLORS.length)];
        rings.push({ x: cx, y: cy, born, color });
        const n = 58;
        for (let k = 0; k < n; k += 1) {
          const a = (k / n) * Math.PI * 2 + rnd() * 0.08;
          const sp = (k % 2 === 0 ? 2.6 : 4.2) + rnd() * 1.4;
          fps.push({
            x: cx, y: cy,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            born, life: 1100 + rnd() * 500, color, size: 2 + rnd() * 2.4,
          });
        }
      }
    }

    // ---- BUBBLES (aros con centro transparente; aparecen por TODA la pantalla) ----
    type Bubble = {
      x: number; y: number; vx: number; vy: number; size: number;
      wob: number; wobV: number; sway: number; born: number; color: string;
    };
    const bubbles: Bubble[] = [];
    if (variant === "bubbles") {
      for (let i = 0; i < 42; i += 1) {
        bubbles.push({
          // repartidas por todo el lienzo (y un poco fuera) → salen de todos lados
          x: -40 + rnd() * (W + 80),
          y: -40 + rnd() * (H + 80),
          vx: (rnd() - 0.5) * 1,
          vy: -(0.15 + rnd() * 0.9), // deriva suave hacia arriba
          size: 10 + rnd() * 30,
          wob: rnd() * Math.PI * 2,
          wobV: 0.015 + rnd() * 0.025,
          sway: 6 + rnd() * 16,
          born: rnd() * 900, // aparición escalonada
          color: BUBBLE_COLORS[Math.floor(rnd() * BUBBLE_COLORS.length)],
        });
      }
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = elapsed / duration;
      ctx.clearRect(0, 0, W, H);

      if (variant === "coins") {
        const fade = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
        ctx.globalAlpha = fade;
        for (const c of coins) {
          c.vy += 0.05;
          c.wob += c.wobV;
          c.x += c.vx + Math.sin(c.wob) * 0.5;
          c.y += c.vy;
          c.spin += c.spinV;
          if (!coinSprite) continue;
          const draw = c.size * 2.4;
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.scale(Math.abs(Math.cos(c.spin)) * 0.9 + 0.1, 1);
          ctx.drawImage(coinSprite, -draw / 2, -draw / 2, draw, draw);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else if (variant === "fireworks") {
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
        ctx.save();
        for (const p of fps) {
          if (elapsed < p.born) continue;
          const local = elapsed - p.born;
          if (local > p.life) continue;
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.045; p.vx *= 0.985; p.vy *= 0.985;
          const lp = local / p.life;
          const flick = lp > 0.55 ? 0.6 + 0.4 * Math.sin(local * 0.05) : 1;
          ctx.globalAlpha = Math.max(0, 1 - lp * lp) * flick;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.restore();
      } else {
        // bubbles: aparecen por toda la pantalla, flotan y se desvanecen
        const outFade = t < 0.82 ? 1 : Math.max(0, 1 - (t - 0.82) / 0.18);
        for (const b of bubbles) {
          const local = elapsed - b.born;
          if (local < 0) continue;
          b.wob += b.wobV;
          b.x += b.vx;
          b.y += b.vy;
          const x = b.x + Math.sin(b.wob) * b.sway;
          const fadeIn = Math.min(1, local / 350);
          const a = 0.55 * fadeIn * outFade;
          if (a <= 0.01) continue;
          ctx.lineWidth = Math.max(1.5, b.size * 0.07);
          ctx.strokeStyle = `${b.color}${a})`;
          ctx.beginPath();
          ctx.arc(x, b.y, b.size, 0, Math.PI * 2);
          ctx.stroke();
          // brillo (arco superior-izquierdo)
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * fadeIn * outFade})`;
          ctx.lineWidth = Math.max(1, b.size * 0.06);
          ctx.beginPath();
          ctx.arc(x, b.y, b.size * 0.72, Math.PI * 1.05, Math.PI * 1.5);
          ctx.stroke();
        }
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
