"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Printer, FileDown } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import BaseDrawer from "@/components/ui/BaseDrawer";

// Declare jsPDF type for window
declare global {
  interface Window {
    jspdf: {
      jsPDF: any;
    };
  }
}

// Helper function to get proxied image URL
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
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
    );

    if (needsProxy) {
      return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
    }

    return originalUrl;
  } catch {
    return originalUrl;
  }
};

export interface ProxyCard {
  id: number;
  name: string;
  src: string;
  code?: string;
  quantity: number;
}

interface ProxiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cards: ProxyCard[];
  deckName?: string;
}

type ProxiesStatus = "idle" | "loading" | "ready" | "error";

const ProxiesDrawer: React.FC<ProxiesDrawerProps> = ({
  isOpen,
  onClose,
  cards,
  deckName = "deck",
}) => {
  const [status, setStatus] = useState<ProxiesStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleClose = useCallback(() => {
    setStatus("idle");
    setProgress({ current: 0, total: 0, message: "" });
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfBlob(null);
    setPdfUrl(null);
    onClose();
  }, [pdfUrl, onClose]);

  // Load image with proxy support
  const loadImageWithProxy = useCallback(async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      if (!url.startsWith("/api/proxy-image")) {
        img.crossOrigin = "anonymous";
      }

      const timeout = setTimeout(() => {
        img.src = "";
        reject(new Error("Timeout cargando imagen"));
      }, 15000);

      img.onload = function () {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 744;
          canvas.height = 1044;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.9));
          } else {
            reject(new Error("No se pudo obtener el contexto del canvas"));
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      img.onerror = function () {
        clearTimeout(timeout);
        reject(new Error("Error cargando imagen"));
      };

      img.src = url;
    });
  }, []);

  // Generate PDF
  const generatePDF = useCallback(async () => {
    // Expand cards by quantity
    const expandedCards = cards.flatMap((card) =>
      Array(card.quantity).fill(card)
    );

    if (expandedCards.length === 0) {
      showErrorToast("No hay cartas para imprimir");
      return;
    }

    setStatus("loading");
    setProgress({ current: 0, total: expandedCards.length, message: "Cargando jsPDF..." });

    try {
      // Load jsPDF if not already loaded
      if (!window.jspdf) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Error cargando jsPDF"));
        });
      }

      const { jsPDF } = window.jspdf;

      setProgress({ current: 0, total: expandedCards.length, message: "Cargando imágenes..." });

      // Load all images
      const imageCache = new Map<number, string>();

      for (let i = 0; i < expandedCards.length; i++) {
        const card = expandedCards[i];
        const proxiedUrl = getProxiedImageUrl(card.src);

        try {
          const imgData = await loadImageWithProxy(proxiedUrl);
          imageCache.set(i, imgData);
        } catch (error) {
          console.warn(`Error cargando imagen ${i}:`, error);
          imageCache.set(i, "error");
        }

        setProgress({
          current: i + 1,
          total: expandedCards.length,
          message: `Cargando imágenes... ${i + 1}/${expandedCards.length}`,
        });
      }

      setProgress({ current: expandedCards.length, total: expandedCards.length, message: "Generando PDF..." });

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [210, 297],
        compress: false,
      });

      const cardWidth = 62;
      const cardHeight = 87;
      const gap = 1;
      const startX = 11;
      const startY = 10;
      const cardsPerPage = 9;

      const pages = [];
      for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
        pages.push(expandedCards.slice(i, i + cardsPerPage));
      }

      const drawPlaceholder = (x: number, y: number, card: ProxyCard, globalIndex: number) => {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(x, y, cardWidth, cardHeight, "F");
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(x, y, cardWidth, cardHeight, "S");

        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        const text = card.name || `Carta ${globalIndex + 1}`;
        const lines = pdf.splitTextToSize(text, cardWidth - 10);
        pdf.text(lines, x + cardWidth / 2, y + cardHeight / 2 - lines.length * 2, { align: "center" });

        if (card.code) {
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(card.code, x + cardWidth / 2, y + cardHeight / 2 + 10, { align: "center" });
        }

        pdf.setFontSize(7);
        pdf.setTextColor(200, 100, 100);
        pdf.text("Error al cargar", x + cardWidth / 2, y + cardHeight - 5, { align: "center" });
      };

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const pageCards = pages[pageIndex];

        for (let i = 0; i < pageCards.length; i++) {
          const card = pageCards[i];
          const globalIndex = pageIndex * cardsPerPage + i;
          const row = Math.floor(i / 3);
          const col = i % 3;

          const x = startX + col * (cardWidth + gap);
          const y = startY + row * (cardHeight + gap);

          const imgData = imageCache.get(globalIndex);

          if (imgData && imgData !== "error") {
            try {
              pdf.addImage(imgData, "JPEG", x, y, cardWidth, cardHeight, `card_${pageIndex}_${i}`, "NONE");
            } catch (error) {
              console.error(`Error agregando imagen al PDF:`, error);
              drawPlaceholder(x, y, card, globalIndex);
            }
          } else {
            drawPlaceholder(x, y, card, globalIndex);
          }
        }
      }

      // Generate blob
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      setPdfBlob(blob);
      setPdfUrl(url);
      setStatus("ready");
      setProgress({ current: expandedCards.length, total: expandedCards.length, message: "PDF listo!" });

    } catch (error) {
      console.error("Error generating PDF:", error);
      setStatus("error");
      setProgress({ current: 0, total: 0, message: "Error al generar el PDF" });
      showErrorToast("Error al generar el PDF. Inténtalo de nuevo.");
    }
  }, [cards, loadImageWithProxy]);

  // Download PDF
  const downloadPDF = useCallback(() => {
    if (!pdfBlob) return;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(pdfBlob);
    link.download = `${deckName}-proxies.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("PDF descargado!");
  }, [pdfBlob, deckName]);

  // Print PDF
  const printPDF = useCallback(() => {
    if (!pdfUrl) return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 500);
    };
  }, [pdfUrl]);

  // Reset state
  const resetState = useCallback(() => {
    setStatus("idle");
    setPdfBlob(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }, [pdfUrl]);

  // Calculate total cards
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={status === "loading"}
      maxHeight="90vh"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Generar Proxies
        </h2>
        <button
          onClick={handleClose}
          disabled={status === "loading"}
          className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        {/* Idle state - Start button */}
        {status === "idle" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-violet-100 rounded-full flex items-center justify-center mb-4">
              <Printer className="w-10 h-10 text-violet-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              PDF de Proxies
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
              Genera un PDF con todas las cartas listas para imprimir como proxies.
            </p>
            <Button
              onClick={generatePDF}
              className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl"
            >
              <FileDown className="w-5 h-5 mr-2" />
              Generar PDF ({totalCards} cartas)
            </Button>
          </div>
        )}

        {/* Loading state */}
        {status === "loading" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
              <div
                className="absolute inset-0 border-4 border-violet-500 rounded-full animate-spin"
                style={{ borderTopColor: "transparent", borderRightColor: "transparent" }}
              />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Generando PDF...
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {progress.message}
            </p>
            {progress.total > 0 && (
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ready state - Download/Print buttons */}
        {status === "ready" && (
          <div className="text-center py-6">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              PDF Listo!
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Tu PDF está listo. Descárgalo o imprímelo directamente.
            </p>

            <div className="space-y-3">
              <Button
                onClick={downloadPDF}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl"
              >
                <FileDown className="w-5 h-5 mr-2" />
                Descargar PDF
              </Button>

              <Button
                onClick={printPDF}
                variant="outline"
                className="w-full h-12 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
              >
                <Printer className="w-5 h-5 mr-2" />
                Imprimir
              </Button>

              <Button
                onClick={resetState}
                variant="ghost"
                className="w-full h-10 text-slate-500 text-sm"
              >
                Generar de nuevo
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <X className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Error
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Hubo un error al generar el PDF. Inténtalo de nuevo.
            </p>
            <Button
              onClick={generatePDF}
              className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-xl"
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </BaseDrawer>
  );
};

export default ProxiesDrawer;
