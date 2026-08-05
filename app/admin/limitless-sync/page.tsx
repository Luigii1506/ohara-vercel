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
  }>;
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
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
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
        [entry.title, entry.code ?? "", entry.slug].some((value) =>
          value.toLowerCase().includes(needle)
        )
      )
      .slice(0, 60);
  }, [catalog, catalogFilter]);

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
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado");
    } finally {
      setBatchRunning(false);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600">
          <Layers className="h-4 w-4" />
          Limitless Sync
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Reconciliar Set Membership
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Compara un set de Limitless contra tu DB usando set membership real, prints y
          `tcgplayerProductId`. Sirve para detectar cartas extras, faltantes y prints en el
          set incorrecto.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[2fr_1.2fr_120px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                URL o slug de Limitless
              </label>
              <input
                value={setUrlOrSlug}
                onChange={(event) => setSetUrlOrSlug(event.target.value)}
                placeholder="https://onepiece.limitlesstcg.com/cards/event-pack-02"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
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
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Región
              </label>
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {actionMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Batch Sync
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Recorre el catálogo raíz de Limitless y persiste revisiones por set.
              </p>
            </div>
            <div className="ml-auto">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Límite
              </label>
              <input
                value={batchLimit}
                onChange={(event) => setBatchLimit(event.target.value)}
                className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              onClick={handleBatchSync}
              disabled={batchRunning}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Review Queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revisiones persistidas por set después del batch sync.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={reviewStatusFilter}
                onChange={(event) => setReviewStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                  <tr key={review.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {review.sourceTitle}
                      </div>
                      <div className="text-xs text-slate-500">
                        {review.dbSet?.title ?? "No DB set"} · {review.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {review.status}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      L {review.declaredCount} / DB {review.dbSetCardCount} · W {review.wrongSetCount} · M {review.missingCount} · E {review.extraCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
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
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && !reviewsLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No reviews yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Limitless Root Catalog
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Elige un set de Limitless sin pegar el URL manualmente.
              </p>
            </div>
            {catalogLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          <div className="mt-4">
            <input
              value={catalogFilter}
              onChange={(event) => setCatalogFilter(event.target.value)}
              placeholder="Buscar set de Limitless..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCatalog.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onClick={() => {
                  setSetUrlOrSlug(entry.url);
                  setCatalogFilter(entry.title);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {entry.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {entry.code ? `${entry.code} · ` : ""}
                      {entry.category === "promo" ? "Promo" : "Main"}
                    </div>
                  </div>
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {entry.releaseLabel ?? "—"} · {entry.cardCountLabel ?? "—"}
                </div>
              </button>
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {report.report.snapshot.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
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
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
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
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-white text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-widest">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
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
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-500">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
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
