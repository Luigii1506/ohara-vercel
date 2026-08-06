"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";

type OverlayCanvasClientProps = {
  token: string;
};

const EMPTY_STATE: LiveOverlayState = {
  currentCard: null,
  rarityCounters: LIVE_OVERLAY_RARITY_COUNTER_KEYS.reduce(
    (accumulator, key) => {
      accumulator[key] = 0;
      return accumulator;
    },
    {} as LiveOverlayState["rarityCounters"]
  ),
  updatedAt: new Date(0).toISOString(),
};

export default function OverlayCanvasClient({ token }: OverlayCanvasClientProps) {
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);

  // Polling del estado cada 2s (Vercel serverless no soporta WebSockets; el
  // estado vive en Postgres).
  const loadState = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/live-overlay/state?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to load overlay state");
      const data = await response.json();
      setState(data.state ?? EMPTY_STATE);
    } catch (error) {
      console.error("[overlay] failed to load state:", error);
    }
  }, [token]);

  useEffect(() => {
    loadState();
    const interval = window.setInterval(loadState, 2000);
    return () => window.clearInterval(interval);
  }, [loadState]);

  const activeCounters = LIVE_OVERLAY_RARITY_COUNTER_KEYS.filter(
    (rarity) => state.rarityCounters[rarity] > 0
  );

  return (
    // Lienzo 710×1265 (vertical) para OBS. Fondo verde chroma-key.
    <div className="relative h-screen w-full overflow-hidden bg-[#28ce2b]">
      {/* Contadores de rareza: píldoras pegadas al borde izquierdo */}
      <div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-4">
        {activeCounters.map((rarity) => (
          <div
            key={rarity}
            className="-ml-10 flex items-center gap-4 rounded-full border-[4px] border-cyan-400 bg-black py-2.5 pl-14 pr-7 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
          >
            <span className="text-4xl font-black uppercase leading-none tracking-tight text-white">
              {rarity}
            </span>
            <span className="text-5xl font-black leading-none text-[#ff2d6f]">
              {state.rarityCounters[rarity]}
            </span>
          </div>
        ))}
      </div>

      {/* Carta en vivo (opcional): franja inferior */}
      {state.currentCard ? (
        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4 px-8">
          {state.currentCard.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.currentCard.imageUrl}
              alt={state.currentCard.name}
              className="w-[320px] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
            />
          ) : null}
          <div className="w-full max-w-[600px] rounded-2xl bg-black/80 px-6 py-4 text-center text-white backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
              <span>{state.currentCard.code}</span>
              {state.currentCard.rarity ? (
                <span>· {state.currentCard.rarity}</span>
              ) : null}
              {state.currentCard.alternateArt ? (
                <span>· {state.currentCard.alternateArt}</span>
              ) : null}
            </div>
            <div className="mt-1 text-3xl font-black leading-tight">
              {state.currentCard.name}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
