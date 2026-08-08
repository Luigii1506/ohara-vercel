"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  type LiveOverlayScene,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import { playOverlaySfx, ensureOverlayAudio } from "@/lib/live-overlay/sfx";
import BracketView from "@/components/live-overlay/BracketView";

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
  bracket: null,
  updatedAt: new Date(0).toISOString(),
};

export default function OverlayCanvasClient({ token }: OverlayCanvasClientProps) {
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);
  // Ráfagas de confeti (botón 🎊). Cada disparo AGREGA una ráfaga; las anteriores
  // terminan su transición sin reiniciarse. Cada una se auto-quita al terminar.
  const [confettiBursts, setConfettiBursts] = useState<string[]>([]);
  const lastConfettiTrigger = useRef<string | null | undefined>(undefined);
  const burstSeq = useRef(0);
  const lastSoundTrigger = useRef<string | null | undefined>(undefined);
  // Sello one-shot (¡VENDIDO! etc): se muestra un momento y se auto-oculta.
  const [stampView, setStampView] = useState<{
    key: string;
    text: string;
    subtitle: string;
  } | null>(null);
  const lastStampTrigger = useRef<string | null | undefined>(undefined);
  const stampTimer = useRef<number | undefined>(undefined);
  // Combo: UNA unidad (confeti + sonido + sello) que dura 3s y se auto-elimina.
  // Un combo nuevo reemplaza al anterior por completo (nunca se apilan).
  const [comboView, setComboView] = useState<{
    key: string;
    confetti: boolean;
    stampText: string;
    stampSubtitle: string;
  } | null>(null);
  const lastComboTrigger = useRef<string | null | undefined>(undefined);
  const comboTimer = useRef<number | undefined>(undefined);
  // Escena de video (clip de R2). Se reproduce al dispararse y se oculta al
  // terminar (o al detenerlo).
  const [videoView, setVideoView] = useState<{
    key: string;
    url: string;
    loop: boolean;
    muted: boolean;
    fit: "cover" | "contain";
    startSec?: number;
    endSec?: number;
  } | null>(null);
  const lastVideoTrigger = useRef<string | null | undefined>(undefined);

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
  const stamp = state.scenes.find((s: LiveOverlayScene) => s.type === "stamp");
  const combo = state.scenes.find((s: LiveOverlayScene) => s.type === "combo");
  const video = state.scenes.find((s: LiveOverlayScene) => s.type === "video");

  // Dispara el confeti cuando triggeredAt cambia (dedupe: no se repite en cada
  // poll). Además, por FRESCURA: solo se reproduce si el disparo es reciente,
  // así se ve aunque el overlay acabe de cargar, pero un disparo viejo NO se
  // repite al refrescar OBS.
  useEffect(() => {
    // Escena de confeti removida (limpiar/combo): NO cancelamos las ráfagas en
    // curso, las dejamos terminar su transición. Solo reseteamos el dedupe.
    if (!confetti) {
      lastConfettiTrigger.current = null;
      return;
    }
    const trigger = confetti.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastConfettiTrigger.current;
    lastConfettiTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    // Ventana generosa (ttl + margen para el polling y desfase de reloj).
    if (ageMs <= (confetti.ttlMs ?? 4500) + 6000) {
      const id = `${trigger}#${burstSeq.current++}`;
      setConfettiBursts((b) => [...b, id]);
    }
  }, [confetti, confetti?.triggeredAt, confetti?.ttlMs]);

  // Muestra el sello cuando su triggeredAt cambia (frescura) y lo auto-oculta
  // tras su ttl.
  useEffect(() => {
    // Escena de sello removida (ej. combo nuevo sin sello / limpiar) → oculta.
    if (!stamp) {
      lastStampTrigger.current = null;
      window.clearTimeout(stampTimer.current);
      setStampView(null);
      return;
    }
    const trigger = stamp.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastStampTrigger.current;
    lastStampTrigger.current = trigger;
    if (!isNew) return;
    const ttl = stamp.ttlMs ?? 2800;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > ttl + 4000) return; // disparo viejo (refresh): no mostrar
    setStampView({
      key: trigger,
      text: String(stamp.props?.text ?? ""),
      subtitle: String(stamp.props?.subtitle ?? ""),
    });
    window.clearTimeout(stampTimer.current);
    stampTimer.current = window.setTimeout(
      () => setStampView(null),
      Math.max(400, ttl - Math.max(0, ageMs))
    );
  }, [stamp, stamp?.triggeredAt, stamp?.ttlMs, stamp?.props?.text, stamp?.props?.subtitle]);

  useEffect(() => () => window.clearTimeout(stampTimer.current), []);

  // Combo: una unidad atómica. Al llegar un combo nuevo (triggeredAt), reemplaza
  // al anterior (confeti + sonido + sello) y se auto-elimina a los 3s.
  useEffect(() => {
    if (!combo) {
      lastComboTrigger.current = null;
      window.clearTimeout(comboTimer.current);
      setComboView(null);
      return;
    }
    const trigger = combo.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastComboTrigger.current;
    lastComboTrigger.current = trigger;
    if (!isNew) return;
    const ttl = combo.ttlMs ?? 3000;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > ttl + 4000) return; // disparo viejo (refresh): no reproducir
    const props = combo.props || {};
    if (props.sfx) playOverlaySfx(String(props.sfx));
    setComboView({
      key: trigger,
      confetti: !!props.confetti,
      stampText: String(props.stampText ?? ""),
      stampSubtitle: String(props.stampSubtitle ?? ""),
    });
    window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(
      () => setComboView(null),
      Math.max(400, ttl - Math.max(0, ageMs))
    );
  }, [combo, combo?.triggeredAt]);

  useEffect(() => () => window.clearTimeout(comboTimer.current), []);

  // Escena de video: reproduce el clip cuando su triggeredAt cambia.
  useEffect(() => {
    if (!video) {
      lastVideoTrigger.current = null;
      setVideoView(null);
      return;
    }
    const trigger = video.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastVideoTrigger.current;
    lastVideoTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 5 * 60 * 1000) return; // no relanzar un disparo muy viejo
    const p = (video.props || {}) as Record<string, unknown>;
    const url = String(p.url ?? "");
    if (!url) return;
    setVideoView({
      key: trigger,
      url,
      loop: p.loop === true,
      muted: p.muted === true,
      fit: p.fit === "contain" ? "contain" : "cover",
      startSec: typeof p.startSec === "number" ? p.startSec : undefined,
      endSec: typeof p.endSec === "number" ? p.endSec : undefined,
    });
  }, [video, video?.triggeredAt]);

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

  // Desbloqueo de audio. En OBS suele arrancar solo; en un navegador de prueba
  // el audio queda bloqueado hasta el primer gesto. Mostramos un aviso mientras
  // esté bloqueado y lo desbloqueamos al primer clic/tecla.
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    ensureOverlayAudio().then((ready) => mounted && setAudioReady(ready));
    const unlock = async () => {
      const ready = await ensureOverlayAudio();
      if (mounted) setAudioReady(ready);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      mounted = false;
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
          @keyframes overlay-stamp-in {
            0%   { opacity: 0; transform: scale(2.2); }
            60%  { opacity: 1; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
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

        {/* Sello one-shot (¡VENDIDO! etc) — centrado, encima de la carta */}
        {stampView ? (
          <div
            key={stampView.key}
            className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-center [animation:overlay-stamp-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            <div className="-rotate-6 rounded-3xl border-[6px] border-white bg-[#ff2d6f] px-10 py-5 shadow-[0_16px_60px_rgba(0,0,0,0.6)]">
              <span className="text-7xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">
                {stampView.text}
              </span>
            </div>
            {stampView.subtitle ? (
              <span className="mt-3 -rotate-6 text-3xl font-black uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {stampView.subtitle}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Combo (confeti + sello) como unidad de 3s, se reemplaza y auto-elimina.
            El contenedor llena el lienzo para que el canvas del confeti tenga
            tamaño (710×1265). */}
        {comboView ? (
          <div
            key={`combo-${comboView.key}`}
            className="pointer-events-none absolute inset-0 z-[55]"
          >
            {comboView.confetti ? <ConfettiLayer durationMs={3000} /> : null}
            {comboView.stampText ? (
              <div className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-center [animation:overlay-stamp-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
                <div className="-rotate-6 rounded-3xl border-[6px] border-white bg-[#ff2d6f] px-10 py-5 shadow-[0_16px_60px_rgba(0,0,0,0.6)]">
                  <span className="text-7xl font-black uppercase italic tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">
                    {comboView.stampText}
                  </span>
                </div>
                {comboView.stampSubtitle ? (
                  <span className="mt-3 -rotate-6 text-3xl font-black uppercase text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                    {comboView.stampSubtitle}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Ráfagas de confeti suelto (botón 🎊). Se apilan y cada una termina
            su transición sin reiniciar a las demás. */}
        {confettiBursts.map((id) => (
          <ConfettiLayer
            key={id}
            durationMs={confetti?.ttlMs ?? 4500}
            onDone={() =>
              setConfettiBursts((b) => b.filter((x) => x !== id))
            }
          />
        ))}

        {/* Escena de VIDEO (clip de R2). El letterbox (contain) queda en verde
            chroma → OBS lo vuelve transparente. */}
        {videoView && videoView.url ? (
          <div className="absolute inset-0 z-[75]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              key={videoView.key}
              src={
                videoView.startSec != null
                  ? `${videoView.url}#t=${videoView.startSec}${
                      videoView.endSec != null ? `,${videoView.endSec}` : ""
                    }`
                  : videoView.url
              }
              autoPlay
              playsInline
              muted={videoView.muted}
              loop={videoView.loop}
              className={`h-full w-full ${
                videoView.fit === "contain" ? "object-contain" : "object-cover"
              }`}
              onEnded={() => {
                if (!videoView.loop) setVideoView(null);
              }}
            />
          </div>
        ) : null}

        {/* Escena BRACKET a pantalla completa (opaca → sobrevive al chroma).
            Cubre todo cuando está activa. */}
        {state.bracket?.active ? (
          <div className="absolute inset-0 z-[80]">
            <BracketView bracket={state.bracket} />
          </div>
        ) : null}

        {/* Aviso de audio bloqueado (solo hasta el primer clic; en OBS no sale) */}
        {!audioReady ? (
          <div className="absolute bottom-4 left-1/2 z-[70] -translate-x-1/2 animate-pulse rounded-full bg-black/85 px-5 py-2.5 text-base font-bold text-white shadow-lg">
            🔊 Clic para activar sonido
          </div>
        ) : null}
      </div>
    </div>
  );
}
