"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  type LiveOverlayScene,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";

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
  scenes: [],
  updatedAt: new Date(0).toISOString(),
};

export default function OverlayCanvasClient({ token }: OverlayCanvasClientProps) {
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);
  // Dispara el confeti solo cuando cambia triggeredAt (no en cada poll ni al
  // refrescar OBS con un disparo viejo).
  const [confettiKey, setConfettiKey] = useState<string | null>(null);
  const lastConfettiTrigger = useRef<string | null | undefined>(undefined);

  // Polling del estado cada 1s (Vercel serverless no soporta WebSockets; el
  // estado vive en Postgres). Condicional: mandamos el último updatedAt y el
  // endpoint responde vacío si no cambió nada.
  const lastUpdatedAt = useRef<string | null>(null);
  const loadState = useCallback(async () => {
    try {
      const since = lastUpdatedAt.current
        ? `&since=${encodeURIComponent(lastUpdatedAt.current)}`
        : "";
      const response = await fetch(
        `/api/live-overlay/state?token=${encodeURIComponent(token)}${since}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to load overlay state");
      const data = await response.json();
      if (data.changed === false) return; // sin cambios, conservamos el estado
      const next = data.state ?? EMPTY_STATE;
      lastUpdatedAt.current = next.updatedAt ?? null;
      setState(next);
    } catch (error) {
      console.error("[overlay] failed to load state:", error);
    }
  }, [token]);

  useEffect(() => {
    loadState();
    const interval = window.setInterval(loadState, 1000);
    return () => window.clearInterval(interval);
  }, [loadState]);

  // Escenas activas del stack.
  const confetti = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "confetti"
  );
  const banner = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "banner" && s.visible
  );

  // Dispara el confeti cuando triggeredAt cambia (dedupe, sin repetir en polling
  // ni reproducir un disparo viejo al montar/refrescar).
  useEffect(() => {
    const trigger = confetti?.triggeredAt ?? null;
    if (lastConfettiTrigger.current === undefined) {
      lastConfettiTrigger.current = trigger; // primer estado: no dispares lo viejo
      return;
    }
    if (trigger && trigger !== lastConfettiTrigger.current) {
      setConfettiKey(trigger);
    }
    lastConfettiTrigger.current = trigger;
  }, [confetti?.triggeredAt]);

  return (
    // Contenedor a pantalla completa (gutter oscuro para preview en navegador).
    // En OBS pon la Browser Source EXACTAMENTE a 710×1265 y el lienzo la llena.
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      {/* Lienzo FIJO 710×1265 (vertical) — fondo verde chroma-key. */}
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden bg-[#28ce2b]">
        {/* Contadores: SIEMPRE los 5, píldoras compactas en el borde izquierdo. */}
        <div className="absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
          {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
            <div
              key={rarity}
              className="-ml-8 flex items-center gap-3 rounded-full border-[3px] border-cyan-400 bg-black py-2 pl-11 pr-6 shadow-[0_6px_22px_rgba(0,0,0,0.45)]"
            >
              <span className="text-3xl font-black uppercase leading-none tracking-tight text-white">
                {rarity}
              </span>
              <span className="text-4xl font-black leading-none text-[#ff2d6f]">
                {state.rarityCounters[rarity]}
              </span>
            </div>
          ))}
        </div>

        {/* Carta en vivo: anclada por ARRIBA (top fijo) para que al agrandar la
            imagen crezca solo hacia abajo, donde hay espacio. */}
        {state.currentCard ? (
          <div className="absolute inset-x-0 top-[273px] flex flex-col items-center gap-3">
            {state.currentCard.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.currentCard.imageUrl}
                alt={state.currentCard.code}
                className="w-[350px] rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
              />
            ) : null}
            <div className="w-[290px] rounded-2xl bg-black/80 px-4 py-3.5 text-center text-white backdrop-blur">
              <div className="text-4xl font-black leading-none tracking-tight">
                {state.currentCard.code}
              </div>
              {state.currentCard.rarity || state.currentCard.alternateArt ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-base font-bold uppercase tracking-wide text-amber-300">
                  {state.currentCard.rarity ? (
                    <span>{state.currentCard.rarity}</span>
                  ) : null}
                  {state.currentCard.alternateArt ? (
                    <span>· {state.currentCard.alternateArt}</span>
                  ) : null}
                </div>
              ) : null}
              {state.currentCard.price != null ? (
                <div className="mt-2 text-4xl font-black text-[#ff2d6f]">
                  $
                  {Number(state.currentCard.price).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ===================== ESCENAS (stack de capas) ===================== */}

        {/* Banner persistente (lower-third) */}
        {banner ? (
          <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center px-6">
            <div
              className="max-w-[620px] rounded-2xl border-[3px] px-8 py-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur"
              style={{
                background: "rgba(0,0,0,0.82)",
                borderColor:
                  (banner.props.accent as string) || "#f5b301",
              }}
            >
              <div className="text-4xl font-black leading-tight text-white">
                {String(banner.props.text ?? "")}
              </div>
              {banner.props.subtitle ? (
                <div className="mt-1 text-xl font-bold uppercase tracking-wide text-amber-300">
                  {String(banner.props.subtitle)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Confeti one-shot (encima de todo) */}
        {confettiKey ? (
          <ConfettiLayer
            key={confettiKey}
            durationMs={confetti?.ttlMs ?? 4500}
          />
        ) : null}
      </div>
    </div>
  );
}
