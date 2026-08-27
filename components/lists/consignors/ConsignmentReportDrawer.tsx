"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users, Download, AlertCircle, Pencil, Trash2 } from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";

interface ConsignmentGroup {
  consignorId: number | null;
  name: string;
  color: string | null;
  totalCards: number;
  totalQuantity: number;
  soldCards: number;
  soldQuantity: number;
  soldValue: number;
  availableCards: number;
  availableQuantity: number;
  availableValue: number;
  totalValue: number;
}

interface ConsignmentReportData {
  listName: string;
  listId: number;
  generatedAt: string;
  groups: ConsignmentGroup[];
  grandTotal: {
    totalCards: number;
    totalQuantity: number;
    soldQuantity: number;
    soldValue: number;
    availableQuantity: number;
    availableValue: number;
    totalValue: number;
  };
}

interface ConsignmentReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ConsignmentReportDrawer: React.FC<ConsignmentReportDrawerProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ConsignmentReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${listId}/consignment-report`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al generar el reporte");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (isOpen) fetchReport();
  }, [isOpen, fetchReport]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const rows = [
      ["Consignatario", "Cartas", "Cantidad", "Vendidas (cant)", "Vendido ($)", "Disponibles (cant)", "Disponible ($)", "Total ($)"],
      ...data.groups.map((g) => [
        g.name,
        String(g.totalCards),
        String(g.totalQuantity),
        String(g.soldQuantity),
        g.soldValue.toFixed(2),
        String(g.availableQuantity),
        g.availableValue.toFixed(2),
        g.totalValue.toFixed(2),
      ]),
      [
        "TOTAL",
        String(data.grandTotal.totalCards),
        String(data.grandTotal.totalQuantity),
        String(data.grandTotal.soldQuantity),
        data.grandTotal.soldValue.toFixed(2),
        String(data.grandTotal.availableQuantity),
        data.grandTotal.availableValue.toFixed(2),
        data.grandTotal.totalValue.toFixed(2),
      ],
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = listName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    link.download = `consignacion-${safeName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  }, [data, listName]);

  const handleRename = useCallback(
    async (consignorId: number) => {
      const name = editingName.trim();
      if (!name) return;
      setBusyId(consignorId);
      try {
        const res = await fetch(`/api/consignors/${consignorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al renombrar");
        toast.success("Renombrado");
        setEditingId(null);
        fetchReport();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al renombrar");
      } finally {
        setBusyId(null);
      }
    },
    [editingName, fetchReport]
  );

  const handleDelete = useCallback(
    async (consignorId: number, name: string) => {
      if (!window.confirm(`¿Eliminar a "${name}"? Sus cartas quedarán sin asignar (vuelven a ser tuyas).`)) return;
      setBusyId(consignorId);
      try {
        const res = await fetch(`/api/consignors/${consignorId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar");
        toast.success("Consignatario eliminado");
        fetchReport();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al eliminar");
      } finally {
        setBusyId(null);
      }
    },
    [fetchReport]
  );

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      desktopModal
      desktopMaxWidth="max-w-2xl"
      maxHeight="85vh"
    >
      <div onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-slate-900">
              Reporte de consignación
            </h3>
            <p className="truncate text-xs text-slate-500">{listName}</p>
          </div>
          {data && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              className="gap-1.5 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchReport}>
                Reintentar
              </Button>
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-3">
              {data.groups.map((g) => (
                <div
                  key={g.consignorId ?? "mine"}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color || (g.consignorId === null ? "#0f172a" : "#94a3b8") }}
                      />
                      {editingId === g.consignorId ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && g.consignorId != null) handleRename(g.consignorId);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm"
                          />
                          <button
                            onClick={() => g.consignorId != null && handleRename(g.consignorId)}
                            disabled={busyId === g.consignorId}
                            className="text-xs font-semibold text-emerald-600 px-1.5"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <p className="truncate text-sm font-bold text-slate-900">{g.name}</p>
                      )}
                    </div>
                    {g.consignorId !== null && editingId !== g.consignorId && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(g.consignorId);
                            setEditingName(g.name);
                          }}
                          disabled={busyId === g.consignorId}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Renombrar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(g.consignorId as number, g.name)}
                          disabled={busyId === g.consignorId}
                          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm font-bold text-slate-900 shrink-0">
                      {formatCurrency(g.totalValue)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-slate-400">Total</p>
                      <p className="font-semibold text-slate-700">
                        {g.totalCards} cartas · {g.totalQuantity} unid.
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <p className="text-emerald-500">Vendido</p>
                      <p className="font-semibold text-emerald-700">
                        {g.soldQuantity} unid. · {formatCurrency(g.soldValue)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2">
                      <p className="text-amber-500">Disponible</p>
                      <p className="font-semibold text-amber-700">
                        {g.availableQuantity} unid. · {formatCurrency(g.availableValue)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-xl bg-slate-900 p-3 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">Total de la carpeta</p>
                  <p className="text-lg font-bold">{formatCurrency(data.grandTotal.totalValue)}</p>
                </div>
                <div className="flex gap-4 text-xs text-slate-300">
                  <span>{data.grandTotal.totalCards} cartas</span>
                  <span>Vendido: {formatCurrency(data.grandTotal.soldValue)}</span>
                  <span>Disponible: {formatCurrency(data.grandTotal.availableValue)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center pt-1">
                "Vendido" usa el precio real de venta. "Disponible" es un
                valor estimado (precio personalizado o market price).
              </p>
            </div>
          )}
        </div>
      </div>
    </BaseDrawer>
  );
};

export default ConsignmentReportDrawer;
