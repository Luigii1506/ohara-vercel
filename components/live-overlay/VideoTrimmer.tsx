"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onDuration?: (duration: number) => void;
};

const fmt = (t: number) => {
  if (!Number.isFinite(t)) return "0:00.00";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

/**
 * Recortador de video: reproduce el clip, muestra la barra con la duración y dos
 * manijas (inicio/fin) arrastrables, con botón para escuchar SOLO la selección y
 * ajuste fino milimétrico.
 */
export default function VideoTrimmer({
  url,
  start,
  end,
  onChange,
  onDuration,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<null | "start" | "end">(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  const dur = duration || 0;
  const startPct = dur ? (start / dur) * 100 : 0;
  const endPct = dur ? (end / dur) * 100 : 100;

  const onLoaded = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
      onDuration?.(d);
      // Si aún no hay fin definido, usa el final del video.
      if (!end || end <= 0 || end > d) onChange(Math.min(start, d), d);
    }
  }, [end, start, onChange, onDuration]);

  // Arrastre de manijas.
  const timeFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !dur) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * dur;
  }, [dur]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const t = timeFromClientX(e.clientX);
      if (dragging.current === "start") {
        onChange(Math.min(t, end - 0.05), end);
      } else {
        onChange(start, Math.max(t, start + 0.05));
      }
    },
    [end, start, onChange, timeFromClientX]
  );

  const startDrag = (which: "start" | "end") => (e: React.PointerEvent) => {
    dragging.current = which;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const endDrag = () => {
    dragging.current = null;
  };

  // Reproduce solo la selección.
  const stopLoop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = undefined;
  };
  const playSelection = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = start;
    v.play().catch(() => {});
    setPlaying(true);
    const tick = () => {
      const cur = v.currentTime;
      setPlayhead(cur);
      if (cur >= end) {
        v.pause();
        setPlaying(false);
        stopLoop();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    stopLoop();
    raf.current = requestAnimationFrame(tick);
  }, [start, end]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setPlaying(false);
    stopLoop();
  }, []);

  useEffect(() => () => stopLoop(), []);

  const nudge = (which: "start" | "end", delta: number) => {
    if (which === "start") {
      onChange(Math.min(Math.max(0, start + delta), end - 0.05), end);
    } else {
      onChange(start, Math.max(Math.min(dur || end, end + delta), start + 0.05));
    }
  };

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={url}
        onLoadedMetadata={onLoaded}
        playsInline
        className="max-h-40 w-full rounded-lg bg-black object-contain"
      />

      {/* Barra de tiempo con región + manijas */}
      <div
        ref={trackRef}
        className="relative h-9 w-full select-none rounded-lg bg-slate-200"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        {/* región seleccionada */}
        <div
          className="absolute top-0 h-full rounded-lg bg-amber-300/70"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        {/* playhead */}
        {playing ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-rose-600"
            style={{ left: `${dur ? (playhead / dur) * 100 : 0}%` }}
          />
        ) : null}
        {/* manija inicio */}
        <div
          onPointerDown={startDrag("start")}
          className="absolute top-1/2 z-10 h-9 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded bg-slate-900 shadow"
          style={{ left: `${startPct}%` }}
        />
        {/* manija fin */}
        <div
          onPointerDown={startDrag("end")}
          className="absolute top-1/2 z-10 h-9 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded bg-slate-900 shadow"
          style={{ left: `${endPct}%` }}
        />
      </div>

      {/* Controles y tiempos */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={playing ? pause : playSelection}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white active:bg-slate-800"
        >
          {playing ? "⏸ Pausar" : "▶ Escuchar selección"}
        </button>
        <span className="text-[11px] font-semibold tabular-nums text-slate-500">
          dur {fmt(dur)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        {(["start", "end"] as const).map((which) => (
          <div
            key={which}
            className="rounded-lg border border-slate-200 bg-white p-2"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">
              {which === "start" ? "Inicio" : "Fin"}
            </div>
            <div className="text-sm font-black tabular-nums text-slate-900">
              {fmt(which === "start" ? start : end)}
            </div>
            <div className="mt-1 flex justify-center gap-1">
              {[-0.1, -0.02, 0.02, 0.1].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => nudge(which, d)}
                  className="h-7 min-w-9 rounded bg-slate-100 px-1 text-[11px] font-bold text-slate-700 active:bg-slate-200"
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
