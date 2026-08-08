"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CardWithCollectionData } from "@/types";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  createEmptyBracket,
  normalizeLiveOverlayState,
  type LiveOverlayBracket,
  type LiveOverlayCard,
  type LiveOverlayRarityCounterKey,
  type LiveOverlayState,
  type LiveOverlayVideoClip,
} from "@/lib/live-overlay/types";
import { useRegion } from "@/components/region/RegionProvider";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import { LIVE_OVERLAY_SFX } from "@/lib/live-overlay/sfx";
import { LIVE_OVERLAY_COMBOS } from "@/lib/live-overlay/combos";
import VideoTrimmer from "@/components/live-overlay/VideoTrimmer";
import { Copy, ExternalLink, Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";

type LiveDeskClientProps = {
  overlayToken: string | null;
  tokenEnvKey: string;
};

type FlattenedCardResult = LiveOverlayCard & {
  baseId: string;
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
  updatedAt: new Date(0).toISOString(),
};

const getSetTitleForCard = (card: CardWithCollectionData) => {
  if (!card.sets?.length) return null;
  return card.sets[0]?.set?.title ?? null;
};

const normalizePrice = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOverlayCard = (card: CardWithCollectionData): LiveOverlayCard => ({
  id: String(card.id),
  name: card.name,
  code: card.code,
  // El overlay muestra UNA carta a la vez → usa la variante de mayor
  // resolución en R2 (-large 800×1120) para que se vea nítida en el stream.
  imageUrl: card.src ? getOptimizedImageUrl(card.src, "large") : null,
  rarity: card.rarity ?? null,
  setTitle: getSetTitleForCard(card),
  alternateArt: card.alternateArt ?? null,
  // El overlay muestra el Listed Median (mid price), no el market.
  price: normalizePrice((card as any).midPrice ?? card.marketPrice),
  priceCurrency: card.priceCurrency ?? null,
  region: card.region ?? null,
});

// Modalidades prearmadas (letreros del overlay). Acentos chroma-safe (sin verdes).
const MODE_PRESETS: { label: string; emoji: string; accent: string }[] = [
  { label: "Subasta", emoji: "🔨", accent: "#f5b301" },
  { label: "Batallas", emoji: "⚔️", accent: "#ff2d6f" },
  { label: "Packs", emoji: "🎴", accent: "#3b82f6" },
  { label: "Breaks", emoji: "📦", accent: "#a855f7" },
  { label: "Giveaway", emoji: "🎁", accent: "#ff7a1a" },
  { label: "Ranking", emoji: "🏆", accent: "#f59e0b" },
];

export default function LiveDeskClient({
  overlayToken,
  tokenEnvKey,
}: LiveDeskClientProps) {
  const { region } = useRegion();
  const [origin, setOrigin] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FlattenedCardResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [state, setState] = useState<LiveOverlayState>(EMPTY_STATE);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  // Mobile: pestaña del controlador ("counters" = mando de rarezas, "cards" =
  // buscar/seleccionar carta en vivo, "effects" = escenas/efectos).
  const [mobileTab, setMobileTab] = useState<
    "counters" | "cards" | "effects" | "bracket"
  >("counters");
  const [bannerText, setBannerText] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalUnit, setGoalUnit] = useState("");
  // Tablet (Stream Deck): drawer inferior para buscar carta, banner, escenas o
  // bracket.
  const [tabletDrawer, setTabletDrawer] = useState<
    null | "search" | "banner" | "scenes" | "bracket"
  >(null);
  // Formulario del bracket de torneo.
  const [bracketForm, setBracketForm] = useState<LiveOverlayBracket>(
    createEmptyBracket()
  );
  const bracketInit = useRef(false);
  // Editor de clips de video.
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [vUrl, setVUrl] = useState("");
  const [vLabel, setVLabel] = useState("");
  const [vEmoji, setVEmoji] = useState("🎬");
  const [vStart, setVStart] = useState(0);
  const [vEnd, setVEnd] = useState(0);
  const [vLoop, setVLoop] = useState(false);
  const [vMuted, setVMuted] = useState(false);
  const [vFit, setVFit] = useState<"cover" | "contain">("cover");
  const [vUploading, setVUploading] = useState(false);
  const [vUploadError, setVUploadError] = useState<string | null>(null);

  const overlayUrl = useMemo(() => {
    if (!overlayToken || !origin) return null;
    return `${origin}/overlay/${overlayToken}`;
  }, [origin, overlayToken]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadState = useCallback(async () => {
    if (!overlayToken) return;

    const response = await fetch(
      `/api/admin/live-overlay?token=${encodeURIComponent(overlayToken)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Failed to load overlay state");
    }

    const data = await response.json();
    setState(normalizeLiveOverlayState(data.state));
  }, [overlayToken]);

  useEffect(() => {
    if (!overlayToken) return;
    loadState().catch((error) => {
      console.error("[live-desk] failed to load state:", error);
    });
  }, [loadState, overlayToken]);

  // Sincroniza en vivo entre dispositivos (teléfono + iPad + desktop) por
  // WebSocket. Si no hay worker configurado, cada panel usa su propio estado
  // optimista tras cada comando (como antes).
  const { connected: socketConnected } = useOverlaySocket({
    token: overlayToken,
    onState: (s) => setState(normalizeLiveOverlayState(s)),
  });

  // Pre-llena el formulario del bracket UNA vez con lo que ya haya en el overlay
  // (después el formulario es del operador, no lo pisamos con cada update).
  useEffect(() => {
    if (!bracketInit.current && state.bracket) {
      setBracketForm(state.bracket);
      bracketInit.current = true;
    }
  }, [state.bracket]);

  useEffect(() => {
    if (!overlayToken) return;

    const trimmedSearch = search.trim();
    if (trimmedSearch.length < 2) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({
          search: trimmedSearch,
          includeRelations: "true",
          includeAlternates: "true",
          limit: "48",
          region: region || "US",
        });
        const response = await fetch(`/api/cards/full?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to search cards");
        }

        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : [];

        const flattened = items.flatMap((card: CardWithCollectionData) => {
          const base = {
            ...toOverlayCard(card),
            baseId: String(card.id),
          };

          const alternates = (card.alternates ?? []).map((alternate) => ({
            ...toOverlayCard(alternate),
            baseId: String(card.id),
          }));

          return [base, ...alternates];
        });

        setResults(flattened);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[live-desk] search failed:", error);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [overlayToken, region, search]);

  const runAction = useCallback(
    async (payload: Record<string, unknown>, loadingKey: string) => {
      if (!overlayToken) return;

      setActionLoading(loadingKey);
      try {
        const response = await fetch("/api/admin/live-overlay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: overlayToken,
            ...payload,
          }),
        });

        if (!response.ok) {
          throw new Error("Overlay action failed");
        }

        const data = await response.json();
        setState(data.state ?? EMPTY_STATE);
      } catch (error) {
        console.error("[live-desk] action failed:", error);
      } finally {
        setActionLoading(null);
      }
    },
    [overlayToken]
  );

  const handleCopyOverlayUrl = useCallback(async () => {
    if (!overlayUrl) return;

    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch (error) {
      console.error("[live-desk] failed to copy overlay URL:", error);
    }
  }, [overlayUrl]);

  const liveCardId = state.currentCard?.id ?? null;

  // Click en una carta = toggle: si ya está en el overlay la quita, si no la pone.
  const toggleCard = useCallback(
    (card: FlattenedCardResult) => {
      if (liveCardId === card.id) {
        runAction({ action: "clear_card" }, `clear-${card.id}`);
      } else {
        runAction({ action: "show_card", card }, `show-${card.id}`);
      }
    },
    [liveCardId, runAction]
  );

  // ---- Escenas / efectos ----
  const bannerActive = state.scenes.some(
    (s) => s.type === "banner" && s.visible
  );
  const modeScene = state.scenes.find((s) => s.type === "mode" && s.visible);
  const goalScene = state.scenes.find((s) => s.type === "goal" && s.visible);
  const goalActive = Boolean(goalScene);

  const triggerConfetti = useCallback(
    () => runAction({ action: "trigger_scene", type: "confetti" }, "confetti"),
    [runAction]
  );

  const triggerCombo = useCallback(
    (combo: string) =>
      runAction({ action: "trigger_combo", combo }, `combo-${combo}`),
    [runAction]
  );

  const videoActive = state.scenes.some((s) => s.type === "video");
  const triggerVideo = useCallback(
    (clip: LiveOverlayVideoClip) =>
      runAction(
        {
          action: "trigger_scene",
          type: "video",
          props: {
            clipId: clip.id,
            url: clip.url,
            loop: clip.loop === true,
            muted: clip.muted === true,
            fit: clip.fit ?? "cover",
            ...(clip.startSec != null ? { startSec: clip.startSec } : {}),
            ...(clip.endSec != null ? { endSec: clip.endSec } : {}),
          },
        },
        `video-${clip.id}`
      ),
    [runAction]
  );
  const stopVideo = useCallback(
    () => runAction({ action: "remove_scene", id: "video" }, "video-stop"),
    [runAction]
  );

  const resetVideoEditor = useCallback(() => {
    setShowVideoEditor(false);
    setVUrl("");
    setVLabel("");
    setVEmoji("🎬");
    setVStart(0);
    setVEnd(0);
    setVLoop(false);
    setVMuted(false);
    setVFit("cover");
  }, []);

  const saveVideoClip = useCallback(() => {
    const url = vUrl.trim();
    if (!url) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `clip_${Date.now()}`;
    runAction(
      {
        action: "add_video_clip",
        clip: {
          id,
          label: vLabel.trim() || "Video",
          emoji: vEmoji.trim() || "🎬",
          url,
          startSec: vStart,
          endSec: vEnd,
          loop: vLoop,
          muted: vMuted,
          fit: vFit,
        },
      },
      "video-save"
    );
    resetVideoEditor();
  }, [vUrl, vLabel, vEmoji, vStart, vEnd, vLoop, vMuted, vFit, runAction, resetVideoEditor]);

  const removeVideoClip = useCallback(
    (id: string) =>
      runAction({ action: "remove_video_clip", id }, `video-del-${id}`),
    [runAction]
  );

  const uploadVideoFile = useCallback(
    async (file: File) => {
      setVUploadError(null);
      setVUploading(true);
      try {
        const contentType = file.type === "video/webm" ? "video/webm" : "video/mp4";
        const res = await fetch("/api/admin/live-overlay/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "No se pudo firmar la subida");
        const put = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": data.contentType },
          body: file,
        });
        if (!put.ok) {
          throw new Error(
            "Falló la subida a R2. Revisa el CORS del bucket (PUT desde oharatcg.com)."
          );
        }
        setVUrl(data.publicUrl);
        if (!vLabel.trim()) {
          setVLabel(file.name.replace(/\.[^.]+$/, "").slice(0, 40));
        }
      } catch (e) {
        setVUploadError((e as Error).message);
      } finally {
        setVUploading(false);
      }
    },
    [vLabel]
  );

  const triggerSound = useCallback(
    (sfx: string) =>
      // El sonido sale SOLO por el overlay (lo que capta OBS). El dispositivo de
      // control (celular/iPad) es un remoto, no reproduce audio.
      runAction(
        { action: "trigger_scene", type: "sound", props: { sfx } },
        `sfx-${sfx}`
      ),
    [runAction]
  );

  const showBanner = useCallback(() => {
    const text = bannerText.trim();
    if (!text) return;
    runAction(
      {
        action: "set_banner",
        text,
        subtitle: bannerSubtitle.trim(),
        visible: true,
      },
      "banner"
    );
  }, [bannerText, bannerSubtitle, runAction]);

  const hideBanner = useCallback(
    () => runAction({ action: "hide_scene", id: "banner" }, "banner-hide"),
    [runAction]
  );

  const setMode = useCallback(
    (label: string, emoji: string, accent: string) =>
      runAction({ action: "set_mode", label, emoji, accent }, "mode"),
    [runAction]
  );
  const hideMode = useCallback(
    () => runAction({ action: "hide_scene", id: "mode" }, "mode-hide"),
    [runAction]
  );

  const setGoal = useCallback(() => {
    const target = Number(goalTarget);
    if (!Number.isFinite(target) || target < 1) return;
    runAction(
      {
        action: "set_goal",
        label: goalLabel.trim() || "Meta",
        target: Math.trunc(target),
        current: 0,
        unit: goalUnit.trim(),
      },
      "goal"
    );
  }, [goalLabel, goalTarget, goalUnit, runAction]);

  const adjustGoal = useCallback(
    (amount: number) =>
      runAction({ action: "adjust_goal", amount }, "goal-adj"),
    [runAction]
  );
  const hideGoal = useCallback(
    () => runAction({ action: "hide_scene", id: "goal" }, "goal-hide"),
    [runAction]
  );

  // Panel de escenas/efectos reutilizable (desktop sidebar + tab móvil + drawer
  // de la tablet).
  const scenesPanel = (
    <div className="space-y-3">
      {/* Combos: un toque = varias escenas juntas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Combos
        </span>
        <div className="grid grid-cols-2 gap-2">
          {LIVE_OVERLAY_COMBOS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => triggerCombo(c.id)}
              disabled={actionLoading === `combo-${c.id}`}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-fuchsia-500 to-amber-400 py-3 text-sm font-black text-white shadow-sm active:scale-95 disabled:opacity-60"
            >
              <span className="text-lg leading-none">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Efectos rápidos */}
      <button
        type="button"
        onClick={triggerConfetti}
        disabled={actionLoading === "confetti"}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-fuchsia-200 bg-fuchsia-50 text-lg font-black text-fuchsia-700 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
      >
        🎊 Confeti
      </button>

      {/* Videos */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Videos
          </span>
          <div className="flex items-center gap-2">
            {videoActive ? (
              <button
                type="button"
                onClick={stopVideo}
                className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-rose-700 active:bg-rose-200"
              >
                ■ Detener
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                showVideoEditor ? resetVideoEditor() : setShowVideoEditor(true)
              }
              className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white active:bg-slate-800"
            >
              {showVideoEditor ? "Cancelar" : "➕ Agregar"}
            </button>
          </div>
        </div>

        {/* Clips guardados */}
        {state.videoClips.length ? (
          <div className="grid grid-cols-2 gap-2">
            {state.videoClips.map((clip) => (
              <div key={clip.id} className="relative">
                <button
                  type="button"
                  onClick={() => triggerVideo(clip)}
                  disabled={actionLoading === `video-${clip.id}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-800 active:scale-95 active:bg-slate-100 disabled:opacity-50"
                >
                  <span>{clip.emoji}</span>
                  <span className="truncate">{clip.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeVideoClip(clip.id)}
                  aria-label="Eliminar clip"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-xs font-black text-white shadow active:bg-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : !showVideoEditor ? (
          <p className="text-[11px] leading-snug text-slate-400">
            Sin clips. Toca “➕ Agregar” para subir una URL de video y recortarlo.
          </p>
        ) : null}

        {/* Editor / trimmer */}
        {showVideoEditor ? (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <div className="flex gap-2">
              <input
                value={vUrl}
                onChange={(e) => setVUrl(e.target.value)}
                placeholder="URL del video (mp4/webm) o sube uno →"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
              <label
                className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 active:bg-slate-100 ${
                  vUploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {vUploading ? "Subiendo…" : "⬆ Subir"}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadVideoFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {vUploadError ? (
              <p className="text-[11px] font-semibold text-rose-600">
                {vUploadError}
              </p>
            ) : null}
            {vUrl.trim() ? (
              <VideoTrimmer
                url={vUrl.trim()}
                start={vStart}
                end={vEnd}
                onChange={(s, e) => {
                  setVStart(s);
                  setVEnd(e);
                }}
              />
            ) : (
              <p className="text-[11px] text-slate-400">
                Pega la URL de un video para recortarlo.
              </p>
            )}
            <div className="grid grid-cols-[1fr_3.5rem] gap-2">
              <input
                value={vLabel}
                onChange={(e) => setVLabel(e.target.value)}
                placeholder="Nombre del botón"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
              <input
                value={vEmoji}
                onChange={(e) => setVEmoji(e.target.value)}
                placeholder="🎬"
                maxLength={4}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white text-center text-lg outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={vLoop}
                  onChange={(e) => setVLoop(e.target.checked)}
                />
                Loop
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={vMuted}
                  onChange={(e) => setVMuted(e.target.checked)}
                />
                Silencio
              </label>
              <label className="flex items-center gap-1.5">
                Ajuste
                <select
                  value={vFit}
                  onChange={(e) =>
                    setVFit(e.target.value === "contain" ? "contain" : "cover")
                  }
                  className="rounded border border-slate-200 bg-white px-1 py-0.5"
                >
                  <option value="cover">Llenar</option>
                  <option value="contain">Contener</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={saveVideoClip}
              disabled={!vUrl.trim() || actionLoading === "video-save"}
              className="h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-800 disabled:opacity-40"
            >
              Guardar clip
            </button>
          </div>
        ) : null}
      </div>

      {/* Sonidos SFX */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sonidos
        </span>
        <div className="grid grid-cols-3 gap-2">
          {LIVE_OVERLAY_SFX.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => triggerSound(s.id)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-slate-700 active:scale-95 active:bg-slate-100"
            >
              <span className="text-xl leading-none">{s.emoji}</span>
              <span className="text-[11px] font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modalidad */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modalidad
          </span>
          {modeScene ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {String(modeScene.props.emoji || "")}{" "}
              {String(modeScene.props.label)}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MODE_PRESETS.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setMode(m.label, m.emoji, m.accent)}
              disabled={actionLoading === "mode"}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-800 active:scale-95 active:bg-slate-100 disabled:opacity-50"
            >
              <span>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
        {modeScene ? (
          <button
            type="button"
            onClick={hideMode}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 active:bg-slate-50"
          >
            Quitar modalidad
          </button>
        ) : null}
      </div>

      {/* Meta */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Meta
          </span>
          {goalScene ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {Number(goalScene.props.current ?? 0)} /{" "}
              {Number(goalScene.props.target ?? 0)}
            </span>
          ) : null}
        </div>
        {goalActive ? (
          <div className="grid grid-cols-4 gap-2">
            {[-1, 1, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => adjustGoal(n)}
                className={`h-10 rounded-xl text-sm font-black active:scale-95 ${
                  n < 0
                    ? "bg-slate-100 text-slate-700"
                    : "bg-amber-400 text-slate-900"
                }`}
              >
                {n > 0 ? `+${n}` : n}
              </button>
            ))}
            <button
              type="button"
              onClick={hideGoal}
              className="col-span-4 mt-1 h-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 active:bg-slate-50"
            >
              Quitar meta
            </button>
          </div>
        ) : (
          <>
            <input
              value={goalLabel}
              onChange={(e) => setGoalLabel(e.target.value)}
              placeholder="Etiqueta (ej. Likes, Ventas)"
              className="mb-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex gap-2">
              <input
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                inputMode="numeric"
                placeholder="Meta (nº)"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
              <input
                value={goalUnit}
                onChange={(e) => setGoalUnit(e.target.value)}
                placeholder="Unidad"
                className="h-11 w-24 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <button
              type="button"
              onClick={setGoal}
              disabled={!goalTarget.trim() || actionLoading === "goal"}
              className="mt-2 h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-800 disabled:opacity-40"
            >
              Poner meta
            </button>
          </>
        )}
      </div>

      {/* Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Banner
          </span>
          {bannerActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En vivo
            </span>
          ) : null}
        </div>
        <input
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          placeholder="Texto principal…"
          className="mb-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <input
          value={bannerSubtitle}
          onChange={(e) => setBannerSubtitle(e.target.value)}
          placeholder="Subtítulo (opcional)"
          className="mb-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={showBanner}
            disabled={!bannerText.trim() || actionLoading === "banner"}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-800 disabled:opacity-40"
          >
            Mostrar
          </button>
          <button
            type="button"
            onClick={hideBanner}
            disabled={!bannerActive || actionLoading === "banner-hide"}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 active:bg-slate-50 disabled:opacity-40"
          >
            Ocultar
          </button>
        </div>
      </div>
    </div>
  );

  // ---- Bracket de torneo ----
  const setR1 = (i: number, v: string) =>
    setBracketForm((f) => ({
      ...f,
      round1: f.round1.map((x, idx) => (idx === i ? v : x)) as [
        string,
        string,
        string,
        string
      ],
    }));
  const setR2 = (i: number, v: string) =>
    setBracketForm((f) => ({
      ...f,
      round2: f.round2.map((x, idx) => (idx === i ? v : x)) as [string, string],
    }));

  const bracketActive = state.bracket?.active === true;
  const updateBracket = useCallback(
    () => runAction({ action: "set_bracket", bracket: bracketForm }, "bracket"),
    [bracketForm, runAction]
  );
  const toggleBracket = useCallback(
    () =>
      runAction(
        { action: "set_bracket_active", active: !bracketActive },
        "bracket-active"
      ),
    [bracketActive, runAction]
  );
  const clearBracket = useCallback(() => {
    setBracketForm(createEmptyBracket());
    runAction({ action: "clear_bracket" }, "bracket-clear");
  }, [runAction]);

  const bracketInput =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200";

  const bracketPanel = (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleBracket}
        disabled={actionLoading === "bracket-active"}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-black shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
          bracketActive
            ? "bg-emerald-500 text-white"
            : "bg-slate-900 text-white"
        }`}
      >
        {bracketActive ? "● Bracket EN VIVO — Ocultar" : "▶ Mostrar bracket en overlay"}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <input
          value={bracketForm.title}
          onChange={(e) =>
            setBracketForm((f) => ({ ...f, title: e.target.value }))
          }
          placeholder="Título (BRACKET)"
          className={bracketInput}
        />
        <input
          value={bracketForm.subtitle}
          onChange={(e) =>
            setBracketForm((f) => ({ ...f, subtitle: e.target.value }))
          }
          placeholder="Subtítulo"
          className={bracketInput}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ronda 1
        </span>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">
                {i + 1}
              </span>
              <input
                value={bracketForm.round1[i]}
                onChange={(e) => setR1(i, e.target.value)}
                placeholder={`Jugador ${i + 1}`}
                className={bracketInput}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Final
        </span>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <input
              key={i}
              value={bracketForm.round2[i]}
              onChange={(e) => setR2(i, e.target.value)}
              placeholder={`Finalista ${i + 1}`}
              className={bracketInput}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Campeón
        </span>
        <input
          value={bracketForm.champion}
          onChange={(e) =>
            setBracketForm((f) => ({ ...f, champion: e.target.value }))
          }
          placeholder="Campeón 👑"
          className={bracketInput}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={updateBracket}
          disabled={actionLoading === "bracket"}
          className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-800 disabled:opacity-40"
        >
          Actualizar bracket
        </button>
        <button
          type="button"
          onClick={clearBracket}
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 active:bg-slate-50"
        >
          Limpiar
        </button>
      </div>

      <p className="text-[11px] leading-snug text-slate-400">
        Usa la MISMA Browser Source del overlay. Al activar, el bracket cubre la
        pantalla; al ocultar, vuelve la vista de cartas.
      </p>
    </div>
  );

  const resultsGrid = (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {results.map((card) => {
        const isLive = liveCardId === card.id;
        const busy =
          actionLoading === `show-${card.id}` ||
          actionLoading === `clear-${card.id}`;
        return (
          <button
            key={`${card.baseId}-${card.id}`}
            type="button"
            onClick={() => toggleCard(card)}
            className={`group relative overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
              isLive
                ? "border-rose-500 ring-2 ring-rose-500"
                : "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
            }`}
          >
            <div className="relative aspect-[2.5/3.5] bg-slate-100">
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wide text-slate-400">
                  Sin imagen
                </div>
              )}
              {isLive ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  En vivo
                </span>
              ) : null}
              {busy ? (
                <div className="absolute inset-0 grid place-items-center bg-black/30">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              ) : null}
            </div>
            <div className="p-1.5">
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {card.code}
              </div>
              <div className="truncate text-[11px] font-medium text-slate-800">
                {card.name}
              </div>
              {card.alternateArt ? (
                <div className="truncate text-[10px] text-slate-400">
                  {card.alternateArt}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );

  const searchInput = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Busca por nombre o código…"
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      />
    </div>
  );

  const emptyOrLoading = searchLoading ? (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-12 text-center text-sm text-slate-500">
      {search.trim().length < 2
        ? "Escribe al menos 2 caracteres para buscar una carta."
        : "No encontramos cartas para esa búsqueda."}
    </div>
  );

  const liveCard = state.currentCard;

  return (
    <div className="min-h-screen w-full bg-slate-50">
      {/* Header compacto */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span>Live Desk</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {region || "US"}
            </span>
            <span
              title={socketConnected ? "En vivo por socket" : "Modo polling"}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                socketConnected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  socketConnected
                    ? "animate-pulse bg-emerald-500"
                    : "bg-slate-300"
                }`}
              />
              {socketConnected ? "Socket" : "Polling"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {overlayUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyOverlayUrl}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {copyStatus === "copied" ? "Copiada" : "Overlay URL"}
                  </span>
                </button>
                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {!overlayToken ? (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            Falta configurar <code>{tokenEnvKey}</code> para habilitar el overlay.
          </div>
        </div>
      ) : null}

      {/* ===================== DESKTOP (≥ xl) ===================== */}
      <div className="mx-auto hidden max-w-7xl gap-4 px-3 py-4 xl:flex xl:px-6">
        <main className="min-w-0 flex-1">
          <div className="mb-4">{searchInput}</div>
          {results.length > 0 && !searchLoading ? resultsGrid : emptyOrLoading}
        </main>

        <aside className="w-[320px] shrink-0">
          <div className="sticky top-16 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  En vivo
                </span>
                {liveCard ? (
                  <button
                    type="button"
                    onClick={() => runAction({ action: "clear_card" }, "clear")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </button>
                ) : null}
              </div>
              {liveCard ? (
                <div className="mt-3 flex gap-3">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {liveCard.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={liveCard.imageUrl}
                        alt={liveCard.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-amber-700">
                      {liveCard.code}
                    </div>
                    <div className="text-sm font-bold leading-tight text-slate-900">
                      {liveCard.name}
                    </div>
                    {liveCard.setTitle ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {liveCard.setTitle}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  Toca una carta para mostrarla. Tócala de nuevo para quitarla.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contadores por rareza
                </span>
                <button
                  type="button"
                  onClick={() =>
                    runAction({ action: "reset_rarity_counters" }, "reset-all")
                  }
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Reset all
                </button>
              </div>
              <div className="space-y-1.5">
                {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
                  <div
                    key={rarity}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5"
                  >
                    <span className="w-8 text-sm font-black text-slate-900">
                      {rarity}
                    </span>
                    <span className="w-8 text-center text-lg font-black text-amber-700">
                      {state.rarityCounters[rarity]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "decrement_rarity_counter", rarity, amount: 1 },
                          `minus-${rarity}`
                        )
                      }
                      className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "increment_rarity_counter", rarity, amount: 1 },
                          `plus-${rarity}`
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Escenas y efectos
                </span>
                {state.scenes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      runAction({ action: "clear_scenes" }, "clear-scenes")
                    }
                    className="text-xs font-semibold text-slate-500 hover:underline"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
              {scenesPanel}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  🏆 Torneo (Bracket)
                </span>
              </div>
              {bracketPanel}
            </div>
          </div>
        </aside>
      </div>

      {/* ===================== TABLET / iPad (md → xl) — Stream Deck ========= */}
      <div className="relative hidden h-[calc(100dvh-49px)] flex-col overflow-hidden md:flex xl:hidden">
        {/* Carta en vivo */}
        <div className="flex shrink-0 items-center gap-2 bg-slate-900 px-4 py-2.5 text-white">
          {liveCard ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
              <span className="truncate text-sm font-semibold">
                {liveCard.code} · {liveCard.name}
              </span>
              <button
                type="button"
                onClick={() => runAction({ action: "clear_card" }, "clear")}
                className="ml-auto rounded-lg bg-rose-600/90 px-3 py-1 text-sm font-bold"
              >
                Quitar
              </button>
            </>
          ) : (
            <span className="text-sm font-medium text-white/50">
              Sin carta en vivo — usa "Buscar carta"
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* Contadores: 3 steppers grandes */}
          <div className="grid flex-[0.42] grid-cols-3 gap-4">
            {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => {
              const value = state.rarityCounters[rarity] ?? 0;
              return (
                <div
                  key={rarity}
                  className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <span className="text-xl font-black uppercase tracking-wide text-slate-400">
                      {rarity}
                    </span>
                    <span className="text-7xl font-black leading-none tabular-nums text-slate-900">
                      {value}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <button
                      type="button"
                      disabled={value <= 0}
                      onClick={() =>
                        runAction(
                          { action: "decrement_rarity_counter", rarity, amount: 1 },
                          `tminus-${rarity}`
                        )
                      }
                      className="flex h-16 items-center justify-center bg-white text-slate-700 active:bg-slate-100 disabled:opacity-25"
                    >
                      <Minus className="h-7 w-7" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "increment_rarity_counter", rarity, amount: 1 },
                          `tplus-${rarity}`
                        )
                      }
                      className="flex h-16 items-center justify-center bg-amber-400 text-slate-900 active:bg-amber-300"
                    >
                      <Plus className="h-8 w-8" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deck de acciones: rejilla de botones grandes (Stream Deck) */}
          <div className="grid flex-[0.58] auto-rows-fr grid-cols-3 gap-4">
            {[
              {
                key: "sold",
                emoji: "💰",
                label: "Vendido",
                onClick: () => triggerCombo("sold"),
                disabled: actionLoading === "combo-sold",
                tone: "fuchsia" as const,
              },
              {
                key: "confetti",
                emoji: "🎊",
                label: "Confeti",
                onClick: triggerConfetti,
                disabled: actionLoading === "confetti",
                tone: "fuchsia" as const,
              },
              {
                key: "scenes",
                emoji: "🎬",
                label: "Escenas",
                onClick: () => setTabletDrawer("scenes"),
                disabled: false,
                tone: "slate" as const,
              },
              {
                key: "bracket",
                emoji: "🏆",
                label: "Torneo",
                onClick: () => setTabletDrawer("bracket"),
                disabled: false,
                tone: "slate" as const,
              },
              {
                key: "card",
                emoji: "🃏",
                label: "Buscar carta",
                onClick: () => setTabletDrawer("search"),
                disabled: false,
                tone: "slate" as const,
              },
              {
                key: "clearcard",
                emoji: "❌",
                label: "Quitar carta",
                onClick: () => runAction({ action: "clear_card" }, "clear"),
                disabled: !liveCard,
                tone: "slate" as const,
              },
              {
                key: "clearscenes",
                emoji: "🧹",
                label: "Limpiar escenas",
                onClick: () =>
                  runAction({ action: "clear_scenes" }, "clear-scenes"),
                disabled: state.scenes.length === 0,
                tone: "slate" as const,
              },
              {
                key: "reset",
                emoji: "🔄",
                label: "Reset contadores",
                onClick: () =>
                  runAction({ action: "reset_rarity_counters" }, "reset-all"),
                disabled: false,
                tone: "slate" as const,
              },
            ].map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={`flex flex-col items-center justify-center gap-2 rounded-3xl border text-center shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${
                  a.tone === "fuchsia"
                    ? "border-transparent bg-gradient-to-br from-fuchsia-500 to-amber-400 text-white"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <span className="text-5xl leading-none">{a.emoji}</span>
                <span className="text-base font-bold">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Drawer inferior: buscar carta o editar banner */}
        {tabletDrawer ? (
          <div
            className="absolute inset-0 z-30 flex flex-col justify-end bg-black/40"
            onClick={() => setTabletDrawer(null)}
          >
            <div
              className="max-h-[85%] rounded-t-3xl bg-slate-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
              {tabletDrawer === "search" ? (
                <div className="flex max-h-[70vh] flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">{searchInput}</div>
                    <button
                      type="button"
                      onClick={() => setTabletDrawer(null)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {results.length > 0 && !searchLoading
                      ? resultsGrid
                      : emptyOrLoading}
                  </div>
                </div>
              ) : tabletDrawer === "scenes" ? (
                <div className="flex max-h-[75vh] flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      Escenas y efectos
                    </span>
                    <button
                      type="button"
                      onClick={() => setTabletDrawer(null)}
                      className="text-sm font-bold text-slate-500"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {scenesPanel}
                  </div>
                </div>
              ) : tabletDrawer === "bracket" ? (
                <div className="flex max-h-[80vh] flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      🏆 Torneo (Bracket)
                    </span>
                    <button
                      type="button"
                      onClick={() => setTabletDrawer(null)}
                      className="text-sm font-bold text-slate-500"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {bracketPanel}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      Banner
                    </span>
                    <button
                      type="button"
                      onClick={() => setTabletDrawer(null)}
                      className="text-sm font-bold text-slate-500"
                    >
                      Cerrar
                    </button>
                  </div>
                  <input
                    value={bannerText}
                    onChange={(e) => setBannerText(e.target.value)}
                    placeholder="Texto principal…"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  />
                  <input
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    placeholder="Subtítulo (opcional)"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  />
                  <button
                    type="button"
                    disabled={!bannerText.trim() || actionLoading === "banner"}
                    onClick={() => {
                      showBanner();
                      setTabletDrawer(null);
                    }}
                    className="h-12 rounded-2xl bg-slate-900 text-base font-bold text-white active:bg-slate-800 disabled:opacity-40"
                  >
                    Mostrar banner
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ===================== MOBILE (< md, teléfono) ===================== */}
      {/* Ocupa EXACTAMENTE el viewport visible (viewport dinámico menos el
          header) para que la barra del navegador no corte los botones de
          abajo. Nada de alturas calculadas a mano ni scroll fantasma. */}
      <div className="flex h-[calc(100dvh-49px)] flex-col overflow-hidden md:hidden">
        {/* Pestañas */}
        <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-2 py-2">
          {(
            [
              ["counters", "Contadores"],
              ["cards", "Cartas"],
              ["effects", "Efectos"],
              ["bracket", "Torneo"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                mobileTab === key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Carta en vivo (siempre visible) */}
        <div className="flex shrink-0 items-center gap-2 bg-slate-900 px-3 py-2 text-white">
          {liveCard ? (
            <>
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500" />
              <span className="truncate text-xs font-semibold">
                {liveCard.code} · {liveCard.name}
              </span>
              <button
                type="button"
                onClick={() => runAction({ action: "clear_card" }, "clear")}
                className="ml-auto rounded-lg bg-rose-600/90 px-2.5 py-1 text-xs font-bold"
              >
                Quitar
              </button>
            </>
          ) : (
            <span className="text-xs font-medium text-white/50">
              Sin carta en vivo — abre "Cartas" para elegir una
            </span>
          )}
        </div>

        {mobileTab === "counters" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {/* Mando de rarezas: steppers horizontales grandes (pulgar-friendly),
                repartidos parejo. − restar · número · + sumar (acción primaria).
                Ocupa ~95% del alto disponible (el spacer deja un respiro abajo). */}
            <div className="flex min-h-0 flex-[0.95] flex-col gap-2.5">
              {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => {
                const value = state.rarityCounters[rarity] ?? 0;
                const busy =
                  actionLoading === `mplus-${rarity}` ||
                  actionLoading === `mminus-${rarity}`;
                return (
                  <div
                    key={rarity}
                    className="flex flex-1 items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3 shadow-sm"
                  >
                    {/* − restar */}
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "decrement_rarity_counter", rarity, amount: 1 },
                          `mminus-${rarity}`
                        )
                      }
                      disabled={value <= 0 || busy}
                      aria-label={`Restar ${rarity}`}
                      className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition active:scale-95 active:bg-slate-200 disabled:opacity-25"
                    >
                      <Minus className="h-8 w-8" strokeWidth={2.5} />
                    </button>

                    {/* etiqueta + número */}
                    <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                      <span className="text-lg font-black uppercase leading-none tracking-wide text-slate-400">
                        {rarity}
                      </span>
                      <span className="mt-1 text-6xl font-black leading-none tabular-nums text-slate-900">
                        {value}
                      </span>
                    </div>

                    {/* + sumar (acción primaria, dominante) */}
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "increment_rarity_counter", rarity, amount: 1 },
                          `mplus-${rarity}`
                        )
                      }
                      disabled={busy}
                      aria-label={`Sumar ${rarity}`}
                      className="grid h-[76px] w-[88px] shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-900 shadow-sm transition active:scale-95 active:bg-amber-300 disabled:opacity-50"
                    >
                      <Plus className="h-10 w-10" strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Respiro del ~5% para que el mando no llegue de borde a borde. */}
            <div className="flex-[0.05]" aria-hidden />
            <button
              type="button"
              onClick={() =>
                runAction({ action: "reset_rarity_counters" }, "reset-all")
              }
              className="h-12 shrink-0 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-500 active:bg-slate-50"
            >
              Reiniciar contadores
            </button>
          </div>
        ) : mobileTab === "effects" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {scenesPanel}
            {state.scenes.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  runAction({ action: "clear_scenes" }, "clear-scenes")
                }
                className="h-11 shrink-0 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-500 active:bg-slate-50"
              >
                Limpiar escenas
              </button>
            ) : null}
          </div>
        ) : mobileTab === "bracket" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {bracketPanel}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="sticky top-0 z-10 -mx-3 -mt-3 bg-slate-50 px-3 pb-2 pt-3">
              {searchInput}
            </div>
            {results.length > 0 && !searchLoading ? resultsGrid : emptyOrLoading}
          </div>
        )}
      </div>
    </div>
  );
}
