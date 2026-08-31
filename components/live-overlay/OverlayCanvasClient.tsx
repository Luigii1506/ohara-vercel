"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  normalizeLiveOverlayState,
  type LiveOverlayScene,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import ConfettiLayer from "@/components/live-overlay/scenes/ConfettiLayer";
import FxLayer, { type FxVariant } from "@/components/live-overlay/scenes/FxLayer";
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
  videoClips: [],
  chatFeed: [],
  likeCount: 0,
  topLikers: [],
  topGifters: [],
  viewerCount: 0,
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
    emoji: string;
    label: string;
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
    kind: "audio" | "video";
    loop: boolean;
    muted: boolean;
    fit: "cover" | "contain";
    startSec?: number;
    endSec?: number;
  } | null>(null);
  const lastVideoTrigger = useRef<string | null | undefined>(undefined);
  // Efectos fx (monedas/fuegos/manga): se apilan como el confeti.
  const [fxBursts, setFxBursts] = useState<{ key: string; variant: FxVariant }[]>(
    []
  );
  const lastFxTrigger = useRef<string | null | undefined>(undefined);
  // Brillo holográfico sobre la carta.
  const [shineKey, setShineKey] = useState<string | null>(null);
  const lastShineTrigger = useRef<string | null | undefined>(undefined);
  const shineTimer = useRef<number | undefined>(undefined);
  // Alertas de TikTok (gift/follow): cada escena `alert` tiene id ÚNICO (no es
  // singleton como las demás), así que se muestran en cola — una por cada
  // evento, apiladas, cada una se auto-quita sola tras su ttl.
  const [alertQueue, setAlertQueue] = useState<
    { id: string; emoji: string; text: string; subtitle: string; avatar: string }[]
  >([]);
  const knownAlertIds = useRef<Set<string>>(new Set());

  const lastUpdatedAt = useRef<string | null>(null);

  // Aplica un estado (venga del socket o del polling) manteniendo sincronizado
  // el updatedAt para el polling condicional.
  const applyState = useCallback((next: Partial<LiveOverlayState> | null) => {
    const norm = normalizeLiveOverlayState(next);
    lastUpdatedAt.current = norm.updatedAt;
    setState(norm);
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
  const fx = state.scenes.find((s: LiveOverlayScene) => s.type === "fx");
  const shine = state.scenes.find((s: LiveOverlayScene) => s.type === "shine");

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
      emoji: String(props.emoji ?? ""),
      label: String(props.label ?? ""),
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
      kind: p.kind === "audio" ? "audio" : "video",
      loop: p.loop === true,
      muted: p.muted === true,
      fit: p.fit === "contain" ? "contain" : "cover",
      startSec: typeof p.startSec === "number" ? p.startSec : undefined,
      endSec: typeof p.endSec === "number" ? p.endSec : undefined,
    });
  }, [video, video?.triggeredAt]);

  // fx (monedas/fuegos/manga): agrega una ráfaga por cada disparo nuevo.
  useEffect(() => {
    const trigger = fx?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastFxTrigger.current;
    lastFxTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 8000) return;
    const variant = String(fx?.props?.variant ?? "coins") as FxVariant;
    setFxBursts((b) => [...b, { key: trigger, variant }]);
  }, [fx?.triggeredAt, fx?.props?.variant]);

  // Brillo holográfico sobre la carta (se auto-oculta).
  useEffect(() => {
    const trigger = shine?.triggeredAt ?? null;
    const isNew = trigger && trigger !== lastShineTrigger.current;
    lastShineTrigger.current = trigger;
    if (!isNew) return;
    const ageMs = Date.now() - new Date(trigger).getTime();
    if (ageMs > 6000) return;
    setShineKey(trigger);
    window.clearTimeout(shineTimer.current);
    shineTimer.current = window.setTimeout(() => setShineKey(null), 1200);
  }, [shine?.triggeredAt]);

  useEffect(() => () => window.clearTimeout(shineTimer.current), []);

  // Alertas de TikTok (gift/follow): agrega al queue cada escena `alert` NUEVA
  // (id nunca visto) que siga fresca, y programa su propia auto-remoción.
  useEffect(() => {
    const alerts = state.scenes.filter((s) => s.type === "alert" && s.visible);
    for (const a of alerts) {
      if (knownAlertIds.current.has(a.id)) continue;
      knownAlertIds.current.add(a.id);
      const trigger = a.triggeredAt;
      if (!trigger) continue;
      const ttl = a.ttlMs ?? 4000;
      const ageMs = Date.now() - new Date(trigger).getTime();
      if (ageMs > ttl + 4000) continue; // disparo viejo (refresh de OBS): no mostrar
      setAlertQueue((q) => [
        ...q,
        {
          id: a.id,
          emoji: String(a.props?.emoji ?? ""),
          text: String(a.props?.text ?? ""),
          subtitle: String(a.props?.subtitle ?? ""),
          avatar: String(a.props?.avatar ?? ""),
        },
      ]);
      window.setTimeout(() => {
        setAlertQueue((q) => q.filter((x) => x.id !== a.id));
      }, Math.max(400, ttl - Math.max(0, ageMs)));
    }
  }, [state.scenes]);

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
          @keyframes overlay-shine {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(120%); }
          }
          @keyframes overlay-glass {
            0%   { opacity: 0; transform: scale(0.82) translateY(12px); filter: blur(6px); }
            12%  { opacity: 1; transform: scale(1.03) translateY(0); filter: blur(0); }
            20%  { transform: scale(1); }
            80%  { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.03); }
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
            {comboView.emoji || comboView.stampText || comboView.label ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex min-w-[300px] flex-col items-center gap-3 rounded-[2rem] border border-white/15 bg-[rgba(16,12,30,0.8)] px-16 py-10 text-center shadow-[0_24px_90px_rgba(0,0,0,0.55),0_0_60px_rgba(255,45,111,0.25)] backdrop-blur-xl [animation:overlay-glass_3s_cubic-bezier(0.34,1.4,0.5,1)_forwards]">
                  {comboView.emoji ? (
                    <span className="text-8xl leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
                      {comboView.emoji}
                    </span>
                  ) : null}
                  <span className="text-6xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                    {comboView.stampText || comboView.label}
                  </span>
                  {comboView.stampSubtitle ? (
                    <span className="text-2xl font-bold uppercase tracking-[0.2em] text-white/60">
                      {comboView.stampSubtitle}
                    </span>
                  ) : null}
                </div>
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

        {/* Efectos fx (monedas / fuegos / burbujas), apilables */}
        {fxBursts.map((b) => (
          <FxLayer
            key={b.key}
            variant={b.variant}
            onDone={() =>
              setFxBursts((x) => x.filter((y) => y.key !== b.key))
            }
          />
        ))}

        {/* Brillo: barrido de luz diagonal a pantalla completa (siempre visible) */}
        {shineKey ? (
          <div
            key={shineKey}
            className="pointer-events-none absolute inset-0 z-[62] overflow-hidden"
          >
            <div
              className="absolute inset-y-0 -left-1/3 -right-1/3 [animation:overlay-shine_1.1s_ease-out_forwards]"
              style={{
                background:
                  "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.45) 48%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.45) 52%, transparent 58%)",
              }}
            />
          </div>
        ) : null}

        {/* Escena de VIDEO (clip de R2). El letterbox (contain) queda en verde
            chroma → OBS lo vuelve transparente. */}
        {videoView && videoView.url ? (
          videoView.kind === "audio" ? (
            // Audio: sin visual, solo reproduce el segmento.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              key={videoView.key}
              src={
                videoView.startSec != null
                  ? `${videoView.url}#t=${videoView.startSec}${
                      videoView.endSec != null ? `,${videoView.endSec}` : ""
                    }`
                  : videoView.url
              }
              autoPlay
              loop={videoView.loop}
              onEnded={() => {
                if (!videoView.loop) setVideoView(null);
              }}
            />
          ) : (
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
                  videoView.fit === "contain"
                    ? "object-contain"
                    : "object-cover"
                }`}
                onEnded={() => {
                  if (!videoView.loop) setVideoView(null);
                }}
              />
            </div>
          )
        ) : null}

        {/* Escena BRACKET a pantalla completa (opaca → sobrevive al chroma).
            Cubre todo cuando está activa. */}
        {state.bracket?.active ? (
          <div className="absolute inset-0 z-[80]">
            <BracketView bracket={state.bracket} />
          </div>
        ) : null}

        {/* Contador de likes de TikTok (acumulado, sube en vivo) */}
        {state.likeCount > 0 ? (
          <div className="absolute right-4 top-6 z-30 flex items-center gap-2 rounded-full border-[3px] border-[#ff2d6f] bg-black/80 px-5 py-2 shadow-[0_6px_22px_rgba(0,0,0,0.45)]">
            <span className="text-2xl leading-none">❤️</span>
            <span className="text-2xl font-black tabular-nums leading-none text-white">
              {state.likeCount.toLocaleString("es-MX")}
            </span>
          </div>
        ) : null}

        {/* Viewers en vivo */}
        {state.viewerCount > 0 ? (
          <div className="absolute left-4 top-6 z-30 flex items-center gap-2 rounded-full border-[3px] border-cyan-300 bg-black/80 px-5 py-2 shadow-[0_6px_22px_rgba(0,0,0,0.45)]">
            <span className="text-2xl leading-none">👁</span>
            <span className="text-2xl font-black tabular-nums leading-none text-white">
              {state.viewerCount.toLocaleString("es-MX")}
            </span>
          </div>
        ) : null}

        {/* Ranking de la sesión: top likers / top regaladores (por cantidad) */}
        {state.topLikers.length > 0 || state.topGifters.length > 0 ? (
          <div className="absolute right-4 top-24 z-30 flex max-w-[220px] flex-col gap-2">
            {state.topLikers.length > 0 ? (
              <div className="rounded-xl bg-black/75 px-3 py-2 backdrop-blur">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#ff2d6f]">
                  ❤️ Top Likes
                </div>
                {state.topLikers.slice(0, 3).map((e, i) => (
                  <div
                    key={e.user}
                    className="flex items-center justify-between gap-2 text-xs font-bold text-white"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {e.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.avatar}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="truncate">
                        {i + 1}. {e.user}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white/70">
                      {e.count.toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {state.topGifters.length > 0 ? (
              <div className="rounded-xl bg-black/75 px-3 py-2 backdrop-blur">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
                  🎁 Top Regalos
                </div>
                {state.topGifters.slice(0, 3).map((e, i) => (
                  <div
                    key={e.user}
                    className="flex items-center justify-between gap-2 text-xs font-bold text-white"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {e.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.avatar}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="truncate">
                        {i + 1}. {e.user}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white/70">
                      💎{e.count.toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Interacción de TikTok (alertas de gift/follow + chat): columna
            izquierda, debajo de la modalidad y por ARRIBA de los contadores
            de rareza (zona libre real del lienzo), para no chocar con el
            banner (bottom) ni con la carta (centro). */}
        {alertQueue.length > 0 || state.chatFeed.length > 0 ? (
          <div className="absolute left-4 top-24 z-30 flex max-w-[320px] flex-col gap-2">
            {alertQueue.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border-[3px] border-amber-300 bg-black/85 px-5 py-3 shadow-[0_10px_36px_rgba(0,0,0,0.5)] [animation:overlay-mode-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
              >
                {a.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.avatar}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-white/40 object-cover"
                  />
                ) : a.emoji ? (
                  <span className="text-3xl leading-none">{a.emoji}</span>
                ) : null}
                <div className="flex flex-col">
                  <span className="text-lg font-black leading-tight text-white">
                    {a.avatar && a.emoji ? `${a.emoji} ` : ""}
                    {a.text}
                  </span>
                  {a.subtitle ? (
                    <span className="text-sm font-bold uppercase tracking-wide text-amber-300">
                      {a.subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {[...state.chatFeed].slice(-4).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-xl bg-black/70 px-3 py-1.5 text-sm leading-tight text-white backdrop-blur"
              >
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatar}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <span>
                  <span className="font-black text-cyan-300">{c.user}: </span>
                  <span className="font-medium">{c.text}</span>
                </span>
              </div>
            ))}
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
