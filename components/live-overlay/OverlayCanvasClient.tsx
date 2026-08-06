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
  const [isConnected, setIsConnected] = useState(false);

  // Polling del estado (Vercel serverless no soporta WebSockets; el estado vive
  // en Postgres). El indicador refleja si el último poll tuvo éxito.
  const loadState = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/live-overlay/state?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to load overlay state");
      const data = await response.json();
      setState(data.state ?? EMPTY_STATE);
      setIsConnected(true);
    } catch (error) {
      setIsConnected(false);
      console.error("[overlay] failed to load state:", error);
    }
  }, [token]);

  useEffect(() => {
    loadState();
    const interval = window.setInterval(loadState, 2000);
    return () => window.clearInterval(interval);
  }, [loadState]);

  return (
    <div className="min-h-screen w-full bg-[#28ce2b]">
      <div className="relative flex min-h-screen items-end justify-between overflow-hidden p-8">
        <div className="relative flex max-w-4xl items-end gap-6">
          {state.currentCard ? (
            <>
              <div className="w-[240px] shrink-0 overflow-hidden rounded-[28px] border border-white/15 bg-black/45 shadow-[0_24px_90px_-35px_rgba(0,0,0,0.85)] backdrop-blur-md">
                {state.currentCard.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.currentCard.imageUrl}
                    alt={state.currentCard.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2.5/3.5] items-center justify-center text-xs uppercase tracking-[0.24em] text-white/40">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 rounded-[34px] border border-white/12 bg-[linear-gradient(135deg,_rgba(15,23,42,0.92)_0%,_rgba(30,41,59,0.88)_42%,_rgba(146,64,14,0.88)_100%)] px-7 py-6 text-white shadow-[0_24px_90px_-35px_rgba(0,0,0,0.85)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/90">
                  <span>{state.currentCard.code}</span>
                  {state.currentCard.rarity ? <span>{state.currentCard.rarity}</span> : null}
                  {state.currentCard.alternateArt ? (
                    <span>{state.currentCard.alternateArt}</span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-4xl font-black leading-tight drop-shadow-sm md:text-5xl">
                  {state.currentCard.name}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/75">
                  {state.currentCard.setTitle ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {state.currentCard.setTitle}
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[30px] border border-white/10 bg-black/45 px-6 py-5 text-white/70 shadow-[0_24px_90px_-35px_rgba(0,0,0,0.85)] backdrop-blur-md">
              <div className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200/80">
                Ohara Live Overlay
              </div>
              <div className="mt-2 text-2xl font-black text-white">
                Esperando una carta...
              </div>
            </div>
          )}

        </div>

        <div className="ml-8 w-[520px] rounded-[30px] border border-white/12 bg-black/55 px-6 py-5 text-white shadow-[0_24px_90px_-35px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
              Rarity Counters
            </div>
            <div
              className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
                isConnected ? "text-emerald-300/80" : "text-rose-300/80"
              }`}
            >
              {isConnected ? "Live connected" : "Reconnecting"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
              <div
                key={rarity}
                className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-center"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                  {rarity}
                </div>
                <div className="mt-2 text-5xl font-black leading-none text-amber-300">
                  {state.rarityCounters[rarity]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
