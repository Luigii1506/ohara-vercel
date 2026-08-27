"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Users,
  Download,
  FileDown,
  AlertCircle,
  Info,
  Tag,
} from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

declare global {
  interface Window {
    jspdf: { jsPDF: any };
  }
}

// Algunos dominios de imágenes bloquean el canvas (CORS) necesario para
// meterlas en el PDF — se piden a través del proxy propio en esos casos.
// Mismo tratamiento que usa CollectionReportDrawer para su PDF.
const getProxiedImageUrl = (originalUrl: string): string => {
  const problematicDomains = [
    "limitlesstcg.nyc3.digitaloceanspaces.com",
    "digitaloceanspaces.com",
    "limitlesstcg.nyc3.cdn.digitaloceanspaces.com",
    "en.onepiece-cardgame.com",
    "static.dotgg.gg",
    "i.pinimg.com",
    "assets.pokemon.com",
    "bez3ta.com",
    "spellmana.com",
    "oharatcg-21eab.kxcdn.com",
  ];
  try {
    const urlObj = new URL(originalUrl);
    const needsProxy = problematicDomains.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
    );
    return needsProxy ? `/api/proxy-image?url=${encodeURIComponent(originalUrl)}` : originalUrl;
  } catch {
    return originalUrl;
  }
};

const loadCardImageDataUrl = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith("/api/proxy-image")) {
      img.crossOrigin = "anonymous";
    }
    const timeout = setTimeout(() => {
      img.src = "";
      reject(new Error("Timeout cargando imagen"));
    }, 15000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 744;
        canvas.height = 1044;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Sin contexto de canvas");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Error cargando imagen"));
    };
    img.src = url;
  });

interface SoldItem {
  listCardId: number;
  cardId: number;
  code: string;
  name: string;
  src: string;
  quantity: number;
  soldPrice: number;
  isEstimatedPrice: boolean;
  soldAt: string | null;
  marketPriceUsd: number | null;
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
  soldItems: SoldItem[];
}

