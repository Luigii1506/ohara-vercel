"use client";

import { useCallback, useRef, useState } from "react";

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
 * Recortador de video: reproduce el clip, barra con la duración y dos manijas
 * arrastrables (inicio/fin), botón para escuchar SOLO la selección y ajuste fino.
 */
export default function VideoTrimmer({
  url,
  start,
  end,
  onChange,
  onDuration,
}: Props) {
  const videoRef = useRef<HTMLMediaElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isAudio = /\.(mp3|m4a|ogg|wav|aac)(\?|#|$)/i.test(url);
  const dragging = useRef<null | "start" | "end">(null);
  const raf = useRef<number | undefined>(undefined);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const dur = duration || 0;
  const startPct = dur ? (start / dur) * 100 : 0;
  const endPct = dur ? (end / dur) * 100 : 0;

  const applyDuration = useCallback(
    (d: number) => {
      setDuration(d);
      onDuration?.(d);
      if (!end || end <= 0 || end > d) onChange(Math.min(start, d), d);
    },
    [end, start, onChange, onDuration]
  );

  // La duración a veces llega Infinity/0 cuando el server no soporta rangos.
  // Truco: saltar a un tiempo enorme fuerza al navegador a calcular la duración.
  const onLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    if (Number.isFinite(d) && d > 0) {
      applyDuration(d);
      return;
    }
    const onDurChange = () => {
      const dd = v.duration;
      if (Number.isFinite(dd) && dd > 0) {
        v.removeEventListener("durationchange", onDurChange);
        try {
          v.currentTime = 0;
        } catch {
          // ignore
        }
        applyDuration(dd);
      }
    };
    v.addEventListener("durationchange", onDurChange);
    try {
      v.currentTime = 1e101;
    } catch {
      // ignore
    }
  }, [applyDuration]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || !dur) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * dur;
    },
    [dur]
  );

  // Captura del puntero EN la manija → los pointermove llegan a la manija.
  const startDrag = (which: "start" | "end") => (e: React.PointerEvent) => {
    dragging.current = which;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragging.current || !dur) return;
    const t = timeFromClientX(e.clientX);
    if (dragging.current === "start") {
      onChange(Math.min(t, end - 0.05), end);
    } else {
      onChange(start, Math.max(t, start + 0.05));
    }
  };
  const endDrag = () => {
    dragging.current = null;
  };

  const stopLoop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = undefined;
  };
  const playSelection = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    try {
      v.currentTime = start;
    } catch {
      // ignore
    }
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

  const nudge = (which: "start" | "end", delta: number) => {
    if (which === "start") {
      onChange(Math.min(Math.max(0, start + delta), end - 0.05), end);
    } else {
      onChange(start, Math.max(Math.min(dur || end, end + delta), start + 0.05));
    }
  };

  return (
    <div className="space-y-2">
      {isAudio ? (
        <div className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-4 text-white">
          <span className="text-3xl">🔊</span>
          <span className="text-sm font-semibold">Audio</span>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={(el) => {
              videoRef.current = el;
            }}
            src={url}
            onLoadedMetadata={onLoaded}
            onError={() =>
              setErr(
                "No se pudo cargar el audio. Verifica la URL y que el worker sirva mp3 con CORS."
              )
            }
            preload="metadata"
          />
        </div>
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={(el) => {
            videoRef.current = el;
          }}
          src={url}
          onLoadedMetadata={onLoaded}
          onError={() =>
            setErr(
              "No se pudo cargar el video. Verifica la URL y que el worker sirva mp4/webm con CORS."
            )
          }
          preload="metadata"
          playsInline
          className="max-h-44 w-full rounded-lg bg-black object-contain"
        />
      )}
      {err ? (
        <p className="text-[11px] font-semibold text-rose-600">{err}</p>
      ) : null}

      {/* Barra de tiempo con región + manijas */}
      <div
        ref={trackRef}
        className="relative h-9 w-full select-none rounded-lg bg-slate-200"
      >
        <div
          className="absolute top-0 h-full rounded-lg bg-amber-300/70"
          style={{
            left: `${startPct}%`,
            width: `${Math.max(0, endPct - startPct)}%`,
          }}
        />
        {playing ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-rose-600"
            style={{ left: `${dur ? (playhead / dur) * 100 : 0}%` }}
          />
        ) : null}
        <div
          onPointerDown={startDrag("start")}
          onPointerMove={onHandleMove}
          onPointerUp={endDrag}
          onLostPointerCapture={endDrag}
          className="absolute top-1/2 z-10 h-10 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded bg-slate-900 shadow ring-2 ring-white"
          style={{ left: `${startPct}%` }}
        />
        <div
          onPointerDown={startDrag("end")}
          onPointerMove={onHandleMove}
          onPointerUp={endDrag}
          onLostPointerCapture={endDrag}
          className="absolute top-1/2 z-10 h-10 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded bg-slate-900 shadow ring-2 ring-white"
          style={{ left: `${endPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={playing ? pause : playSelection}
          disabled={!dur}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white active:bg-slate-800 disabled:opacity-40"
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
