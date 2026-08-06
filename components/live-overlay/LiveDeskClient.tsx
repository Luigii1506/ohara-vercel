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
  price: normalizePrice(card.marketPrice),
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
          limit: "18",
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

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top,_#fff7d6_0%,_#f2eede_35%,_#e3dcc3_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
                Ohara Live Desk
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Overlay control para TikTok y streaming
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Busca una carta, empújala al overlay y controla contadores por rareza en tiempo real.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Región activa: {region || "US"}</div>
              <div className="mt-1 text-xs text-slate-500">
                El overlay usa el token de entorno <code>{tokenEnvKey}</code>.
              </div>
            </div>
          </div>
        </div>

        {!overlayToken ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
            <p className="text-lg font-bold">Falta configurar el token del overlay</p>
            <p className="mt-2 text-sm">
              Define <code>{tokenEnvKey}</code> para habilitar la página pública del overlay y el panel de control.
            </p>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Buscar Carta
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Empuja una carta al overlay
                </h2>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busca por nombre, código o set"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>

            <div className="mt-4">
              {searchLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando cartas...
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
                  {search.trim().length < 2
                    ? "Escribe al menos 2 caracteres para buscar."
                    : "No encontramos cartas para esa búsqueda."}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((card) => (
                    <button
                      key={`${card.baseId}-${card.id}`}
                      type="button"
                      onClick={() =>
                        runAction(
                          {
                            action: "show_card",
                            card,
                          },
                          `show-${card.id}`
                        )
                      }
                      className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
                    >
                      <div className="aspect-[2.5/3.5] w-full overflow-hidden bg-[linear-gradient(160deg,_#fff8dc_0%,_#efe6bf_100%)]">
                        {card.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 p-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                            {card.code}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm font-bold text-slate-950">
                            {card.name}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                          {card.setTitle ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1">
                              {card.setTitle}
                            </span>
                          ) : null}
                          {card.alternateArt ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                              {card.alternateArt}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Overlay URL
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    Browser source listo
                  </h2>
                </div>
                {overlayUrl ? (
                  <a
                    href={overlayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                <div className="break-all font-mono">{overlayUrl ?? "Configura el token para generar la URL."}</div>
              </div>

              <button
                type="button"
                disabled={!overlayUrl}
                onClick={handleCopyOverlayUrl}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Copy className="h-4 w-4" />
                {copyStatus === "copied" ? "URL copiada" : "Copiar URL del overlay"}
              </button>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(160deg,_rgba(255,255,255,0.98)_0%,_rgba(252,247,230,0.98)_100%)] p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Estado Actual
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Preview del overlay</h2>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-[#0f172a] p-4 text-white">
                <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
                    {state.currentCard?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.currentCard.imageUrl}
                        alt={state.currentCard.name}
                        className="aspect-[2.5/3.5] h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[2.5/3.5] items-center justify-center text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        No card
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                      {state.currentCard?.code ?? "Sin carta activa"}
                    </div>
                    <div className="mt-1 text-xl font-black leading-tight text-white">
                      {state.currentCard?.name ?? "Selecciona una carta para verla en el overlay"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                      {state.currentCard?.setTitle ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          {state.currentCard.setTitle}
                        </span>
                      ) : null}
                      {state.currentCard?.alternateArt ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                          {state.currentCard.alternateArt}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      Rarity Counters
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((key) => (
                        <div
                          key={key}
                          className="rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2 text-center"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                            {key}
                          </div>
                          <div className="mt-1 text-2xl font-black text-amber-300">
                            {state.rarityCounters[key]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => runAction({ action: "clear_card" }, "clear-card")}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear card
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Rarity Controls
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Suma y resta por rareza
              </h2>

              <div className="mt-4 grid gap-3">
                {LIVE_OVERLAY_RARITY_COUNTER_KEYS.map((rarity) => (
                  <div
                    key={rarity}
                    className="grid grid-cols-[70px_minmax(0,1fr)_48px_68px_48px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="text-sm font-black tracking-[0.08em] text-slate-950">
                      {rarity}
                    </div>
                    <div className="text-2xl font-black text-amber-700">
                      {state.rarityCounters[rarity]}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          {
                            action: "decrement_rarity_counter",
                            rarity,
                            amount: 1,
                          },
                          `rarity-minus-${rarity}`
                        )
                      }
                      disabled={!overlayToken}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          {
                            action: "set_rarity_counter",
                            rarity,
                            value: 0,
                          },
                          `rarity-reset-${rarity}`
                        )
                      }
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          {
                            action: "increment_rarity_counter",
                            rarity,
                            amount: 1,
                          },
                          `rarity-plus-${rarity}`
                        )
                      }
                      disabled={!overlayToken}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      { action: "reset_rarity_counters" },
                      "rarity-reset-all"
                    )
                  }
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset all
                </button>
                <button
                  type="button"
                  onClick={() => loadState().catch(console.error)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Refrescar
                </button>
              </div>

              {actionLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando acción: {actionLoading}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
