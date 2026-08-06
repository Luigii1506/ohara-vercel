"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CardWithCollectionData } from "@/types";
import {
  LIVE_OVERLAY_RARITY_COUNTER_KEYS,
  type LiveOverlayCard,
  type LiveOverlayRarityCounterKey,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import { useRegion } from "@/components/region/RegionProvider";
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
  imageUrl: card.src ?? null,
  rarity: card.rarity ?? null,
  setTitle: getSetTitleForCard(card),
  alternateArt: card.alternateArt ?? null,
  // El overlay muestra el Listed Median (mid price), no el market.
  price: normalizePrice((card as any).midPrice ?? card.marketPrice),
  priceCurrency: card.priceCurrency ?? null,
  region: card.region ?? null,
});

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
  // buscar/seleccionar carta en vivo).
  const [mobileTab, setMobileTab] = useState<"counters" | "cards">("counters");

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
    setState(data.state ?? EMPTY_STATE);
  }, [overlayToken]);

  useEffect(() => {
    if (!overlayToken) return;
    loadState().catch((error) => {
      console.error("[live-desk] failed to load state:", error);
    });
  }, [loadState, overlayToken]);

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

      {/* ===================== DESKTOP ===================== */}
      <div className="mx-auto hidden max-w-7xl gap-4 px-3 py-4 lg:flex lg:px-6">
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
          </div>
        </aside>
      </div>

      {/* ===================== MOBILE (stream controller) ===================== */}
      <div className="flex flex-col lg:hidden">
        {/* Pestañas */}
        <div className="sticky top-[49px] z-20 flex gap-1 border-b border-slate-200 bg-white px-3 py-2">
          <button
            type="button"
            onClick={() => setMobileTab("counters")}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              mobileTab === "counters"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            Contadores
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("cards")}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
              mobileTab === "cards"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            Cartas
          </button>
        </div>

        {/* Carta en vivo (siempre visible) */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 text-white">
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
          <div className="flex flex-col gap-2 p-2">
            {/* Mando de rarezas: 3×3 tiles grandes que llenan la pantalla */}
            <div className="grid h-[calc(100dvh-210px)] min-h-[560px] auto-rows-fr grid-cols-3 gap-2">
              {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
                <div
                  key={rarity}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="pt-1.5 text-center text-xs font-black uppercase tracking-wide text-slate-500">
                    {rarity}
                  </div>
                  <div className="flex flex-1 items-center justify-center text-4xl font-black leading-none text-amber-600">
                    {state.rarityCounters[rarity]}
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "decrement_rarity_counter", rarity, amount: 1 },
                          `mminus-${rarity}`
                        )
                      }
                      className="flex h-12 items-center justify-center bg-white text-slate-700 active:bg-slate-100"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          { action: "increment_rarity_counter", rarity, amount: 1 },
                          `mplus-${rarity}`
                        )
                      }
                      className="flex h-12 items-center justify-center bg-amber-400 text-slate-900 active:bg-amber-300"
                    >
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                runAction({ action: "reset_rarity_counters" }, "reset-all")
              }
              className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 active:bg-slate-50"
            >
              Reset all
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            {searchInput}
            <div className="min-h-[60vh]">
              {results.length > 0 && !searchLoading ? resultsGrid : emptyOrLoading}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