interface ConsignmentReportData {
  listName: string;
  listId: number;
  generatedAt: string;
  /** 1 USD = ? MXN, configurado en la carpeta. Null si la carpeta no tiene tipo de cambio. */
  exchangeRateMxn: number | null;
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

const formatDate = (iso: string | null) => {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMxn = (usdValue: number | null, rate: number | null): string | null => {
  if (usdValue === null || rate === null) return null;
  return (usdValue * rate).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Fila con la imagen real de la carta vendida — el corazón del reporte: qué
// se vendió, a cuánto (vs. el market de referencia), en USD y en MXN,
// siempre apilado verticalmente (nunca dos valores lado a lado).
const SoldCardRow = ({
  item,
  exchangeRateMxn,
}: {
  item: SoldItem;
  exchangeRateMxn: number | null;
}) => {
  const soldMxn = formatMxn(item.soldPrice, exchangeRateMxn);
  const marketMxn = formatMxn(item.marketPriceUsd, exchangeRateMxn);

  return (
    <div className="flex gap-2 rounded-lg border border-slate-100 p-2">
      {item.src ? (
        <img
          src={item.src}
          alt={item.name}
          className="h-16 w-16 flex-shrink-0 rounded object-cover bg-slate-100"
        />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 rounded bg-slate-100" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-col">
          <span className="truncate text-xs font-semibold text-slate-800">{item.name}</span>
          <span className="truncate text-[11px] text-slate-400">
            {item.code} · x{item.quantity} · {formatDate(item.soldAt)}
          </span>
        </div>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex flex-col">
            <span className="font-semibold text-emerald-500">
              Vendido{item.isEstimatedPrice ? " (est.)" : ""}
            </span>
            <span className="text-xs font-bold text-emerald-700">
              {formatCurrency(item.soldPrice)}
            </span>
            {soldMxn && <span className="text-emerald-600/80">{soldMxn}</span>}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-400">Market</span>
            <span className="text-xs font-bold text-slate-600">
              {item.marketPriceUsd !== null ? formatCurrency(item.marketPriceUsd) : "N/A"}
            </span>
            {marketMxn && <span className="text-slate-400">{marketMxn}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// Galería de cartas vendidas — SIEMPRE visible (no detrás de un acordeón
// que hay que abrir), porque esto es el punto central del reporte.
const SoldCardsGallery = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="mt-2 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/50 px-2 py-1.5 text-xs font-medium text-emerald-700">
      <Tag className="h-3 w-3" />
      {label}
    </div>
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{children}</div>
  </div>
);

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
      [],
      ["Detalle de ventas"],
      [
        "Consignatario",
        "Carta",
        "Código",
        "Cantidad",
        "Vendido (USD)",
        "Vendido (MXN)",
        "Estimado",
        "Market (USD)",
        "Market (MXN)",
        "Fecha de venta",
      ],
      ...data.groups.flatMap((g) =>
        g.soldItems.map((item) => [
          g.name,
          item.name,
          item.code,
          String(item.quantity),
          item.soldPrice.toFixed(2),
          data.exchangeRateMxn ? (item.soldPrice * data.exchangeRateMxn).toFixed(2) : "",
          item.isEstimatedPrice ? "Sí" : "No",
          item.marketPriceUsd !== null ? item.marketPriceUsd.toFixed(2) : "",
          item.marketPriceUsd !== null && data.exchangeRateMxn
            ? (item.marketPriceUsd * data.exchangeRateMxn).toFixed(2)
            : "",
          formatDate(item.soldAt),
        ])
      ),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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

      // Resumen general: una "card" por consignatario (no una tabla) — todo
      // apilado en vertical (nombre, total, luego cada stat en su propia
      // línea), igual que en la vista previa dentro de la app.
      const pageBottom = 280;
      const ensureSpace = (needed: number) => {
        if (y + needed > pageBottom) {
          pdf.addPage();
          y = 20;
        }
      };

      const hexToRgb = (hex: string | null): [number, number, number] => {
        if (!hex) return [148, 163, 184];
        const m = hex.replace("#", "");
        const n = parseInt(m, 16);
        if (Number.isNaN(n) || m.length !== 6) return [148, 163, 184];
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };

      // Misma rejilla vertical para TODAS las cajas (consignatarios + total
      // de la carpeta) — mismo alto, mismo espaciado entre líneas, mismos
      // márgenes arriba/abajo, para que se vean uniformes entre sí.
      const SUMMARY_BOX_HEIGHT = 46;
      const SUMMARY_LINE_NAME = 12; // nombre / "Total de la carpeta"
      const SUMMARY_LINE_VALUE = 23; // monto grande
      const SUMMARY_LINE_STAT1 = 31; // cartas/unid.
      const SUMMARY_LINE_STAT2 = 37; // vendido
      const SUMMARY_LINE_STAT3 = 43; // disponible

      y += 10;
      data.groups.forEach((g) => {
        ensureSpace(SUMMARY_BOX_HEIGHT + 4);

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(margin, y, contentWidth, SUMMARY_BOX_HEIGHT, 3, 3, "FD");

        const dotColor = g.consignorId === null ? [15, 23, 42] : hexToRgb(g.color);
        pdf.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
        pdf.circle(margin + 7, y + SUMMARY_LINE_NAME - 1.3, 1.8, "F");

        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(10.5);
        pdf.setFont("helvetica", "bold");
        const name = g.name.length > 45 ? g.name.slice(0, 45) + "…" : g.name;
        pdf.text(name, margin + 12, y + SUMMARY_LINE_NAME);

        pdf.setFontSize(15);
        pdf.text(formatCurrency(g.totalValue), margin + 12, y + SUMMARY_LINE_VALUE);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `${g.totalCards} carta(s)  ·  ${g.totalQuantity} unid.`,
          margin + 12,
          y + SUMMARY_LINE_STAT1
        );
        pdf.setTextColor(5, 150, 105);
        pdf.text(`Vendido: ${formatCurrency(g.soldValue)}`, margin + 12, y + SUMMARY_LINE_STAT2);
        pdf.setTextColor(217, 119, 6);
        pdf.text(
          `Disponible: ${formatCurrency(g.availableValue)}`,
          margin + 12,
          y + SUMMARY_LINE_STAT3
        );

        y += SUMMARY_BOX_HEIGHT + 4;
      });

      ensureSpace(SUMMARY_BOX_HEIGHT + 4);
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, y, contentWidth, SUMMARY_BOX_HEIGHT, 3, 3, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10.5);
      pdf.setFont("helvetica", "bold");
      pdf.text("Total de la carpeta", margin + 12, y + SUMMARY_LINE_NAME);
      pdf.setFontSize(15);
      pdf.text(
        formatCurrency(data.grandTotal.totalValue),
        margin + 12,
        y + SUMMARY_LINE_VALUE
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(203, 213, 225);
      pdf.text(
        `${data.grandTotal.totalCards} carta(s)  ·  ${data.grandTotal.totalQuantity} unid.`,
        margin + 12,
        y + SUMMARY_LINE_STAT1
      );
      pdf.setTextColor(110, 231, 183);
      pdf.text(
        `Vendido: ${formatCurrency(data.grandTotal.soldValue)}`,
        margin + 12,
        y + SUMMARY_LINE_STAT2
      );
      pdf.setTextColor(252, 211, 77);
      pdf.text(
        `Disponible: ${formatCurrency(data.grandTotal.availableValue)}`,
        margin + 12,
        y + SUMMARY_LINE_STAT3
      );
      y += SUMMARY_BOX_HEIGHT;

      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(7.5);
      pdf.text(
        '"Vendido" usa el precio real de venta. "Disponible" es un valor estimado (precio personalizado o market price).',
        margin,
        y + 8
      );

      const groupsWithSales = data.groups.filter((g) => g.soldItems.length > 0);
      if (groupsWithSales.length > 0) {
        // Precargamos cada imagen única UNA vez (varias cartas pueden
        // compartir el mismo src) y la convertimos a JPEG en un canvas —
        // jsPDF no puede usar una URL directamente, necesita el data URL.
        const allSoldItems = groupsWithSales.flatMap((g) => g.soldItems);
        const imageCache = new Map<string, string>();
        const uniqueImageUrls = Array.from(
          new Set(allSoldItems.map((it) => it.src).filter(Boolean))
        );
        for (const url of uniqueImageUrls) {
          try {
            imageCache.set(url, await loadCardImageDataUrl(getProxiedImageUrl(url)));
          } catch {
            imageCache.set(url, "error");
          }
        }

        pdf.addPage();
        y = 20;
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Detalle de ventas", margin, y);
        y += 10;

        const imgWidth = 20;
        const imgHeight = 28;
        const itemHeight = imgHeight + 3;

        groupsWithSales.forEach((g) => {
          ensureSpace(16);
          pdf.setFillColor(15, 23, 42);
          pdf.rect(margin, y - 5, contentWidth, 8, "F");
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "bold");
          pdf.text(
            `${g.name}  ·  ${g.soldItems.length} venta(s)  ·  ${formatCurrency(g.soldValue)}`,
            margin + 3,
            y
          );
          y += 10;

          g.soldItems.forEach((item, idx) => {
            ensureSpace(itemHeight + 2);
            if (idx % 2 === 0) {
              pdf.setFillColor(248, 250, 252);
              pdf.rect(margin, y - 3, contentWidth, itemHeight, "F");
            }

            const imgX = margin + 2;
            const imgY = y - 2;
            const imgData = imageCache.get(item.src);
            if (imgData && imgData !== "error") {
              try {
                pdf.addImage(imgData, "JPEG", imgX, imgY, imgWidth, imgHeight, undefined, "NONE");
              } catch {
                pdf.setFillColor(226, 232, 240);
                pdf.rect(imgX, imgY, imgWidth, imgHeight, "F");
              }
            } else {
              pdf.setFillColor(226, 232, 240);
              pdf.rect(imgX, imgY, imgWidth, imgHeight, "F");
            }

            const textX = imgX + imgWidth + 5;
            let ty = y + 3;

            pdf.setTextColor(30, 41, 59);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            const label = `${item.name} (${item.code})`;
            pdf.text(label.length > 45 ? label.slice(0, 45) + "…" : label, textX, ty);
            ty += 5.5;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Cantidad: ${item.quantity}   ·   ${formatDate(item.soldAt)}`, textX, ty);
            ty += 5.5;

            const soldMxn = formatMxn(item.soldPrice, data.exchangeRateMxn);
            pdf.setTextColor(5, 150, 105);
            pdf.text(
              `Vendido: ${formatCurrency(item.soldPrice)}${
                item.isEstimatedPrice ? " (est.)" : ""
              }${soldMxn ? "   ·   " + soldMxn : ""}`,
              textX,
              ty
            );
            ty += 5.5;

            const marketUsd =
              item.marketPriceUsd !== null ? formatCurrency(item.marketPriceUsd) : "N/A";
            const marketMxn = formatMxn(item.marketPriceUsd, data.exchangeRateMxn);
            pdf.setTextColor(217, 119, 6);
            pdf.text(`Market: ${marketUsd}${marketMxn ? "   ·   " + marketMxn : ""}`, textX, ty);

            y += itemHeight + 2;
          });
          y += 6;
        });
      }

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
                  <span className="font-semibold">"Asignar a…"</span>. Para
                  cambiar de color, renombrar o desligar a un consignatario,
                  usa "Opciones" → "Consignatarios". Las cartas sin asignar
                  cuentan como tuyas. Este panel es solo una vista previa —
                  para llevártelo usa PDF o CSV arriba.
                </p>
              </div>

              {data.groups.map((g) => (
                <div
                  key={g.consignorId ?? "mine"}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="mb-2 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color || (g.consignorId === null ? "#0f172a" : "#94a3b8") }}
                      />
                      <p className="truncate text-sm font-bold text-slate-900">{g.name}</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(g.totalValue)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 p-2">
                      <span className="text-slate-400">Total</span>
                      <span className="font-semibold text-slate-700">
                        {g.totalCards} cartas · {g.totalQuantity} unid.
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg bg-emerald-50 p-2">
                      <span className="text-emerald-500">Vendido</span>
                      <span className="font-semibold text-emerald-700">
                        {g.soldQuantity} unid. · {formatCurrency(g.soldValue)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg bg-amber-50 p-2">
                      <span className="text-amber-500">Disponible</span>
                      <span className="font-semibold text-amber-700">
                        {g.availableQuantity} unid. · {formatCurrency(g.availableValue)}
                      </span>
                    </div>
                  </div>
                  {g.soldItems.length > 0 && (
                    <SoldCardsGallery label={`Cartas vendidas (${g.soldItems.length})`}>
                      {g.soldItems.map((item) => (
                        <SoldCardRow
                          key={item.listCardId}
                          item={item}
                          exchangeRateMxn={data.exchangeRateMxn}
                        />
                      ))}
                    </SoldCardsGallery>
                  )}
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
                <div className="mb-2 flex flex-col gap-0.5">
                  <p className="text-sm font-bold">Total de la carpeta</p>
                  <p className="text-lg font-bold">{formatCurrency(data.grandTotal.totalValue)}</p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-300">
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
