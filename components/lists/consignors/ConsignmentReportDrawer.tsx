"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users, Download, FileDown, AlertCircle, Info } from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

declare global {
  interface Window {
    jspdf: { jsPDF: any };
  }
}

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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);

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

  const exportPdf = useCallback(async () => {
    if (!data) return;
    setGeneratingPdf(true);
    try {
      if (!window.jspdf) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Error cargando la librería de PDF"));
        });
      }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [210, 297], compress: true });

      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, 32, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Reporte de Consignación", margin, 16);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(data.listName, margin, 25);

      let y = 45;
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(9);
      pdf.text(
        `Generado: ${new Date(data.generatedAt).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}`,
        margin,
        y
      );

      y += 10;
      const drawHeader = (headerY: number) => {
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, headerY, contentWidth, 9, "F");
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("Consignatario", margin + 3, headerY + 6);
        pdf.text("Cartas", margin + 75, headerY + 6);
        pdf.text("Vendido", margin + 100, headerY + 6);
        pdf.text("Disponible", margin + 135, headerY + 6);
        pdf.text("Total", margin + 170, headerY + 6);
      };
      drawHeader(y);
      y += 13;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      data.groups.forEach((g, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 4, contentWidth, 8, "F");
        }
        pdf.setTextColor(30, 41, 59);
        pdf.text(g.name.length > 30 ? g.name.slice(0, 30) + "…" : g.name, margin + 3, y);
        pdf.text(`${g.totalCards} (${g.totalQuantity})`, margin + 75, y);
        pdf.setTextColor(5, 150, 105);
        pdf.text(formatCurrency(g.soldValue), margin + 100, y);
        pdf.setTextColor(217, 119, 6);
        pdf.text(formatCurrency(g.availableValue), margin + 135, y);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont("helvetica", "bold");
        pdf.text(formatCurrency(g.totalValue), margin + 170, y);
        pdf.setFont("helvetica", "normal");
        y += 8;
      });

      y += 6;
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, margin + contentWidth, y);
      y += 10;

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, y, contentWidth, 30, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Total de la carpeta", margin + 8, y + 11);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatCurrency(data.grandTotal.totalValue), margin + 8, y + 24);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `${data.grandTotal.totalCards} cartas  ·  Vendido: ${formatCurrency(data.grandTotal.soldValue)}  ·  Disponible: ${formatCurrency(data.grandTotal.availableValue)}`,
        margin + 70,
        y + 18
      );

      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(7.5);
      pdf.text(
        '"Vendido" usa el precio real de venta. "Disponible" es un valor estimado (precio personalizado o market price).',
        margin,
        y + 40
      );

      const safeName = listName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      pdf.save(`consignacion-${safeName}.pdf`);
      toast.success("PDF descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }, [data, listName]);

  // Deslinda TODAS las cartas de un consignatario en esta lista de golpe
  // (no lo elimina — sigue disponible para reutilizarlo después).
  const handleUnassignAll = useCallback(
    async (consignorId: number, name: string) => {
      if (
        !window.confirm(
          `¿Quitar a "${name}" de TODAS sus cartas en esta carpeta? Las cartas no se borran, solo vuelven a contar como tuyas.`
        )
      )
        return;
      setUnassigningId(consignorId);
      try {
        const res = await fetch(
          `/api/lists/${listId}/consignors/${consignorId}/unassign-all`,
          { method: "PUT" }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al deslindar");
        toast.success(`${body.updated ?? 0} carta(s) desligadas de ${name}`);
        fetchReport();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al deslindar");
      } finally {
        setUnassigningId(null);
      }
    },
    [listId, fetchReport]
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
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={exportPdf}
                disabled={generatingPdf}
                className="gap-1.5"
              >
                {generatingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportCsv}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
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
              <div className="flex gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
                <Info className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
                <p className="text-xs text-purple-800">
                  <span className="font-semibold">¿Cómo asigno cartas a alguien?</span>{" "}
                  En la carpeta, abre "Opciones" → "Modo asignar consignatario",
                  toca las cartas que quieras y luego{" "}
                  <span className="font-semibold">"Asignar a…"</span>. Ahí mismo
                  puedes renombrar o eliminar consignatarios (pasa el mouse
                  sobre uno en la lista). Las cartas sin asignar cuentan como
                  tuyas. Este panel es solo una vista previa — para llevártelo
                  usa PDF o CSV arriba.
                </p>
              </div>

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
                      <p className="truncate text-sm font-bold text-slate-900">{g.name}</p>
                    </div>
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
                  {g.consignorId !== null && g.totalCards > 0 && (
                    <button
                      onClick={() => handleUnassignAll(g.consignorId as number, g.name)}
                      disabled={unassigningId === g.consignorId}
                      className="mt-2 w-full text-xs font-medium py-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 transition-colors"
                    >
                      {unassigningId === g.consignorId
                        ? "Desligando…"
                        : `Desligar todas sus cartas (${g.totalCards})`}
                    </button>
                  )}
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
