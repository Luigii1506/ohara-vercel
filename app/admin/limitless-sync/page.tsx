"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import Select from "react-select";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type SetOption = {
  id: number;
  title: string;
  code: string | null;
  region?: string | null;
};

type ReconcileResponse = {
  ok: boolean;
  report: {
    snapshot: {
      slug: string;
      sourceUrl: string;
      title: string;
      declaredCardCount: number;
    };
    dbSet: {
      setId: number | null;
      title: string;
      code: string | null;
      matchedBy: string | null;
    } | null;
    dbSetCardCount: number;
    matchedByProductId: Array<{
      code: string;
      cardUrl: string;
      printTitle: string | null;
      productId: number | null;
      card: {
        id: number;
        code: string;
        name: string;
        region: string | null;
        tcgplayerProductId: string | null;
        isFirstEdition: boolean;
        baseCardId: number | null;
        setIds: number[];
      };
    }>;
    matchedByCodeOnly: Array<{
      code: string;
      cardUrl: string;
      printTitle: string | null;
      productId: number | null;
      card: {
        id: number;
        code: string;
        name: string;
        region: string | null;
        tcgplayerProductId: string | null;
        isFirstEdition: boolean;
        baseCardId: number | null;
        setIds: number[];
      };
    }>;
    missing: Array<{
      code: string;
      name: string;
      cardUrl: string;
      printTitle: string | null;
      productId: number | null;
      reason: string;
      candidateCardIds: number[];
    }>;
    wrongSet: Array<{
      code: string;
      name: string;
      cardUrl: string;
      printTitle: string | null;
      productId: number | null;
      reason: string;
      candidateCardIds: number[];
    }>;
    extraInDbSet: Array<{
      id: number;
      code: string;
      name: string;
      region: string | null;
      tcgplayerProductId: string | null;
      isFirstEdition: boolean;
      baseCardId: number | null;
      setIds: number[];
    }>;
  };
  sourceWriteSummary: {
    created: number;
    updated: number;
  } | null;
};

type CatalogResponse = {
  ok: boolean;
  entries: Array<{
    slug: string;
    url: string;
    code: string | null;
    title: string;
    releaseLabel: string | null;
    cardCountLabel: string | null;
    category: "main" | "promo";
    reviewId: number | null;
    reviewStatus: "PENDING" | "REVIEWED" | "APPLIED" | null;
    dbSetId: number | null;
    dbSetTitle: string | null;
    lastSyncedAt: string | null;
    issueCount: number;
    missingCount: number;
    wrongSetCount: number;
    extraCount: number;
    isTracked: boolean;
    isNew: boolean;
    needsSync: boolean;
  }>;
  stats: {
    total: number;
    tracked: number;
    untracked: number;
    pending: number;
    reviewed: number;
    applied: number;
    needsSync: number;
    main: number;
    promo: number;
  };
};

type ReviewsResponse = {
  ok: boolean;
  reviews: Array<{
    id: number;
    slug: string;
    sourceUrl: string;
    sourceTitle: string;
    sourceCategory: string | null;
    region: string | null;
    dbSetId: number | null;
    status: "PENDING" | "REVIEWED" | "APPLIED";
    declaredCount: number;
    dbSetCardCount: number;
    matchedCount: number;
    wrongSetCount: number;
    missingCount: number;
    extraCount: number;
    updatedAt: string;
    dbSet: {
      id: number;
      title: string;
      code: string | null;
    } | null;
    _count: {
      items: number;
    };
  }>;
};

const selectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: "44px",
    borderColor: state.isFocused ? "#2563eb" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 1px #2563eb" : "none",
    "&:hover": { borderColor: state.isFocused ? "#2563eb" : "#94a3b8" },
  }),
  menu: (provided: any) => ({
    ...provided,
    zIndex: 40,
  }),
};

