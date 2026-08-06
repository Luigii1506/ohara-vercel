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
    // Contenedor a pantalla completa (gutter oscuro para preview en navegador).
    // En OBS pon la Browser Source EXACTAMENTE a 710×1265 y el lienzo la llena.
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      {/* Lienzo FIJO 710×1265 (vertical) — fondo verde chroma-key. */}
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden bg-[#28ce2b]">
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

      {/* Carta en vivo (opcional): centrada, un poco hacia arriba. */}
      {state.currentCard ? (
        <div className="absolute inset-x-0 top-[42%] flex -translate-y-1/2 flex-col items-center gap-4 px-8">
          {state.currentCard.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.currentCard.imageUrl}
              alt={state.currentCard.code}
              className="w-[340px] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
            />
          ) : null}
          <div className="w-full max-w-[600px] rounded-2xl bg-black/80 px-6 py-5 text-center text-white backdrop-blur">
            {/* Código en grande */}
            <div className="text-5xl font-black leading-none tracking-tight">
              {state.currentCard.code}
            </div>
            {/* Rareza y arte */}
            {state.currentCard.rarity || state.currentCard.alternateArt ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-lg font-bold uppercase tracking-wide text-amber-300">
                {state.currentCard.rarity ? (
                  <span>{state.currentCard.rarity}</span>
                ) : null}
                {state.currentCard.alternateArt ? (
                  <span>· {state.currentCard.alternateArt}</span>
                ) : null}
              </div>
            ) : null}
            {/* Precio (Listed Median) */}
            {state.currentCard.price != null ? (
              <div className="mt-3">
                <span className="text-5xl font-black text-emerald-400">
                  $
                  {Number(state.currentCard.price).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="ml-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                  Listed Median
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
