"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  type LiveOverlayScene,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import { playOverlaySfx, unlockOverlayAudio } from "@/lib/live-overlay/sfx";

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
  const lastSoundTrigger = useRef<string | null | undefined>(undefined);

  const lastUpdatedAt = useRef<string | null>(null);

  // Aplica un estado (venga del socket o del polling) manteniendo sincronizado
  // el updatedAt para el polling condicional.
  const applyState = useCallback((next: LiveOverlayState) => {
    lastUpdatedAt.current = next?.updatedAt ?? lastUpdatedAt.current;
    setState(next ?? EMPTY_STATE);
  }, []);

  // Empujón instantáneo por WebSocket (ohara-live-worker). Si no está
  // configurado, `connected` queda en false y caemos a polling rápido.
  const { connected } = useOverlaySocket({ token, onState: applyState });

  // Polling condicional: mandamos el último updatedAt y el endpoint responde
  // vacío si no cambió. Rápido (1s) cuando NO hay socket; lento (15s, red de
  // seguridad) cuando el socket está conectado.
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
      applyState(data.state ?? EMPTY_STATE);
    } catch (error) {
      console.error("[overlay] failed to load state:", error);
    }
  }, [token, applyState]);

  useEffect(() => {
    loadState();
    const interval = window.setInterval(loadState, connected ? 15000 : 1000);
    return () => window.clearInterval(interval);
  }, [loadState, connected]);

  // Escenas activas del stack.
  const confetti = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "confetti"
  );
  const banner = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "banner" && s.visible
  );
  const sound = state.scenes.find((s: LiveOverlayScene) => s.type === "sound");
  const mode = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "mode" && s.visible
  );
  const goal = state.scenes.find(
    (s: LiveOverlayScene) => s.type === "goal" && s.visible
  );

  // Dispara el confeti cuando triggeredAt cambia (dedupe: no se repite en cada
  // poll). Además, por FRESCURA: solo se reproduce si el disparo es reciente,
  // así se ve aunque el overlay acabe de cargar, pero un disparo viejo NO se
  // repite al refrescar OBS.
  useEffect(() => {
    const trigger = confetti?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastConfettiTrigger.current;
    lastConfettiTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    // Ventana generosa (ttl + margen para el polling y desfase de reloj).
    if (ageMs <= (confetti?.ttlMs ?? 4500) + 6000) {
      setConfettiKey(trigger);
    }
  }, [confetti?.triggeredAt, confetti?.ttlMs]);

  // Reproduce el SFX cuando su triggeredAt cambia (misma lógica de frescura).
  useEffect(() => {
    const trigger = sound?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastSoundTrigger.current;
    lastSoundTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs <= 8000) {
      playOverlaySfx(String(sound?.props?.sfx ?? "ding"));
    }
  }, [sound?.triggeredAt, sound?.props?.sfx]);

  // Desbloquea el audio tras el primer gesto (necesario solo para preview en
  // navegador; en OBS el audio arranca solo).
  useEffect(() => {
    const unlock = () => unlockOverlayAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const goalCurrent = Math.max(0, Number(goal?.props?.current ?? 0));
  const goalTarget = Math.max(1, Number(goal?.props?.target ?? 100));
  const goalPct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));

  return (
    // Contenedor a pantalla completa (gutter oscuro para preview en navegador).
    // En OBS pon la Browser Source EXACTAMENTE a 710×1265 y el lienzo la llena.
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      {/* Lienzo FIJO 710×1265 (vertical) — fondo verde chroma-key. */}
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden bg-[#28ce2b]">
        <style>{`
          @keyframes overlay-card-in {
            0%   { opacity: 0; transform: translateY(48px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes overlay-mode-in {
            0%   { opacity: 0; transform: translateY(-24px) scale(0.8); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
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
            imagen crezca solo hacia abajo, donde hay espacio. El `key` por id
            re-dispara la animación de entrada cada vez que cambia la carta. */}
        {state.currentCard ? (
          <div
            key={state.currentCard.id}
            className="absolute inset-x-0 top-[273px] flex flex-col items-center gap-3 [animation:overlay-card-in_0.55s_cubic-bezier(0.22,1,0.36,1)]"
          >
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

        {/* Modalidad: letrero animado arriba (SUBASTA, BATALLAS, PACKS…) */}
        {mode ? (
          <div className="absolute inset-x-0 top-6 z-20 flex justify-center px-6">
            <div
              key={String(mode.props.label)}
              className="flex items-center gap-3 rounded-2xl border-[3px] px-8 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] [animation:overlay-mode-in_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                background: "rgba(0,0,0,0.82)",
                borderColor: (mode.props.accent as string) || "#f5b301",
              }}
            >
              {mode.props.emoji ? (
                <span className="text-4xl leading-none">
                  {String(mode.props.emoji)}
                </span>
              ) : null}
              <span className="text-4xl font-black uppercase tracking-wider text-white">
                {String(mode.props.label)}
              </span>
            </div>
          </div>
        ) : null}

        {/* Barra de meta */}
        {goal ? (
          <div className="absolute inset-x-0 top-[92px] z-20 flex justify-center px-8">
            <div className="w-[560px] max-w-full rounded-2xl bg-black/80 px-5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xl font-black uppercase tracking-wide text-white">
                  {String(goal.props.label || "Meta")}
                </span>
                <span className="text-xl font-black tabular-nums text-amber-300">
                  {goalCurrent}
                  {goal.props.unit ? ` ${String(goal.props.unit)}` : ""}
                  <span className="text-white/50"> / {goalTarget}</span>
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${goalPct}%`,
                    background:
                      (goal.props.accent as string) ||
                      "linear-gradient(90deg,#ff2d6f,#f5b301)",
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

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
