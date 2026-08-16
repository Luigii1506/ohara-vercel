"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Loader2,
  ChevronLeft,
  Trash2,
  TrendingUp,
  TrendingDown,
  PackagePlus,
  PackageMinus,
} from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import {
  diffSnapshotCards,
  SnapshotDiffCardEntry,
  SnapshotDiffResult,
} from "@/lib/snapshots/diff";

interface SnapshotSummary {
  id: number;
  label: string | null;
  createdAt: string;
  totalCards: number;
  totalUnique: number;
  soldCount: number;
  soldValue: number | string;
  availableValue: number | string;
  totalValue: number | string;
  currency: string;
}

interface SnapshotCardEntry extends SnapshotDiffCardEntry {
  listCardId: number;
}

interface SnapshotDetail extends SnapshotSummary {
  cardsSnapshot: SnapshotCardEntry[];
}

interface SnapshotsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
}

const formatCurrency = (value: number | string, currency?: string | null) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const getNumericPrice = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

type CompareMode = "previous" | "current";

const SnapshotsDrawer: React.FC<SnapshotsDrawerProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
}) => {
  const [view, setView] = useState<"list" | "detail">("list");
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("previous");
  const [diffResult, setDiffResult] = useState<SnapshotDiffResult | null>(
    null
  );
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/snapshots`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSnapshots(data.snapshots ?? []);
    } catch {
      toast.error("Error al cargar los snapshots");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (isOpen) {
      setView("list");
      setDetail(null);
      setDiffResult(null);
      fetchSnapshots();
    }
  }, [isOpen, fetchSnapshots]);

  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/lists/${listId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelInput.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el snapshot");
      }
      toast.success("Snapshot creado");
      setLabelInput("");
      fetchSnapshots();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear el snapshot"
      );
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (snapshotId: number) => {
    setView("detail");
    setDetailLoading(true);
    setDetail(null);
    setDiffResult(null);
    setCompareMode("previous");
    try {
      const res = await fetch(
        `/api/lists/${listId}/snapshots/${snapshotId}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data.snapshot);
    } catch {
      toast.error("Error al cargar el snapshot");
      setView("list");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (snapshotId: number) => {
    setDeletingId(snapshotId);
    try {
      const res = await fetch(
        `/api/lists/${listId}/snapshots/${snapshotId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success("Snapshot eliminado");
      setView("list");
      setDetail(null);
      fetchSnapshots();
    } catch {
      toast.error("Error al eliminar el snapshot");
    } finally {
      setDeletingId(null);
    }
  };

  // Calcula el diff contra el snapshot anterior o contra el estado actual en vivo.
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;

    const after: SnapshotDiffCardEntry[] = detail.cardsSnapshot;

    const run = async () => {
      setDiffLoading(true);
      try {
        if (compareMode === "current") {
          const res = await fetch(`/api/lists/${listId}?limit=0`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          const before: SnapshotDiffCardEntry[] = (data.cards ?? []).map(
            (lc: any) => ({
              cardId: lc.cardId,
              code: lc.card?.code ?? "",
              name: lc.card?.name ?? "",
              src: lc.card?.src ?? "",
              quantity: lc.quantity || 1,
              isSold: Boolean(lc.isSold),
              soldPrice: getNumericPrice(lc.soldPrice),
              customPrice: getNumericPrice(lc.customPrice),
            })
          );
          if (!cancelled) setDiffResult(diffSnapshotCards(after, before));
        } else {
          const index = snapshots.findIndex((s) => s.id === detail.id);
          const previous =
            index >= 0 && index + 1 < snapshots.length
              ? snapshots[index + 1]
              : null;

          if (!previous) {
            if (!cancelled) setDiffResult(diffSnapshotCards([], after));
            return;
          }

          const res = await fetch(
            `/api/lists/${listId}/snapshots/${previous.id}`
          );
          if (!res.ok) throw new Error();
          const data = await res.json();
          const before: SnapshotDiffCardEntry[] =
            data.snapshot?.cardsSnapshot ?? [];
          if (!cancelled) setDiffResult(diffSnapshotCards(before, after));
        }
      } catch {
        if (!cancelled) setDiffResult(null);
      } finally {
        if (!cancelled) setDiffLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [detail, compareMode, listId, snapshots]);

  const busy = creating || detailLoading || deletingId !== null;

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      preventClose={busy}
      desktopModal
      desktopMaxWidth="max-w-2xl"
      maxHeight="88vh"
    >
      {/* onPointerDown stopPropagation: evita que BaseDrawer capture el
          puntero para su gesto de "arrastrar para cerrar" y se robe los
          clicks en los botones de este drawer (ver CardPreviewDialog). */}
      <div onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        {view === "detail" && (
          <button
            onClick={() => {
              setView("list");
              setDetail(null);
            }}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
          <Camera className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-slate-900">
            Snapshots
          </h3>
          <p className="truncate text-xs text-slate-500">{listName}</p>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
        {view === "list" ? (
          <>
            <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Nota (opcional), ej. Antes de la feria"
                className="flex-1"
              />
              <Button
                onClick={handleCreateSnapshot}
                disabled={creating}
                className="shrink-0 bg-slate-900 text-white hover:bg-slate-800"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear snapshot"
                )}
              </Button>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                Aún no hay snapshots. Crea uno para empezar a llevar el
                historial de esta carpeta.
              </div>
            ) : (
              <div className="space-y-2">
                {snapshots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openDetail(s.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {s.label || formatDate(s.createdAt)}
                        </p>
                        {s.label && (
                          <p className="text-xs text-slate-400">
                            {formatDate(s.createdAt)}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-bold text-slate-700">
                        {formatCurrency(s.totalValue, s.currency)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                      <span>{s.totalCards} cartas</span>
                      <span>{s.totalUnique} únicas</span>
                      <span className="text-emerald-600">
                        {s.soldCount} vendidas ·{" "}
                        {formatCurrency(s.soldValue, s.currency)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : detailLoading || !detail ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  {detail.label || formatDate(detail.createdAt)}
                </p>
                <button
                  onClick={() => handleDelete(detail.id)}
                  disabled={deletingId === detail.id}
                  className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50"
                  title="Eliminar snapshot"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {formatDate(detail.createdAt)}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[10px] uppercase text-slate-400">
                    Total
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(detail.totalValue, detail.currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[10px] uppercase text-slate-400">
                    Disponible
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(detail.availableValue, detail.currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[10px] uppercase text-slate-400">
                    Vendido
                  </p>
                  <p className="text-sm font-bold text-emerald-600">
                    {formatCurrency(detail.soldValue, detail.currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Qué cambió
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCompareMode("previous")}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    compareMode === "previous"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  vs. anterior
                </button>
                <button
                  onClick={() => setCompareMode("current")}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    compareMode === "current"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  vs. estado actual
                </button>
              </div>
            </div>

            {diffLoading ? (
              <div className="flex h-16 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
              </div>
            ) : diffResult ? (
              <div className="mb-4 space-y-1.5 text-sm">
                {diffResult.added.length === 0 &&
                diffResult.removed.length === 0 &&
                diffResult.newlySold.length === 0 &&
                diffResult.newlyAvailable.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin cambios.</p>
                ) : (
                  <>
                    {diffResult.added.length > 0 && (
                      <p className="flex items-center gap-1.5 text-slate-700">
                        <PackagePlus className="h-4 w-4 text-blue-500" />
                        {diffResult.added.length} carta(s) agregada(s)
                      </p>
                    )}
                    {diffResult.removed.length > 0 && (
                      <p className="flex items-center gap-1.5 text-slate-700">
                        <PackageMinus className="h-4 w-4 text-slate-400" />
                        {diffResult.removed.length} carta(s) quitada(s)
                      </p>
                    )}
                    {diffResult.newlySold.length > 0 && (
                      <p className="flex items-center gap-1.5 text-emerald-700">
                        <TrendingUp className="h-4 w-4" />
                        {diffResult.newlySold.length} carta(s) vendida(s) por{" "}
                        {formatCurrency(
                          diffResult.soldRevenue,
                          detail.currency
                        )}
                      </p>
                    )}
                    {diffResult.newlyAvailable.length > 0 && (
                      <p className="flex items-center gap-1.5 text-slate-700">
                        <TrendingDown className="h-4 w-4 text-amber-500" />
                        {diffResult.newlyAvailable.length} carta(s) vuelven a
                        estar disponibles
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : null}

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Cartas en este snapshot
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {detail.cardsSnapshot.map((c) => (
                <div
                  key={c.listCardId}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="relative aspect-[2.5/3.5] bg-slate-100">
                    <img
                      src={c.src}
                      alt={c.name}
                      className={`h-full w-full object-cover ${
                        c.isSold ? "grayscale opacity-50" : ""
                      }`}
                    />
                    {c.isSold && (
                      <div className="pointer-events-none absolute inset-x-[-15%] top-[38%] -rotate-[18deg] bg-slate-900/85 py-0.5 text-center text-[8px] font-black uppercase tracking-widest text-white">
                        Vendida
                      </div>
                    )}
                    {c.quantity > 1 && (
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[10px] font-bold text-white">
                        {c.quantity}
                      </div>
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[10px] font-semibold text-slate-700">
                      {c.name}
                    </p>
                    {(c.soldPrice ?? c.customPrice) != null && (
                      <p
                        className={`text-[10px] font-bold ${
                          c.isSold ? "text-slate-400" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(
                          (c.isSold ? c.soldPrice : c.customPrice) ?? 0,
                          detail.currency
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </div>
    </BaseDrawer>
  );
};

export default SnapshotsDrawer;
