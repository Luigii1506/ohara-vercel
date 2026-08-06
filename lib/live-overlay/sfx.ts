"use client";

/**
 * SFX sintetizados con Web Audio API — CERO archivos, cero licencias, CSP-safe.
 * El overlay corre como Browser Source en OBS/TikTok, que captura el audio de
 * la página, así que estos sonidos se escuchan en el stream.
 */

export const LIVE_OVERLAY_SFX = [
  { id: "coin", label: "Moneda", emoji: "🪙" },
  { id: "ding", label: "Ding", emoji: "🔔" },
  { id: "levelup", label: "Level up", emoji: "⬆️" },
  { id: "pop", label: "Pop", emoji: "🫧" },
  { id: "whoosh", label: "Whoosh", emoji: "💨" },
  { id: "alert", label: "Alerta", emoji: "🚨" },
] as const;

export type LiveOverlaySfxId = (typeof LIVE_OVERLAY_SFX)[number]["id"];

let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

/** Desbloquea el audio tras el primer gesto (para preview en navegador). */
export const unlockOverlayAudio = () => {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
};

// Una nota simple con envolvente ADSR corta.
const tone = (
  ctx: AudioContext,
  {
    freq,
    start,
    duration,
    type = "sine",
    gain = 0.25,
  }: {
    freq: number;
    start: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
  }
) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
};

// Ruido filtrado (para whoosh).
const noiseSweep = (ctx: AudioContext, start: number, duration: number) => {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, start);
  filter.frequency.exponentialRampToValueAtTime(3500, start + duration);
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(start);
  src.stop(start + duration + 0.02);
};

/** Reproduce un SFX por id. Seguro de llamar en cada disparo. */
export const playOverlaySfx = (id: string) => {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  switch (id) {
    case "coin":
      tone(ctx, { freq: 988, start: t, duration: 0.08, type: "square", gain: 0.2 });
      tone(ctx, { freq: 1319, start: t + 0.08, duration: 0.18, type: "square", gain: 0.2 });
      break;
    case "ding":
      tone(ctx, { freq: 1568, start: t, duration: 0.5, type: "sine", gain: 0.3 });
      tone(ctx, { freq: 2093, start: t, duration: 0.5, type: "sine", gain: 0.12 });
      break;
    case "levelup":
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(ctx, { freq: f, start: t + i * 0.09, duration: 0.18, type: "square", gain: 0.18 })
      );
      break;
    case "pop":
      tone(ctx, { freq: 660, start: t, duration: 0.12, type: "sine", gain: 0.3 });
      break;
    case "whoosh":
      noiseSweep(ctx, t, 0.4);
      break;
    case "alert":
      tone(ctx, { freq: 880, start: t, duration: 0.15, type: "sawtooth", gain: 0.2 });
      tone(ctx, { freq: 660, start: t + 0.16, duration: 0.15, type: "sawtooth", gain: 0.2 });
      tone(ctx, { freq: 880, start: t + 0.32, duration: 0.2, type: "sawtooth", gain: 0.2 });
      break;
    default:
      tone(ctx, { freq: 880, start: t, duration: 0.15, type: "sine", gain: 0.25 });
  }
};
