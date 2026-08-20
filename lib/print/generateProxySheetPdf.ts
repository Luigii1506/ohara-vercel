import { getOptimizedImageUrl } from "@/lib/imageOptimization";

export interface PrintableCard {
  src: string;
  name: string;
  code: string;
  quantity: number;
}

export async function generateProxySheetPdf(
  cards: PrintableCard[]
): Promise<void> {
  const isMobileViewport =
    typeof window !== "undefined" && window.innerWidth < 768;
  const expandedCards = cards.flatMap((card) =>
    Array(card.quantity).fill(card)
  );

  if (expandedCards.length === 0) {
    alert("No cards in the proxy list to print");
    return;
  }

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

  const printModal = isMobileViewport ? null : document.createElement("div");

  if (printModal) {
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
          flex-wrap: wrap;
          gap: 10px;
        }

        .print-modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .print-modal-actions {
          display: flex;
          gap: 10px;
        }

        .print-modal-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }

        .print-modal-btn-primary {
          background: #7c3aed;
          color: white;
        }

        .print-modal-btn-primary:hover {
          background: #6d28d9;
        }

        .print-modal-btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
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
          border-top: 3px solid #7c3aed;
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
          <h2>Generate Proxy PDF</h2>
          <div class="print-modal-actions">
            <button id="print-btn" class="print-modal-btn print-modal-btn-primary" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
              </svg>
              Print PDF
            </button>
            <button class="print-modal-btn print-modal-btn-close" id="close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Close
            </button>
          </div>
        </div>
        <div class="print-preview-container">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Generating PDF...</div>
            <div class="loading-progress">Preparing images</div>
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
  }

  await generatePDFContent(printModal);

  async function generatePDFContent(modal: HTMLDivElement | null) {
    try {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(script);

      await new Promise<void>((resolve) => {
        script.onload = () => resolve();
      });

      const { jsPDF } = (window as any).jspdf;

      const loadingProgress = modal
        ? (modal.querySelector(".loading-progress") as HTMLElement)
        : null;

      if (loadingProgress) {
        loadingProgress.textContent = `Loading ${expandedCards.length} images...`;
      }

      const imageCache = new Map<number, string>();
      const loadPromises: Promise<void>[] = [];

      for (let i = 0; i < expandedCards.length; i++) {
        const card = expandedCards[i];
        const optimizedUrl = getOptimizedImageUrl(card.src, "large");
        const proxiedUrl = getProxiedImageUrl(optimizedUrl);

        const promise = loadImageWithProxy(proxiedUrl)
          .then((imgData: string) => {
            imageCache.set(i, imgData);
            if (loadingProgress) {
              loadingProgress.textContent = `Loading images... ${imageCache.size}/${expandedCards.length}`;
            }
          })
          .catch((error) => {
            console.warn(`Error loading image ${i}:`, error);
            imageCache.set(i, "error");
          });
        loadPromises.push(promise);
      }

      await Promise.all(loadPromises);

      if (loadingProgress) {
        loadingProgress.textContent = "Creating PDF...";
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
        const text = card.name || `Card ${globalIndex + 1}`;
        const lines = pdf.splitTextToSize(text, cardWidth - 10);
        pdf.text(
          lines,
          x + cardWidth / 2,
          y + cardHeight / 2 - lines.length * 2,
          { align: "center" }
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
          "Error loading image",
          x + cardWidth / 2,
          y + cardHeight - 5,
          { align: "center" }
        );
      };

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        if (loadingProgress) {
          loadingProgress.textContent = `Generating page ${
            pageIndex + 1
          } of ${pages.length}`;
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
              console.error(`Error adding image to PDF:`, error);
              drawPlaceholder(x, y, card, globalIndex);
            }
          } else {
            drawPlaceholder(x, y, card, globalIndex);
          }
        }

        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }

      if (loadingProgress) {
        loadingProgress.textContent = "Finalizing PDF...";
      }

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (!modal) {
        if (navigator.share && typeof File !== "undefined") {
          try {
            const file = new File([pdfBlob], "ohara-proxies.pdf", {
              type: "application/pdf",
            });
            await navigator.share({
              files: [file],
              title: "Proxy PDF",
            });
            return;
          } catch (error) {
            console.warn("Share failed, opening PDF instead.", error);
          }
        }

        const downloadLink = document.createElement("a");
        downloadLink.href = pdfUrl;
        downloadLink.download = "ohara-proxies.pdf";
        downloadLink.target = "_blank";
        downloadLink.rel = "noopener noreferrer";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        if (!document.hidden) {
          window.location.href = pdfUrl;
        }
        return;
      }

      const previewContainer = modal.querySelector(
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
      if (modal) {
        const previewContainer = modal.querySelector(
          ".print-preview-container"
        ) as HTMLElement;

        if (previewContainer) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          previewContainer.innerHTML = `
              <div class="loading-container">
                <div style="color: #f44336; font-size: 18px;">Error generating PDF</div>
                <div style="color: #666; margin-top: 10px;">Please try again</div>
                <div style="color: #999; margin-top: 5px; font-size: 12px;">${errorMessage}</div>
              </div>
            `;
        }
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

            resolve(canvas.toDataURL("image/jpeg", 0.9));
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
  }
}
