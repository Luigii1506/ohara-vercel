"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveOverlayMessage, LiveOverlayState } from "@/lib/live-overlay/types";

type OverlayCanvasClientProps = {
  token: string;
};

const EMPTY_STATE: LiveOverlayState = {
  currentCard: null,
  counter: 0,
  updatedAt: new Date(0).toISOString(),
};

const buildWebSocketUrl = (token: string) => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/live-overlay/socket?token=${encodeURIComponent(
    token
  )}`;
};

export default function OverlayCanvasClient({ token }: OverlayCanvasClientProps) {
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const loadState = useCallback(async () => {
    const response = await fetch(
      `/api/live-overlay/state?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Failed to load overlay state");
    }

    const data = await response.json();
    setState(data.state ?? EMPTY_STATE);
  }, [token]);

  useEffect(() => {
    loadState().catch((error) => {
      console.error("[overlay] failed to load state:", error);
    });
  }, [loadState]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        await fetch("/api/live-overlay/socket", { cache: "no-store" });
      } catch (error) {
        console.error("[overlay] failed to initialize socket route:", error);
      }

      if (cancelled) return;

      socket = new WebSocket(buildWebSocketUrl(token));

      socket.addEventListener("open", () => {
        setIsConnected(true);
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as LiveOverlayMessage;
          if (payload.type === "connected" || payload.type === "state") {
            setState(payload.state);
          }
        } catch (error) {
          console.error("[overlay] invalid websocket payload:", error);
        }
      });

      socket.addEventListener("close", () => {
        setIsConnected(false);
        if (cancelled) return;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect().catch((error) => {
            console.error("[overlay] reconnect failed:", error);
          });
        }, 1200);
      });

      socket.addEventListener("error", (error) => {
        console.error("[overlay] websocket error:", error);
      });
    };

    connect().catch((error) => {
      console.error("[overlay] websocket setup failed:", error);
    });

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socket?.close();
    };
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadState().catch(() => {
        // Fallback silencioso para recuperar estado si el socket se pierde.
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [loadState]);

  const formattedPrice = useMemo(() => {
    if (!state.currentCard?.price) return null;

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: state.currentCard.priceCurrency || "USD",
      minimumFractionDigits: 2,
    }).format(state.currentCard.price);
  }, [state.currentCard?.price, state.currentCard?.priceCurrency]);

  return (
    <div className="min-h-screen w-full bg-transparent">
      <div className="relative flex min-h-screen items-end justify-start overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.18)_0%,_rgba(15,23,42,0)_45%)]" />

        <div className="relative flex w-full max-w-4xl items-end gap-6">
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
                  {formattedPrice ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-100">
                      {formattedPrice}
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

          <div className="ml-auto rounded-[30px] border border-white/12 bg-black/55 px-6 py-5 text-right text-white shadow-[0_24px_90px_-35px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
              Counter
            </div>
            <div className="mt-2 text-6xl font-black leading-none text-amber-300">
              {state.counter}
            </div>
            <div
              className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] ${
                isConnected ? "text-emerald-300/80" : "text-rose-300/80"
              }`}
            >
              {isConnected ? "Live connected" : "Reconnecting"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
