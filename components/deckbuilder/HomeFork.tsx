// app/deckbuilder/[uniqueUrl]/fork/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useCards } from "@/hooks/useCards";
import { useI18n } from "@/components/i18n/I18nProvider";

const ForkDeckBuilder = () => {
  const { t } = useI18n();
  const { data: cards = [], isLoading } = useCards();
  const router = useRouter();
  const params = useParams();
  const uniqueUrl = Array.isArray(params.uniqueUrl)
    ? params.uniqueUrl[0]
    : params.uniqueUrl;

  const deckBuilder = useDeckBuilder(uniqueUrl);

  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  const handleForkSave = async () => {
    if (deckBuilder.isSaving) return;
    if (!deckBuilder.selectedLeader) {
      console.error("No se ha seleccionado un Leader.");
      return;
    }
    if (totalCards !== 50) {
      console.error("El deck debe tener 50 cartas (excluyendo al Leader).");
      return;
    }

    const payloadCards = [
      { cardId: deckBuilder.selectedLeader.id, quantity: 1 },
      ...deckBuilder.deckCards.map((card) => ({
        cardId: card.cardId,
        quantity: card.quantity,
      })),
    ];

    const deckName = t("deckbuilder.forkDeckName");
    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch(`/api/decks/${uniqueUrl}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName, cards: payloadCards }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error al forkar deck:", errorData.error);
        deckBuilder.setIsSaving(false);
        return;
      }
      const newDeck = await response.json();
      deckBuilder.setIsSaving(false);
      router.push(`/deckbuilder/${newDeck.uniqueUrl}`);
    } catch (error) {
      console.error("Error al forkar deck:", error);
      deckBuilder.setIsSaving(false);
    }
  };

  const handleRestart = () => {
    deckBuilder.setSelectedLeader(null);
    deckBuilder.setDeckCards([]);
  };

  const handleProxies = () => {
    // Incluir el leader al inicio si existe
    const leaderCards = deckBuilder.selectedLeader
      ? [
          {
            cardId: Number(deckBuilder.selectedLeader.id),
            id: Number(deckBuilder.selectedLeader.id),
            name: deckBuilder.selectedLeader.name,
            rarity: deckBuilder.selectedLeader.rarity ?? "",
            quantity: 1,
            src: deckBuilder.selectedLeader.src,
            code: deckBuilder.selectedLeader.code,
            category: deckBuilder.selectedLeader.category,
            color: deckBuilder.selectedLeader.colors[0].color,
            colors: deckBuilder.selectedLeader.colors,
            cost: deckBuilder.selectedLeader.cost ?? "",
            set: deckBuilder.selectedLeader.sets[0].set.title,
            power: deckBuilder.selectedLeader.power ?? "",
            counter: deckBuilder.selectedLeader.counter ?? "",
            attribute: deckBuilder.selectedLeader.attribute ?? "",
          },
        ]
      : [];

    // Expandir cartas según su cantidad para impresión
    const expandedCards = [
      ...leaderCards,
      ...deckBuilder.deckCards.flatMap((card) => Array(card.quantity).fill(card)),
    ];

    if (expandedCards.length === 0) {
      alert(t("deckbuilder.noCardsToPrint"));
      return;
    }

    // Función helper para determinar si necesita proxy
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

    // Crear modal de impresión
    const printModal = document.createElement("div");
    printModal.className = "print-modal";
    printModal.innerHTML = `
      <style>
        .print-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .print-modal-content {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .print-modal-header {
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .print-modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .print-modal-actions {
          display: flex;
          gap: 10px;
        }

        .print-modal-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .print-modal-btn-primary {
          background: #2196F3;
          color: white;
        }

        .print-modal-btn-primary:hover {
          background: #1976d2;
          transform: translateY(-1px);
        }

        .print-modal-btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
        }

        .print-modal-btn-close {
          background: #f5f5f5;
          color: #666;
        }

        .print-modal-btn-close:hover {
          background: #e0e0e0;
        }

        .print-preview-container {
          flex: 1;
          overflow: auto;
          padding: 20px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .print-preview-iframe {
          width: 100%;
          height: 600px;
          border: none;
          background: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }

        .loading-container {
          text-align: center;
          padding: 40px;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #2196F3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 18px;
          color: #666;
          margin-bottom: 10px;
        }

        .loading-progress {
          font-size: 14px;
          color: #999;
        }
      </style>

      <div class="print-modal-content">
        <div class="print-modal-header">
          <h2>${t("deckbuilder.printPdfTitle")}</h2>
          <div class="print-modal-actions">
            <button id="print-btn" class="print-modal-btn print-modal-btn-primary" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
              </svg>
              ${t("deckbuilder.printPdf")}
            </button>
            <button class="print-modal-btn print-modal-btn-close" id="close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              ${t("deckbuilder.close")}
            </button>
          </div>
        </div>
        <div class="print-preview-container">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">${t("deckbuilder.generatingPdf")}</div>
            <div class="loading-progress">${t(
              "deckbuilder.preparingImages"
            )}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(printModal);

    const closeModal = () => {
      printModal.remove();
      document.removeEventListener("keydown", handleEsc);
    };

    const closeBtn = document.getElementById("close-modal-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleEsc);

    printModal.addEventListener("click", (e) => {
      if (e.target === printModal) {
        closeModal();
      }
    });

    generatePDFContent();

    async function generatePDFContent() {
      try {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);

        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
        });

        const { jsPDF } = (window as any).jspdf;

        const loadingProgress = printModal.querySelector(
          ".loading-progress"
        ) as HTMLElement;

        if (loadingProgress) {
          loadingProgress.textContent = `Cargando ${expandedCards.length} imágenes...`;
        }

        const imageCache = new Map<number, string>();
        const loadPromises: Promise<void>[] = [];

        for (let i = 0; i < expandedCards.length; i++) {
          const card = expandedCards[i];
          const proxiedUrl = getProxiedImageUrl(card.src);

          const promise = loadImageWithProxy(proxiedUrl)
            .then((imgData: string) => {
              imageCache.set(i, imgData);
              if (loadingProgress) {
                loadingProgress.textContent = `Cargando imágenes... ${imageCache.size}/${expandedCards.length}`;
              }
            })
            .catch((error) => {
              console.warn(`Error cargando imagen ${i}:`, error);
              imageCache.set(i, "error");
              if (loadingProgress) {
                loadingProgress.textContent = `Cargando imágenes... ${
                  imageCache.size
                }/${expandedCards.length} (${
                  imageCache.size -
                  Array.from(imageCache.values()).filter((v) => v === "error")
                    .length
                } exitosas)`;
              }
            });
          loadPromises.push(promise);
        }

        await Promise.all(loadPromises);

        if (loadingProgress) {
          loadingProgress.textContent = "Creando PDF...";
        }

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

        const drawPlaceholder = (
          x: number,
          y: number,
          card: any,
          globalIndex: number
        ) => {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(x, y, cardWidth, cardHeight, "F");
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.5);
          pdf.rect(x, y, cardWidth, cardHeight, "S");

          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const text = card.name || `Carta ${globalIndex + 1}`;
          const lines = pdf.splitTextToSize(text, cardWidth - 10);
          pdf.text(
            lines,
            x + cardWidth / 2,
            y + cardHeight / 2 - lines.length * 2,
            {
              align: "center",
            }
          );

          if (card.code) {
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(card.code, x + cardWidth / 2, y + cardHeight / 2 + 10, {
              align: "center",
            });
          }

          pdf.setFontSize(7);
          pdf.setTextColor(200, 100, 100);
          pdf.text(
            "Error al cargar imagen",
            x + cardWidth / 2,
            y + cardHeight - 5,
            {
              align: "center",
            }
          );
        };

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          if (loadingProgress) {
            loadingProgress.textContent = `Generando página ${
              pageIndex + 1
            } de ${pages.length}`;
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
                pdf.addImage(
                  imgData,
                  "JPEG",
                  x,
                  y,
                  cardWidth,
                  cardHeight,
                  `card_${pageIndex}_${i}`,
                  "NONE"
                );
              } catch (error) {
                console.error(`Error agregando imagen al PDF:`, error);
                drawPlaceholder(x, y, card, globalIndex);
              }
            } else {
              drawPlaceholder(x, y, card, globalIndex);
            }
          }

          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }

        if (loadingProgress) {
          loadingProgress.textContent = "Finalizando PDF...";
        }

        const pdfBlob = pdf.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const previewContainer = printModal.querySelector(
          ".print-preview-container"
        ) as HTMLElement;

        if (previewContainer) {
          previewContainer.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
              <iframe id="pdf-preview" class="print-preview-iframe" src="${pdfUrl}"></iframe>
            </div>
          `;
        }

        const printBtn = document.getElementById(
          "print-btn"
        ) as HTMLButtonElement;
        if (printBtn) {
          printBtn.disabled = false;
          printBtn.onclick = () => {
            const iframe = document.getElementById(
              "pdf-preview"
            ) as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.print();
            }
          };
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        const previewContainer = printModal.querySelector(
          ".print-preview-container"
        ) as HTMLElement;

        if (previewContainer) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : t("deckbuilder.unknownError");
          previewContainer.innerHTML = `
            <div class="loading-container">
              <div style="color: #f44336; font-size: 18px;">${t(
                "deckbuilder.pdfErrorTitle"
              )}</div>
              <div style="color: #666; margin-top: 10px;">${t(
                "deckbuilder.pdfErrorSubtitle"
              )}</div>
              <div style="color: #999; margin-top: 5px; font-size: 12px;">${errorMessage}</div>
            </div>
          `;
        }
      }
    }

    async function loadImageWithProxy(url: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const img = new Image();

        if (!url.startsWith("/api/proxy-image")) {
          img.crossOrigin = "anonymous";
        }

        const timeout = setTimeout(() => {
          img.src = "";
          reject(new Error(t("deckbuilder.imageTimeout")));
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
              reject(new Error(t("deckbuilder.canvasError")));
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        img.onerror = function () {
          clearTimeout(timeout);
          reject(new Error(t("deckbuilder.imageLoadError")));
        };

        img.src = url;
      });
    }
  };

  // ✅ TanStack Query maneja el fetch automáticamente
  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleForkSave}
      onRestart={handleRestart}
      onProxies={handleProxies}
      initialCards={cards as CardWithCollectionData[]}
      isFork={true}
    />
  );
};

export default ForkDeckBuilder;
