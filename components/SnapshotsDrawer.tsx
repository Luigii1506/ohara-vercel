"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, Loader2, Trash2, Eye } from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";

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

interface SnapshotsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
  /** Snapshot que se está viendo actualmente en la página (null = estado en vivo). */
  currentSnapshotId: number | null;
  /** Cambia qué se muestra en la página: un snapshot puntual, o null para el estado en vivo. */
  onSelectSnapshot: (snapshotId: number | null) => void;
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

const SnapshotsDrawer: React.FC<SnapshotsDrawerProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
  currentSnapshotId,
  onSelectSnapshot,
}) => {
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    if (isOpen) fetchSnapshots();
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

  const handleDelete = async (
    e: React.MouseEvent,
    snapshotId: number
  ) => {
    e.stopPropagation();
    setDeletingId(snapshotId);
    try {
      const res = await fetch(
        `/api/lists/${listId}/snapshots/${snapshotId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success("Snapshot eliminado");
      if (currentSnapshotId === snapshotId) onSelectSnapshot(null);
      fetchSnapshots();
    } catch {
      toast.error("Error al eliminar el snapshot");
    } finally {
      setDeletingId(null);
    }
  };

  const busy = creating || deletingId !== null;

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      preventClose={busy}
      desktopModal
      desktopMaxWidth="max-w-md"
      maxHeight="70vh"
    >
      {/* onPointerDown stopPropagation: evita que BaseDrawer capture el
          puntero para su gesto de "arrastrar para cerrar" y se robe los
          clicks en los botones de este drawer (ver CardPreviewDialog). */}
      <div onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
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

        <div className="max-h-[55vh] overflow-y-auto px-4 py-4">
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

          {currentSnapshotId != null && (
            <button
              type="button"
              onClick={() => {
                onSelectSnapshot(null);
                onClose();
              }}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Eye className="h-4 w-4" />
              Volver a la vista actual (en vivo)
            </button>
          )}

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
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectSnapshot(s.id);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectSnapshot(s.id);
                      onClose();
                    }
                  }}
                  className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                    s.id === currentSnapshotId
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
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
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        {formatCurrency(s.totalValue, s.currency)}
                      </p>
                      <button
                        onClick={(e) => handleDelete(e, s.id)}
                        disabled={deletingId === s.id}
                        className="rounded-full p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Eliminar snapshot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                    <span>{s.totalCards} cartas</span>
                    <span>{s.totalUnique} únicas</span>
                    <span className="text-emerald-600">
                      {s.soldCount} vendidas ·{" "}
                      {formatCurrency(s.soldValue, s.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseDrawer>
  );
};

export default SnapshotsDrawer;
