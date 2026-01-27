"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, FileDown, DollarSign, AlertCircle } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import BaseDrawer from "@/components/ui/BaseDrawer";
import type { CollectionReportData } from "@/types";

// Simple Modal wrapper for desktop (avoids drag handler issues)
const DesktopModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  preventClose?: boolean;
}> = ({ isOpen, onClose, children, preventClose }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 300);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => !preventClose && onClose()}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto transition-all duration-300 ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
};

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

interface CollectionReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  listName: string;
}

type ReportStatus = "idle" | "fetching" | "generating" | "ready" | "error";

interface ReportProgress {
  current: number;
  total: number;
  message: string;
  phase: "fetching" | "images" | "pdf";
}

const CollectionReportDrawer: React.FC<CollectionReportDrawerProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
}) => {
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [progress, setProgress] = useState<ReportProgress>({
    current: 0,
    total: 0,
    message: "",
    phase: "fetching",
  });
  const [reportData, setReportData] = useState<CollectionReportData | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleClose = useCallback(() => {
    if (status === "fetching" || status === "generating") return;
    setStatus("idle");
    setProgress({ current: 0, total: 0, message: "", phase: "fetching" });
    setReportData(null);
    setError(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfBlob(null);
    setPdfUrl(null);
    onClose();
  }, [pdfUrl, onClose, status]);

  // Load image with proxy support
  const loadImageWithProxy = useCallback(
    async (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();

        if (!url.startsWith("/api/proxy-image")) {
          img.crossOrigin = "anonymous";
        }

        const timeout = setTimeout(() => {
          img.src = "";
          reject(new Error("Timeout loading image"));
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
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } else {
              reject(new Error("Could not get canvas context"));
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        img.onerror = function () {
          clearTimeout(timeout);
          reject(new Error("Error loading image"));
        };

        img.src = url;
      });
    },
    []
  );

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Format currency with thousands separators
  const formatCurrency = (value: number | null): string => {
    if (value === null) return "N/A";
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format number with thousands separators for PDF (returns string like "$1,234.56")
  const formatPdfCurrency = (value: number): string => {
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Generate the PDF report
  const generateReport = useCallback(async () => {
    setStatus("fetching");
    setError(null);
    setProgress({
      current: 0,
      total: 1,
      message: "Fetching sales data from TCGPlayer...",
      phase: "fetching",
    });

    try {
      // 1. Fetch report data from API
      const response = await fetch(`/api/lists/${listId}/sales-report`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data: CollectionReportData = await response.json();
      setReportData(data);

      if (data.cards.length === 0) {
        throw new Error("No cards with TCGPlayer data found in this list");
      }

      // 2. Load jsPDF
      setStatus("generating");
      setProgress({
        current: 0,
        total: data.cards.length,
        message: "Loading PDF library...",
        phase: "images",
      });

      if (!window.jspdf) {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Error loading jsPDF"));
        });
      }

      const { jsPDF } = window.jspdf;

      // 3. Load card images
      setProgress({
        current: 0,
        total: data.cards.length,
        message: "Loading card images...",
        phase: "images",
      });

      // Use cardSrc (image URL) as cache key since cardCode can be duplicated for variants
      const imageCache = new Map<string, string>();
      const cardsWithImages = data.cards.filter((c) => c.cardSrc);

      // Get unique image URLs to avoid loading the same image twice
      const uniqueImageUrls = [...new Set(cardsWithImages.map((c) => c.cardSrc))];

      for (let i = 0; i < uniqueImageUrls.length; i++) {
        const imageUrl = uniqueImageUrls[i];
        const proxiedUrl = getProxiedImageUrl(imageUrl);

        try {
          const imgData = await loadImageWithProxy(proxiedUrl);
          imageCache.set(imageUrl, imgData);
        } catch (error) {
          console.warn(`Error loading image:`, error);
          imageCache.set(imageUrl, "error");
        }

        setProgress({
          current: i + 1,
          total: uniqueImageUrls.length,
          message: `Loading images... ${i + 1}/${uniqueImageUrls.length}`,
          phase: "images",
        });
      }

      // 4. Generate PDF
      setProgress({
        current: 0,
        total: 1,
        message: "Generating PDF...",
        phase: "pdf",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [210, 297], // A4
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // ========== COVER PAGE ==========
      // Header
      pdf.setFillColor(30, 41, 59); // slate-800
      pdf.rect(0, 0, pageWidth, 60, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("Collection Report", margin, 30);

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(data.listName, margin, 45);

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184); // slate-400
      const reportDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      pdf.text(`Generated: ${reportDate}`, margin, 55);

      // Summary Box
      let y = 75;

      pdf.setFillColor(241, 245, 249); // slate-100
      pdf.roundedRect(margin, y, contentWidth, 70, 3, 3, "F");

      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Summary", margin + 10, y + 15);

      // Stats
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(71, 85, 105); // slate-600

      const statsY = y + 30;
      pdf.text(`Total Unique Cards: ${data.totalCards}`, margin + 10, statsY);
      pdf.text(`Total Quantity: ${data.totalQuantity}`, margin + 10, statsY + 8);
      pdf.text(
        `Successful Lookups: ${data.successfulLookups}`,
        margin + 10,
        statsY + 16
      );
      pdf.text(`Failed Lookups: ${data.failedLookups}`, margin + 10, statsY + 24);

      // Value Box
      y = 155;
      pdf.setFillColor(22, 163, 74); // green-600
      pdf.roundedRect(margin, y, contentWidth, 45, 3, 3, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Total Collection Value", margin + 10, y + 12);

      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatPdfCurrency(data.totalValue), margin + 10, y + 32);

      // Negotiation Values
      y = 210;
      pdf.setFillColor(251, 191, 36); // amber-400
      pdf.roundedRect(margin, y, contentWidth / 2 - 5, 35, 3, 3, "F");

      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("80% Value", margin + 10, y + 12);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatPdfCurrency(data.value80Percent), margin + 10, y + 27);

      pdf.setFillColor(249, 115, 22); // orange-500
      pdf.roundedRect(
        margin + contentWidth / 2 + 5,
        y,
        contentWidth / 2 - 5,
        35,
        3,
        3,
        "F"
      );

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("70% Value", margin + contentWidth / 2 + 15, y + 12);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        formatPdfCurrency(data.value70Percent),
        margin + contentWidth / 2 + 15,
        y + 27
      );

      // Methodology note
      y = 260;
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const methodologyText = [
        "Methodology: Prices are based on the average of the 3 most recent sales",
        "from TCGPlayer (English versions only, excluding graded cards).",
        "The 70% and 80% values are provided as negotiation reference points.",
      ];
      methodologyText.forEach((line, i) => {
        pdf.text(line, margin, y + i * 5);
      });

      // ========== CARD DETAILS PAGES ==========
      const cardsPerPage = 4;
      const cardImageWidth = 35;
      const cardImageHeight = 49;

      for (let i = 0; i < data.cards.length; i += cardsPerPage) {
        pdf.addPage();

        // Page header
        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, pageWidth, 25, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Card Details", margin, 16);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const pageNum = Math.floor(i / cardsPerPage) + 2;
        const totalPages =
          Math.ceil(data.cards.length / cardsPerPage) + 2; // +2 for cover and summary
        pdf.text(
          `Page ${pageNum} of ${totalPages}`,
          pageWidth - margin - 30,
          16
        );

        y = 35;

        const pageCards = data.cards.slice(i, i + cardsPerPage);

        for (const card of pageCards) {
          // Card container
          pdf.setDrawColor(226, 232, 240); // slate-200
          pdf.setLineWidth(0.5);
          pdf.roundedRect(margin, y, contentWidth, 60, 2, 2, "S");

          // Card image - use cardSrc as cache key since cardCode can be duplicated
          const imgData = imageCache.get(card.cardSrc);
          if (imgData && imgData !== "error") {
            try {
              pdf.addImage(
                imgData,
                "JPEG",
                margin + 5,
                y + 5,
                cardImageWidth,
                cardImageHeight,
                undefined, // Let jsPDF auto-generate alias
                "NONE"
              );
            } catch {
              // Draw placeholder
              pdf.setFillColor(241, 245, 249);
              pdf.rect(margin + 5, y + 5, cardImageWidth, cardImageHeight, "F");
              pdf.setTextColor(148, 163, 184);
              pdf.setFontSize(8);
              pdf.text("No Image", margin + 10, y + 30);
            }
          } else {
            // Draw placeholder
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin + 5, y + 5, cardImageWidth, cardImageHeight, "F");
            pdf.setTextColor(148, 163, 184);
            pdf.setFontSize(8);
            pdf.text("No Image", margin + 10, y + 30);
          }

          // Card info
          const infoX = margin + cardImageWidth + 15;
          const infoWidth = contentWidth - cardImageWidth - 20;

          pdf.setTextColor(30, 41, 59);
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          const cardName =
            card.cardName.length > 35
              ? card.cardName.substring(0, 35) + "..."
              : card.cardName;
          pdf.text(cardName, infoX, y + 10);

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Code: ${card.cardCode}`, infoX, y + 17);
          pdf.text(`Quantity: ${card.quantity}`, infoX + 50, y + 17);

          // Sales history
          if (card.lastSales && card.lastSales.length > 0) {
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            pdf.text("Recent Sales:", infoX, y + 26);

            let salesY = y + 32;
            card.lastSales.slice(0, 3).forEach((sale, idx) => {
              const saleDate = formatDate(sale.orderDate);
              const condition = sale.condition || "NM";
              const price = formatCurrency(sale.purchasePrice);
              pdf.text(
                `${idx + 1}. ${saleDate} - ${condition} - ${price}`,
                infoX,
                salesY
              );
              salesY += 5;
            });
          } else if (card.error) {
            pdf.setTextColor(239, 68, 68); // red-500
            pdf.setFontSize(8);
            pdf.text(`Error: ${card.error}`, infoX, y + 26);
          } else {
            pdf.setTextColor(148, 163, 184);
            pdf.setFontSize(8);
            pdf.text("No sales data available", infoX, y + 26);
          }

          // Average and subtotal
          const avgX = pageWidth - margin - 45;
          pdf.setFillColor(241, 245, 249);
          pdf.roundedRect(avgX - 5, y + 3, 48, 54, 2, 2, "F");

          pdf.setTextColor(71, 85, 105);
          pdf.setFontSize(8);
          pdf.text("Avg Price", avgX, y + 12);

          pdf.setTextColor(30, 41, 59);
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(formatCurrency(card.top3Average), avgX, y + 22);

          pdf.setTextColor(71, 85, 105);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.text("Subtotal", avgX, y + 35);

          pdf.setTextColor(22, 163, 74); // green-600
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text(formatCurrency(card.subtotal), avgX, y + 45);

          y += 65;
        }
      }

      // ========== SUMMARY PAGE ==========
      pdf.addPage();

      // Header
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, 25, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Complete Breakdown", margin, 16);

      // Table header
      y = 35;
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, contentWidth, 10, "F");

      pdf.setTextColor(71, 85, 105);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Code", margin + 3, y + 7);
      pdf.text("Name", margin + 35, y + 7);
      pdf.text("Qty", margin + 110, y + 7);
      pdf.text("Avg", margin + 125, y + 7);
      pdf.text("Subtotal", margin + 150, y + 7);

      y += 12;

      // Table rows
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      let rowCount = 0;
      const maxRowsPerPage = 30;

      for (const card of data.cards) {
        if (rowCount >= maxRowsPerPage && rowCount > 0) {
          pdf.addPage();
          y = 15;
          rowCount = 0;

          // Re-draw header on new page
          pdf.setFillColor(241, 245, 249);
          pdf.rect(margin, y, contentWidth, 10, "F");

          pdf.setTextColor(71, 85, 105);
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.text("Code", margin + 3, y + 7);
          pdf.text("Name", margin + 35, y + 7);
          pdf.text("Qty", margin + 110, y + 7);
          pdf.text("Avg", margin + 125, y + 7);
          pdf.text("Subtotal", margin + 150, y + 7);

          y += 12;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
        }

        // Alternate row background
        if (rowCount % 2 === 0) {
          pdf.setFillColor(248, 250, 252); // slate-50
          pdf.rect(margin, y - 3, contentWidth, 7, "F");
        }

        pdf.setTextColor(30, 41, 59);
        pdf.text(card.cardCode, margin + 3, y);

        const shortName =
          card.cardName.length > 40
            ? card.cardName.substring(0, 40) + "..."
            : card.cardName;
        pdf.text(shortName, margin + 35, y);

        pdf.text(String(card.quantity), margin + 113, y);
        pdf.text(formatCurrency(card.top3Average), margin + 125, y);

        pdf.setTextColor(22, 163, 74);
        pdf.text(formatCurrency(card.subtotal), margin + 150, y);

        y += 7;
        rowCount++;
      }

      // Final totals
      y += 10;
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(1);
      pdf.line(margin, y, margin + contentWidth, y);

      y += 10;
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL VALUE:", margin + 100, y);
      pdf.setTextColor(22, 163, 74);
      pdf.setFontSize(14);
      pdf.text(formatPdfCurrency(data.totalValue), margin + 150, y);

      y += 12;
      pdf.setTextColor(251, 191, 36); // amber
      pdf.setFontSize(11);
      pdf.text("80% Value:", margin + 100, y);
      pdf.text(formatPdfCurrency(data.value80Percent), margin + 150, y);

      y += 10;
      pdf.setTextColor(249, 115, 22); // orange
      pdf.text("70% Value:", margin + 100, y);
      pdf.text(formatPdfCurrency(data.value70Percent), margin + 150, y);

      // 5. Generate blob
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      setPdfBlob(blob);
      setPdfUrl(url);
      setStatus("ready");
      setProgress({
        current: 1,
        total: 1,
        message: "Report ready!",
        phase: "pdf",
      });
    } catch (err: any) {
      console.error("Error generating report:", err);
      setStatus("error");
      setError(err.message || "Unknown error occurred");
      showErrorToast(err.message || "Error generating report");
    }
  }, [listId, loadImageWithProxy]);

  // Download PDF
  const downloadPDF = useCallback(() => {
    if (!pdfBlob) return;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(pdfBlob);
    const safeName = listName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    link.download = `collection-report-${safeName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("Report downloaded!");
  }, [pdfBlob, listName]);

  // Reset state
  const resetState = useCallback(() => {
    setStatus("idle");
    setReportData(null);
    setError(null);
    setPdfBlob(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }, [pdfUrl]);

  const isLoading = status === "fetching" || status === "generating";

  // Content shared between mobile and desktop
  const content = (
    <div className="pt-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <h2 className="text-xl font-bold text-slate-900">Collection Report</h2>
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-500">List</span>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-none">
              {listName}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        {/* Idle state */}
        {status === "idle" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Generate Valuation Report
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
              Create a professional PDF with TCGPlayer sales data, pricing
              averages, and negotiation values (70% / 80%).
            </p>
            <Button
              onClick={generateReport}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
            >
              <FileDown className="w-5 h-5 mr-2" />
              Generate Report
            </Button>
            <p className="text-xs text-slate-400 mt-3">
              This may take a few moments depending on the number of cards.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-amber-100 rounded-full" />
              <div
                className="absolute inset-0 border-4 border-amber-500 rounded-full animate-spin"
                style={{
                  borderTopColor: "transparent",
                  borderRightColor: "transparent",
                }}
              />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {status === "fetching"
                ? "Fetching Sales Data..."
                : "Generating PDF..."}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{progress.message}</p>
            {progress.total > 0 && progress.phase !== "fetching" && (
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
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

        {/* Ready state */}
        {status === "ready" && reportData && (
          <div className="text-center py-6">
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Report Ready!
            </h3>

            {/* Quick stats */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Total Value</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(reportData.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cards</p>
                  <p className="text-lg font-bold text-slate-900">
                    {reportData.totalQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">80% Value</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrency(reportData.value80Percent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">70% Value</p>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(reportData.value70Percent)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={downloadPDF}
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
              >
                <FileDown className="w-5 h-5 mr-2" />
                Download PDF Report
              </Button>

              <Button
                onClick={resetState}
                variant="ghost"
                className="w-full h-10 text-slate-500 text-sm"
              >
                Generate Again
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Error</h3>
            <p className="text-sm text-red-500 mb-6 max-w-xs mx-auto">
              {error || "An error occurred while generating the report."}
            </p>
            <Button
              onClick={generateReport}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Use DesktopModal on desktop, BaseDrawer on mobile
  if (isMobile) {
    return (
      <BaseDrawer
        isOpen={isOpen}
        onClose={handleClose}
        preventClose={isLoading}
        maxHeight="90vh"
      >
        {content}
      </BaseDrawer>
    );
  }

  return (
    <DesktopModal
      isOpen={isOpen}
      onClose={handleClose}
      preventClose={isLoading}
    >
      {content}
    </DesktopModal>
  );
};

export default CollectionReportDrawer;