export default function LimitlessSyncPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useUser();
  const [sets, setSets] = useState<SetOption[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setUrlOrSlug, setSetUrlOrSlug] = useState("");
  const [region, setRegion] = useState("US");
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse["entries"]>([]);
  const [catalogStats, setCatalogStats] = useState<CatalogResponse["stats"] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [feedRunning, setFeedRunning] = useState<"all" | "new" | "stale" | null>(null);
  const [batchLimit, setBatchLimit] = useState("20");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const [reviews, setReviews] = useState<ReviewsResponse["reviews"]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [writingSources, setWritingSources] = useState(false);
  const [report, setReport] = useState<ReconcileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roleLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, roleLoading, router]);

  useEffect(() => {
    let cancelled = false;
    setSetsLoading(true);
    fetch("/api/admin/sets")
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("Failed to load sets"))
      )
      .then((data: SetOption[]) => {
        if (!cancelled) {
          setSets(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setSetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadReviews = async (status: string = reviewStatusFilter) => {
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/limitless/reviews?status=${encodeURIComponent(status)}&take=100`
      );
      const data: ReviewsResponse = await response.json();
      if (!response.ok) {
        throw new Error((data as any)?.error ?? "Failed to load reviews");
      }
      setReviews(data.reviews ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews(reviewStatusFilter);
  }, [reviewStatusFilter]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetch("/api/admin/limitless/set-catalog")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Failed to load Limitless catalog"))
      )
        .then((data: CatalogResponse) => {
        if (!cancelled) {
          setCatalog(data.entries ?? []);
          setCatalogStats(data.stats ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setOptions = useMemo(
    () =>
      sets.map((set) => ({
        value: set.id,
        label: `${set.title}${set.code ? ` [${set.code}]` : ""}${set.region ? ` · ${set.region}` : ""}`,
      })),
    [sets]
  );

  const selectedSetOption =
    setOptions.find((option) => option.value === selectedSetId) ?? null;

  const filteredCatalog = useMemo(() => {
    const needle = catalogFilter.trim().toLowerCase();
    if (!needle) return catalog.slice(0, 60);
    return catalog
      .filter((entry) =>
        [entry.title, entry.code ?? "", entry.slug, entry.dbSetTitle ?? ""].some((value) =>
          value.toLowerCase().includes(needle)
        )
      )
      .slice(0, 60);
  }, [catalog, catalogFilter]);

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/admin/limitless/set-catalog");
      const data: CatalogResponse = await response.json();
      if (!response.ok) {
        throw new Error((data as any)?.error ?? "Failed to load Limitless catalog");
      }
      setCatalog(data.entries ?? []);
      setCatalogStats(data.stats ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setCatalogLoading(false);
    }
  };

  const runReconcile = async (writeSources: boolean = false) => {
    if (!setUrlOrSlug.trim()) {
      setError("Necesitas pegar un URL o slug de Limitless.");
      return;
    }

    setError(null);
    setActionMessage(null);
    if (writeSources) {
      setWritingSources(true);
    } else {
      setRunning(true);
    }

    try {
      const response = await fetch(
        "/api/admin/limitless/set-membership/reconcile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setUrlOrSlug,
            dbSetId: selectedSetId,
            region,
            writeSources,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo reconciliar el set");
      }
      setReport(data);
      if (writeSources && data?.sourceWriteSummary) {
        setActionMessage(
          `Sources guardados: ${data.sourceWriteSummary.created} creados, ${data.sourceWriteSummary.updated} actualizados.`
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setRunning(false);
      setWritingSources(false);
    }
  };

  const handleRemoveExtra = async (cardId: number) => {
    const setId = report?.report.dbSet?.setId;
    if (!setId) return;

    setRemovingIds((prev) => new Set(prev).add(cardId));
    setActionMessage(null);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/limitless/set-membership/remove-card",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, setId }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo quitar la carta del set");
      }

      setReport((current) =>
        current
          ? {
              ...current,
              report: {
                ...current.report,
                dbSetCardCount: Math.max(0, current.report.dbSetCardCount - data.removed),
                extraInDbSet: current.report.extraInDbSet.filter(
                  (card) => card.id !== cardId
                ),
              },
            }
          : current
      );
      setActionMessage(`Carta ${cardId} removida del set.`);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleAddWrongSetCandidate = async (cardId: number) => {
    const setId = report?.report.dbSet?.setId;
    if (!setId) return;

    setAddingIds((prev) => new Set(prev).add(cardId));
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch("/api/admin/limitless/set-membership/add-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, setId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo agregar la carta al set");
      }

      setReport((current) =>
        current
          ? {
              ...current,
              report: {
                ...current.report,
                dbSetCardCount: current.report.dbSetCardCount + (data.created ? 1 : 0),
                wrongSet: current.report.wrongSet.filter(
                  (item) => !item.candidateCardIds.includes(cardId)
                ),
              },
            }
          : current
      );
      setActionMessage(`Carta ${cardId} agregada al set correcto.`);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleBatchSync = async () => {
    setBatchRunning(true);
    setError(null);
    setActionMessage(null);
    try {
      const numericLimit = Number.parseInt(batchLimit, 10);
      const response = await fetch(
        "/api/admin/limitless/set-membership/batch-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "all",
            region,
            limit: Number.isFinite(numericLimit) ? numericLimit : 20,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo correr el batch sync");
      }
      setActionMessage(
        `Batch sync listo: ${data.synced} sincronizados, ${data.failed} fallidos.`
      );
      await loadReviews(reviewStatusFilter);
      await loadCatalog();
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setBatchRunning(false);
    }
  };

  const handleCatalogFeedSync = async (
    mode: "all" | "new" | "stale",
    slug?: string
  ) => {
    setFeedRunning(mode);
    setError(null);
    setActionMessage(null);
    try {
      const numericLimit = Number.parseInt(batchLimit, 10);
      const response = await fetch(
        "/api/admin/limitless/set-membership/batch-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "all",
            region,
            limit: slug ? 1 : Number.isFinite(numericLimit) ? numericLimit : 20,
            slugs: slug ? [slug] : undefined,
            newOnly: mode === "new" && !slug,
            staleHours: mode === "stale" ? 24 : null,
            forceAll: mode === "all" || Boolean(slug),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo sincronizar el feed de Limitless");
      }
      if (slug) {
        setActionMessage(`Lista ${slug} sincronizada en review queue.`);
      } else if (mode === "new") {
        setActionMessage(
          `Feed actualizado: ${data.synced} nuevas listas sincronizadas de ${data.eligible} elegibles.`
        );
      } else if (mode === "stale") {
        setActionMessage(
          `Feed actualizado: ${data.synced} listas stale sincronizadas de ${data.eligible} elegibles.`
        );
      } else {
        setActionMessage(
          `Backfill completo: ${data.synced} listas sincronizadas de ${data.discovered} descubiertas.`
        );
      }
      await Promise.all([loadReviews(reviewStatusFilter), loadCatalog()]);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setFeedRunning(null);
    }
  };

  const handleCreateMissing = async (item: {
    code: string;
    cardUrl: string;
    printTitle: string | null;
    productId: number | null;
  }) => {
    const setId = report?.report.dbSet?.setId;
    if (!setId || !item.productId) return;
    const key = `${item.code}-${item.productId}`;

    setCreatingIds((prev) => new Set(prev).add(key));
    setError(null);
    setActionMessage(null);
    try {
      const response = await fetch("/api/admin/catalog-gaps/us-alternates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.productId,
          overrideSetId: setId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.cardId) {
        throw new Error(data?.error ?? "No se pudo crear la carta faltante");
      }

      setReport((current) =>
        current
          ? {
              ...current,
              report: {
                ...current.report,
                dbSetCardCount: current.report.dbSetCardCount + 1,
                missing: current.report.missing.filter(
                  (entry) =>
                    !(
                      entry.code === item.code &&
                      entry.productId === item.productId
                    )
                ),
              },
            }
          : current
      );
      setActionMessage(
        `${item.code} creada en el set con cardId ${data.cardId}.`
      );
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setCreatingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (roleLoading || role !== "ADMIN") {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="relative isolate overflow-x-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_58%)]" />
        <div className="pointer-events-none absolute right-[-8rem] top-24 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="pointer-events-none absolute left-[-7rem] top-64 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/10" />

        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4" />
              Limitless Sync
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Reconciliar Set Membership
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Compara un set de Limitless contra tu DB usando set membership real, prints y
              `tcgplayerProductId`. Sirve para detectar cartas extras, faltantes y prints en el
              set incorrecto.
            </p>
          </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1.2fr)_140px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                URL o slug de Limitless
              </label>
              <input
                value={setUrlOrSlug}
                onChange={(event) => setSetUrlOrSlug(event.target.value)}
                placeholder="https://onepiece.limitlesstcg.com/cards/event-pack-02"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Set en DB
              </label>
              <Select
                isClearable
                isLoading={setsLoading}
                options={setOptions}
                value={selectedSetOption}
                onChange={(option) => setSelectedSetId(option?.value ?? null)}
                styles={selectStyles}
                placeholder="Resolver automáticamente"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Región
              </label>
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => runReconcile(false)}
              disabled={running || writingSources}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Analizar set
            </button>

            <button
              onClick={() => runReconcile(true)}
              disabled={running || writingSources}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {writingSources ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Guardar sources seguros
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          )}

          {actionMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              {actionMessage}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Batch Sync
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Recorre el catálogo raíz de Limitless y persiste revisiones por set.
              </p>
            </div>
            <div className="ml-auto">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Límite
              </label>
              <input
                value={batchLimit}
                onChange={(event) => setBatchLimit(event.target.value)}
                className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={handleBatchSync}
              disabled={batchRunning}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {batchRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync root catalog
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Review Queue
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Revisiones persistidas por set después del batch sync.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={reviewStatusFilter}
                onChange={(event) => setReviewStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              >
                <option value="all">All</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="APPLIED">Applied</option>
              </select>
              {reviewsLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Counts</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {review.sourceTitle}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {review.dbSet?.title ?? "No DB set"} · {review.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {review.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      L {review.declaredCount} / DB {review.dbSetCardCount} · W {review.wrongSetCount} · M {review.missingCount} · E {review.extraCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(review.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSetUrlOrSlug(review.sourceUrl);
                          setSelectedSetId(review.dbSetId ?? null);
                          setRegion(review.region ?? "US");
                          void runReconcile(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && !reviewsLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No reviews yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Feed de listas de Limitless
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Esta sección descubre automáticamente los sets/listas que existen en
                `onepiece.limitlesstcg.com/cards` y `.../cards/promos`, te dice si ya los
                estamos rastreando en Ohara y te deja sincronizarlos al review queue para
                revisar faltantes, extras y sets incorrectos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void loadCatalog()}
                disabled={catalogLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {catalogLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refrescar feed
              </button>
              <button
                onClick={() => void handleCatalogFeedSync("new")}
                disabled={feedRunning !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
              >
                {feedRunning === "new" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Ingerir nuevas listas
              </button>
              <button
                onClick={() => void handleCatalogFeedSync("stale")}
                disabled={feedRunning !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {feedRunning === "stale" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-sync stale
              </button>
              <button
                onClick={() => void handleCatalogFeedSync("all")}
                disabled={feedRunning !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {feedRunning === "all" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Backfill completo
              </button>
            </div>
          </div>

          {catalogStats && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MiniStat label="Descubiertas" value={catalogStats.total} />
              <MiniStat label="Trackeadas" value={catalogStats.tracked} />
              <MiniStat label="Nuevas" value={catalogStats.untracked} />
              <MiniStat label="Pendientes" value={catalogStats.pending} />
              <MiniStat label="Stale" value={catalogStats.needsSync} />
              <MiniStat label="Promos" value={catalogStats.promo} />
            </div>
          )}

          <div className="mt-4">
            <input
              value={catalogFilter}
              onChange={(event) => setCatalogFilter(event.target.value)}
              placeholder="Buscar lista de Limitless, slug o set resuelto en DB..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:ring-blue-500/30"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredCatalog.map((entry) => (
              <div
                key={entry.slug}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {entry.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {entry.code ? `${entry.code} · ` : ""}
                      {entry.category === "promo" ? "Promo" : "Main"} · {entry.slug}
                    </div>
                  </div>
                  <CatalogStatusBadge entry={entry} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {entry.cardCountLabel ?? "Sin conteo"}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {entry.releaseLabel ?? "Sin fecha"}
                  </span>
                  {entry.dbSetTitle && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                      DB: {entry.dbSetTitle}
                    </span>
                  )}
                </div>

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {entry.isTracked
                    ? `Último sync: ${formatDateTime(entry.lastSyncedAt)}`
                    : "Nueva lista descubierta. Aún no se ha sincronizado al review queue."}
                </div>

                {entry.isTracked && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Issues: W {entry.wrongSetCount} · M {entry.missingCount} · E {entry.extraCount}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSetUrlOrSlug(entry.url);
                      setCatalogFilter(entry.title);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Usar en analizador
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCatalogFeedSync("all", entry.slug)}
                    disabled={feedRunning !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    {feedRunning === "all" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sync review
                  </button>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Abrir Limitless
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {report && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Limitless"
                value={report.report.snapshot.declaredCardCount}
                tone="blue"
              />
              <StatCard label="DB Set" value={report.report.dbSetCardCount} tone="slate" />
              <StatCard
                label="Matched pid"
                value={report.report.matchedByProductId.length}
                tone="emerald"
              />
              <StatCard
                label="Wrong set"
                value={report.report.wrongSet.length}
                tone="amber"
              />
              <StatCard
                label="Extras"
                value={report.report.extraInDbSet.length}
                tone="rose"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {report.report.snapshot.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    DB target:{" "}
                    {report.report.dbSet?.setId
                      ? `${report.report.dbSet.title} (#${report.report.dbSet.setId})`
                      : "No resuelto"}
                  </p>
                </div>
                <a
                  href={report.report.snapshot.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  Abrir Limitless
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            <SectionTable
              title="Wrong Set"
              description="Prints detectadas por Limitless que sí existen en DB, pero no están ligadas al set correcto."
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              empty="No se detectaron prints en set incorrecto."
              rows={report.report.wrongSet.map((item) => (
                <tr key={`${item.code}-${item.productId ?? item.cardUrl}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{item.printTitle ?? item.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.productId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.candidateCardIds.join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={item.cardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Limitless
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {item.candidateCardIds.length === 1 && (
                        <button
                          onClick={() => handleAddWrongSetCandidate(item.candidateCardIds[0])}
                          disabled={addingIds.has(item.candidateCardIds[0])}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {addingIds.has(item.candidateCardIds[0]) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Agregar al set
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            />

            <SectionTable
              title="Missing In DB"
              description="Prints presentes en Limitless que todavía no encontramos en tu DB."
              icon={<Database className="h-4 w-4 text-rose-500" />}
              empty="No faltan prints según este set."
              rows={report.report.missing.map((item) => (
                <tr key={`${item.code}-${item.productId ?? item.cardUrl}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{item.printTitle ?? item.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.productId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.reason}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={item.cardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Limitless
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {item.productId && report.report.dbSet?.setId ? (
                        <button
                          onClick={() => handleCreateMissing(item)}
                          disabled={creatingIds.has(`${item.code}-${item.productId}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        >
                          {creatingIds.has(`${item.code}-${item.productId}`) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Database className="h-3.5 w-3.5" />
                          )}
                          Crear en DB
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            />

            <SectionTable
              title="Extra In DB Set"
              description="Cartas que tu set tiene ligadas pero que no aparecen en la membresía real de Limitless."
              icon={<Trash2 className="h-4 w-4 text-rose-500" />}
              empty="No hay cartas extras en el set."
              rows={report.report.extraInDbSet.map((card) => (
                <tr key={card.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{card.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{card.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{card.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{card.tcgplayerProductId ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemoveExtra(card.id)}
                      disabled={removingIds.has(card.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {removingIds.has(card.id) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Quitar del set
                    </button>
                  </td>
                </tr>
              ))}
            />

            <SectionTable
              title="Matched By Product ID"
              description="Prints reconciliadas con seguridad por `tcgplayerProductId`."
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              empty="No hubo matches seguros."
              rows={report.report.matchedByProductId.map((item) => (
                <tr key={`${item.card.id}-${item.productId}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{item.printTitle ?? item.card.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.productId ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.card.id}</td>
                  <td className="px-4 py-3">
                    <a
                      href={item.cardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Limitless
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            />
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "slate" | "emerald" | "amber" | "rose";
}) {
  const toneMap: Record<typeof tone, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
    slate: "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-widest">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function CatalogStatusBadge({
  entry,
}: {
  entry: CatalogResponse["entries"][number];
}) {
  const status = entry.isNew
    ? {
        label: "Nuevo",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
      }
    : entry.issueCount > 0
      ? {
          label: "Con issues",
          className:
            "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
        }
      : entry.needsSync
        ? {
            label: "Stale",
            className:
              "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
          }
        : {
            label: "OK",
            className:
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
          };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}
    >
      {status.label}
    </span>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Nunca";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function SectionTable({
  title,
  description,
  icon,
  empty,
  rows,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  empty: string;
  rows: ReactNode[];
}) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Print</th>
                <th className="px-4 py-3">PID</th>
                <th className="px-4 py-3">Info</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
