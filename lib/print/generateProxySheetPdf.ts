import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { PrintLanguage } from "@/store/printQueueStore";

export interface PrintableCard {
  cardId: string | number;
  src: string;
  name: string;
  code: string;
  quantity: number;
}

interface GenerateProxySheetPdfOptions {
  language?: PrintLanguage;
}

interface PrintOverlayData {
  cardId: number;
  sourceName: string | null;
  localizedName: string | null;
  sourceTrigger: string | null;
  localizedTrigger: string | null;
  sourceText: string | null;
  localizedText: string | null;
  sourceConditions?: string[];
  localizedConditions?: string[];
}

type OverlayLookup = Map<number, PrintOverlayData>;

type GlossaryTokenCategory =
  | "diamond"
  | "badge"
  | "don"
  | "once"
  | "counter"
  | "trigger";

const GLOSSARY_TOKENS: Array<{
  en: string;
  es: string;
  category: GlossaryTokenCategory;
}> = [
  { en: "Rush", es: "Prisa", category: "diamond" },
  { en: "Blocker", es: "Bloqueador", category: "diamond" },
  { en: "Banish", es: "Desterrar", category: "diamond" },
  { en: "Double Attack", es: "Ataque doble", category: "diamond" },
  { en: "Your Turn", es: "Tu turno", category: "badge" },
  { en: "Activate: Main", es: "Activar: Principal", category: "badge" },
  { en: "On Play", es: "Al jugar", category: "badge" },
  { en: "When Attacking", es: "Al atacar", category: "badge" },
  { en: "Opponent's Turn", es: "Turno de tu oponente", category: "badge" },
  { en: "Main", es: "Principal", category: "badge" },
  { en: "On K.O.", es: "Al ser K.O.", category: "badge" },
  { en: "End of Your Turn", es: "Al final de tu turno", category: "badge" },
  { en: "On Block", es: "Al bloquear", category: "badge" },
  {
    en: "On Your Opponent's Attack",
    es: "Cuando tu oponente ataque",
    category: "badge",
  },
  { en: "DON!! x1", es: "DON!! ×1", category: "don" },
  { en: "DON!! x2", es: "DON!! ×2", category: "don" },
  { en: "Once Per Turn", es: "Una vez por turno", category: "once" },
  { en: "Counter", es: "Contraataque", category: "counter" },
  { en: "Trigger", es: "Activador", category: "trigger" },
];

const TOKEN_CATEGORY_BY_LABEL = new Map<string, GlossaryTokenCategory>();
for (const token of GLOSSARY_TOKENS) {
  TOKEN_CATEGORY_BY_LABEL.set(`[${token.en}]`.toLowerCase(), token.category);
  TOKEN_CATEGORY_BY_LABEL.set(`[${token.es}]`.toLowerCase(), token.category);
}

const TOKEN_REGEX = new RegExp(
  `(${GLOSSARY_TOKENS.flatMap(({ en, es }) => [en, es])
    .map((label) => `\\[${escapeRegExp(label)}\\]`)
    .join("|")})`,
  "gi"
);

// "//N" marks a "rest N DON!! cards" reminder icon (a circled number), never
// literal text — it must never reach the printed sheet as raw "//N". "//10"
// is listed before "//1" so the alternation doesn't stop at the "//1" prefix
// and leave a stray "0" behind.
const RESTED_ICON_REGEX = /(\/\/10|\/\/1|\/\/2|\/\/3|\/\/4|\/\/5|\/\/6|\/\/7|\/\/8|\/\/9)/g;

export async function generateProxySheetPdf(
  cards: PrintableCard[],
  options: GenerateProxySheetPdfOptions = {}
): Promise<void> {
  const language = options.language ?? "en";
  const expandedCards = cards.flatMap((card) =>
    Array(card.quantity).fill(card)
  );

  if (expandedCards.length === 0) {
    alert("No cards in the proxy list to print");
    return;
  }

  const overlayLookup =
    language === "es" ? await fetchPrintOverlayData(cards, language) : null;

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
          padding: 12px;
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

        @media (max-width: 767px) {
          .print-modal {
            padding: 0;
          }

          .print-modal-content {
            max-width: none;
            max-height: none;
            height: 100vh;
            border-radius: 0;
          }

          .print-preview-container {
            padding: 8px;
          }

          .print-preview-iframe {
            height: calc(100vh - 140px);
          }
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

  await generatePDFContent(printModal);

  async function generatePDFContent(modal: HTMLDivElement | null) {
    try {
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
        const overlayData = overlayLookup?.get(normalizeCardId(card.cardId)) ?? null;

        const promise = loadImageWithOverlay(proxiedUrl, {
          language,
          cardName: card.name,
          overlay: overlayData,
        })
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
        loadingProgress.textContent = "Building print preview...";
      }

      const cardsPerPage = 9;
      const pages: Array<Array<string | null>> = [];
      for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
        const pageImages: Array<string | null> = [];
        for (let j = 0; j < cardsPerPage; j += 1) {
          pageImages.push(imageCache.get(i + j) ?? null);
        }
        pages.push(pageImages);
      }

      if (loadingProgress) {
        loadingProgress.textContent = "Preparing print frame...";
      }

      const printHtml = buildPrintHtml(pages);

      if (!modal) {
        throw new Error("Print modal is not available");
      }

      const previewContainer = modal.querySelector(
        ".print-preview-container"
      ) as HTMLElement;

      if (previewContainer) {
        previewContainer.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
              <iframe id="pdf-preview" class="print-preview-iframe"></iframe>
            </div>
          `;
      }

      const iframe = document.getElementById("pdf-preview") as HTMLIFrameElement | null;
      const printBtn = document.getElementById(
        "print-btn"
      ) as HTMLButtonElement;

      if (!iframe) {
        throw new Error("Preview frame could not be created");
      }

      iframe.srcdoc = printHtml;

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
      });

      if (printBtn) {
        printBtn.disabled = false;
        printBtn.onclick = () => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
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
}

function buildPrintHtml(pages: Array<Array<string | null>>) {
  const pagesMarkup = pages
    .map((page) => {
      const cardsMarkup = page
        .map((imageSrc) => {
          if (!imageSrc || imageSrc === "error") {
            return `<div class="card-slot card-slot-empty"></div>`;
          }

          return `
            <div class="card-slot">
              <img src="${imageSrc}" alt="Proxy card" />
            </div>
          `;
        })
        .join("");

      return `<section class="print-page">${cardsMarkup}</section>`;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ohara Proxy Print</title>
        <style>
          :root {
            --page-width: 210mm;
            --page-height: 297mm;
            --page-padding-top: 10mm;
            --page-padding-right: 11mm;
            --page-padding-bottom: 10mm;
            --page-padding-left: 11mm;
            --card-width: 62mm;
            --card-height: 87mm;
            --card-gap: 1mm;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #dbe1ea;
            font-family: Arial, sans-serif;
          }

          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 12px 0 24px;
          }

          .print-page {
            width: var(--page-width);
            height: var(--page-height);
            padding:
              var(--page-padding-top)
              var(--page-padding-right)
              var(--page-padding-bottom)
              var(--page-padding-left);
            background: white;
            display: grid;
            grid-template-columns: repeat(3, var(--card-width));
            grid-auto-rows: var(--card-height);
            gap: var(--card-gap);
            align-content: start;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }

          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .card-slot {
            width: var(--card-width);
            height: var(--card-height);
            overflow: hidden;
            background: white;
          }

          .card-slot img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .card-slot-empty {
            border: none;
            background: transparent;
          }

          @media print {
            html,
            body {
              width: var(--page-width);
              background: white;
            }

            body {
              gap: 0;
              padding: 0;
            }

            .print-page {
              margin: 0;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        ${pagesMarkup}
      </body>
    </html>
  `;
}

async function fetchPrintOverlayData(
  cards: PrintableCard[],
  language: PrintLanguage
): Promise<OverlayLookup> {
  const ids = Array.from(
    new Set(
      cards
        .map((card) => normalizeCardId(card.cardId))
        .filter((cardId) => Number.isFinite(cardId) && cardId > 0)
    )
  );

  if (ids.length === 0) {
    return new Map();
  }

  const response = await fetch("/api/cards/print-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids, language }),
  });

  if (!response.ok) {
    throw new Error(`Could not load print translations (${response.status})`);
  }

  const data = (await response.json()) as { cards?: PrintOverlayData[] };

  return new Map(
    (data.cards ?? []).map((card) => [normalizeCardId(card.cardId), card])
  );
}

function normalizeCardId(cardId: string | number) {
  return typeof cardId === "number" ? cardId : Number(cardId);
}

async function loadImageWithOverlay(
  url: string,
  {
    language,
    cardName,
    overlay,
  }: {
    language: PrintLanguage;
    cardName: string;
    overlay: PrintOverlayData | null;
  }
): Promise<string> {
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
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (language !== "en" && overlay) {
          drawSpanishOverlay(ctx, overlay, cardName);
        }

        resolve(canvas.toDataURL("image/jpeg", 0.9));
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

function drawSpanishOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: PrintOverlayData,
  fallbackName: string
) {
  const translatedTextBox = {
    x: 46,
    y: 620,
    width: 652,
    height: 232,
  };
  const translatedName = pickOverlayText(
    overlay.localizedName,
    overlay.sourceName,
    fallbackName
  );
  const translatedText = pickOverlayText(overlay.localizedText, overlay.sourceText);
  const translatedTrigger = pickOverlayText(
    overlay.localizedTrigger,
    overlay.sourceTrigger
  );

  const hasTranslatedName = hasMeaningfulTranslation(
    translatedName,
    overlay.sourceName ?? fallbackName
  );
  const hasTranslatedText = hasMeaningfulTranslation(
    translatedText,
    overlay.sourceText
  );
  const hasTranslatedTrigger = hasMeaningfulTranslation(
    translatedTrigger,
    overlay.sourceTrigger
  );

  if (hasTranslatedName) {
    drawLabelChip(ctx, "ESP", 48, 38, 88, 42);
    drawRoundedTextBox(ctx, {
      x: 146,
      y: 38,
      width: 548,
      height: 50,
      radius: 18,
      fill: "rgba(255, 248, 241, 0.94)",
      stroke: "rgba(194, 65, 12, 0.38)",
      paddingX: 20,
      paddingTop: 15,
      text: translatedName,
      fontFamily: '"Arial Black", Arial, sans-serif',
      initialFontSize: 26,
      minFontSize: 18,
      lineHeight: 1.1,
      color: "#7c2d12",
      maxLines: 1,
    });
  }

  if (hasTranslatedText) {
    drawRoundedTextBox(ctx, {
      x: translatedTextBox.x,
      y: translatedTextBox.y,
      width: translatedTextBox.width,
      height: translatedTextBox.height,
      radius: 22,
      fill: "rgba(255, 255, 255, 0.95)",
      stroke: "rgba(15, 23, 42, 0.18)",
      paddingX: 14,
      paddingTop: 14,
      text: translatedText,
      fontFamily: 'Arial, sans-serif',
      initialFontSize: 24,
      minFontSize: 14,
      lineHeight: 1.16,
      color: "#0f172a",
      maxLines: 8,
      highlightConditions: overlay.localizedConditions ?? [],
      baseFontWeight: "500",
    });
  }

  if (hasTranslatedTrigger) {
    drawTriggerSection(ctx, translatedTrigger, translatedTextBox);
  }
}

function pickOverlayText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function hasMeaningfulTranslation(
  translated: string,
  source: string | null | undefined
) {
  const normalizedTranslated = normalizeOverlayText(translated);
  if (!normalizedTranslated) {
    return false;
  }

  const normalizedSource = normalizeOverlayText(source ?? "");
  return !normalizedSource || normalizedTranslated !== normalizedSource;
}

function normalizeOverlayText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function drawLabelChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = "rgba(124, 58, 237, 0.95)";
  ctx.fill();
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function drawTriggerSection(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: { x: number; y: number; width: number; height: number }
) {
  const contentPaddingX = 10;
  const contentPaddingTop = 7;
  const contentPaddingBottom = 8;
  const labelWidth = 138;
  const labelHeight = 26;
  const sectionX = anchor.x;
  const sectionWidth = anchor.width;
  const labelInsetX = 8;
  const labelInsetY = 6;
  const contentStartX = sectionX + labelInsetX + labelWidth + 8;
  const contentWidth = sectionWidth - contentPaddingX * 2;
  const firstLineWidth =
    sectionX + sectionWidth - contentPaddingX - contentStartX;
  const followingLineX = sectionX + contentPaddingX;
  const followingLineWidth = contentWidth;
  const layout = fitTriggerTextBlock(ctx, text, {
    firstLineWidth,
    followingLineWidth,
    initialFontSize: 21,
    minFontSize: 14,
    lineHeight: 1.08,
    maxLines: 3,
  });
  const contentHeight = layout.lines.length * layout.fontSize * 1.08;
  const sectionHeight = Math.max(
    labelHeight + 12,
    contentPaddingTop + contentHeight + contentPaddingBottom
  );
  const sectionY = anchor.y + anchor.height - sectionHeight;
  const labelX = sectionX + labelInsetX;
  const labelY = sectionY + labelInsetY;
  const contentStartY = sectionY + contentPaddingTop;

  ctx.save();

  ctx.fillStyle = "#000000";
  roundRect(ctx, sectionX, sectionY, sectionWidth, sectionHeight, 10);
  ctx.fill();

  drawPolygon(ctx, [
    [labelX, labelY],
    [labelX + labelWidth, labelY],
    [labelX + labelWidth * 0.82, labelY + labelHeight],
    [labelX, labelY + labelHeight],
  ]);
  ctx.fillStyle = "#fae92e";
  ctx.fill();

  ctx.font = "800 19px Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.fillText("Trigger", labelX + 12, labelY + labelHeight / 2 + 1);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let currentY = contentStartY;
  for (let index = 0; index < layout.lines.length; index += 1) {
    const line = layout.lines[index];
    const lineX = index === 0 ? contentStartX : followingLineX;
    drawStyledLine(
      ctx,
      { segments: parseStyledSegments(line, []) },
      lineX,
      currentY,
      layout.fontSize,
      "#ffffff",
      "500"
    );
    currentY += layout.fontSize * 1.08;
  }

  ctx.restore();
}

function fitTriggerTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  {
    firstLineWidth,
    followingLineWidth,
    initialFontSize,
    minFontSize,
    lineHeight,
    maxLines,
  }: {
    firstLineWidth: number;
    followingLineWidth: number;
    initialFontSize: number;
    minFontSize: number;
    lineHeight: number;
    maxLines: number;
  }
) {
  for (let fontSize = initialFontSize; fontSize >= minFontSize; fontSize -= 1) {
    ctx.font = `500 ${fontSize}px Arial, sans-serif`;
    const lines = wrapTriggerText(
      ctx,
      text,
      firstLineWidth,
      followingLineWidth,
      maxLines,
      false
    );
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
  }

  ctx.font = `500 ${minFontSize}px Arial, sans-serif`;
  return {
    lines: wrapTriggerText(
      ctx,
      text,
      firstLineWidth,
      followingLineWidth,
      maxLines,
      true
    ),
    fontSize: minFontSize,
  };
}

function wrapTriggerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  firstLineWidth: number,
  followingLineWidth: number,
  maxLines: number,
  forceEllipsis: boolean
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const lineIndex = lines.length;
    const maxWidth = lineIndex === 0 ? firstLineWidth : followingLineWidth;
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word);
      currentLine = "";
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [""];
  }

  if (forceEllipsis || words.length > 0) {
    const joined = lines.join(" ").trim();
    if (joined !== text.trim()) {
      return applyEllipsisToLastLine(
        ctx,
        lines.slice(0, maxLines),
        followingLineWidth
      );
    }
  }

  return lines.slice(0, maxLines);
}

function drawRoundedTextBox(
  ctx: CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    height,
    radius,
    fill,
    stroke,
    paddingX,
    paddingTop,
    text,
    fontFamily,
    initialFontSize,
    minFontSize,
    lineHeight,
    color,
    maxLines,
    highlightConditions = [],
    baseFontWeight = "700",
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fill: string;
    stroke: string;
    paddingX: number;
    paddingTop: number;
    text: string;
    fontFamily: string;
    initialFontSize: number;
    minFontSize: number;
    lineHeight: number;
    color: string;
    maxLines: number;
    highlightConditions?: string[];
    baseFontWeight?: string;
  }
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  const layout = fitTextBlock(ctx, text, {
    fontFamily,
    maxWidth: width - paddingX * 2,
    maxHeight: height - paddingTop * 2,
    initialFontSize,
    minFontSize,
    lineHeight,
    maxLines,
    highlightConditions,
    baseFontWeight,
  });

  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let currentY = y + paddingTop;
  for (const line of layout.lines) {
    if (line.segments) {
      drawStyledLine(
        ctx,
        line,
        x + paddingX,
        currentY,
        layout.fontSize,
        color,
        baseFontWeight
      );
    } else {
      ctx.font = `${baseFontWeight} ${layout.fontSize}px ${fontFamily}`;
      ctx.fillText(line.text ?? "", x + paddingX, currentY);
    }
    currentY += layout.fontSize * lineHeight;
  }

  ctx.restore();
}

function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  {
    fontFamily,
    maxWidth,
    maxHeight,
    initialFontSize,
    minFontSize,
    lineHeight,
    maxLines,
    highlightConditions,
    baseFontWeight,
  }: {
    fontFamily: string;
    maxWidth: number;
    maxHeight: number;
    initialFontSize: number;
    minFontSize: number;
    lineHeight: number;
    maxLines: number;
    highlightConditions: string[];
    baseFontWeight: string;
  }
) {
  for (let fontSize = initialFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lines = wrapStyledText(
      ctx,
      text,
      maxWidth,
      maxLines,
      fontSize,
      false,
      highlightConditions,
      baseFontWeight
    );
    const blockHeight = lines.length * fontSize * lineHeight;

    if (lines.length <= maxLines && blockHeight <= maxHeight) {
      return { lines, fontSize, fontWeight: baseFontWeight };
    }
  }

  ctx.font = `700 ${minFontSize}px ${fontFamily}`;
  return {
    lines: wrapStyledText(
      ctx,
      text,
      maxWidth,
      maxLines,
      minFontSize,
      true,
      highlightConditions,
      baseFontWeight
    ),
    fontSize: minFontSize,
    fontWeight: baseFontWeight,
  };
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  forceEllipsis = false
) {
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;

      if (lines.length >= maxLines) {
        break;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length === 0) {
    return [""];
  }

  if (forceEllipsis || paragraphs.length > maxLines || lines.length > maxLines) {
    return applyEllipsisToLastLine(ctx, lines.slice(0, maxLines), maxWidth);
  }

  return lines.slice(0, maxLines);
}

function applyEllipsisToLastLine(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number
) {
  if (lines.length === 0) {
    return lines;
  }

  const result = [...lines];
  let lastLine = result[result.length - 1].trim();

  while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trim();
  }

  result[result.length - 1] = lastLine ? `${lastLine}...` : "...";
  return result;
}

function wrapStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number,
  forceEllipsis: boolean,
  highlightConditions: string[],
  baseFontWeight: string
) {
  const parsed = parseStyledSegments(text, highlightConditions);
  if (parsed.length === 0) {
    return [{ text: "" }];
  }

  const lines: Array<{
    segments?: StyledSegment[];
    text?: string;
  }> = [];
  let currentLine: StyledSegment[] = [];
  let currentWidth = 0;

  for (const segment of parsed) {
    const parts =
      segment.type === "token" || segment.type === "restedIcon"
        ? [segment]
        : splitTextSegment(segment.text).map((part) => ({
            type: "text" as const,
            text: part,
            bold: segment.bold,
          }));

    for (const part of parts) {
      if (part.type === "text" && part.text === "\n") {
        lines.push({ segments: currentLine });
        currentLine = [];
        currentWidth = 0;
        if (lines.length >= maxLines) break;
        continue;
      }

      const metrics = measureStyledSegment(ctx, part, fontSize, baseFontWeight);
      const width = metrics.advanceWidth;
      const isLineEmpty = currentLine.length === 0;

      if (!isLineEmpty && currentWidth + width > maxWidth) {
        lines.push({ segments: currentLine });
        currentLine = [];
        currentWidth = 0;
        if (lines.length >= maxLines) break;
      }

      if (lines.length >= maxLines) break;

      if (part.type === "text" && part.text === " " && currentLine.length === 0) {
        continue;
      }

      currentLine.push(part);
      currentWidth += width;
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && currentLine.length > 0) {
    lines.push({ segments: currentLine });
  }

  if (lines.length === 0) {
    return [{ text: "" }];
  }

  if (forceEllipsis) {
    applyStyledEllipsis(ctx, lines, maxWidth, fontSize, baseFontWeight);
  }

  return lines.slice(0, maxLines);
}

type StyledSegment =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean }
  | { type: "token"; text: string; category: GlossaryTokenCategory }
  | { type: "restedIcon"; count: number };

function parseStyledSegments(
  text: string,
  highlightConditions: string[]
): StyledSegment[] {
  const parts = text.split(TOKEN_REGEX);
  const segments: StyledSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const category = TOKEN_CATEGORY_BY_LABEL.get(part.toLowerCase());
    if (category) {
      segments.push({
        type: "token",
        text: part,
        category,
      });
      continue;
    }

    const restedParts = part.split(RESTED_ICON_REGEX);
    for (const restedPart of restedParts) {
      if (!restedPart) continue;
      const restedMatch = /^\/\/(\d{1,2})$/.exec(restedPart);
      if (restedMatch) {
        segments.push({ type: "restedIcon", count: Number(restedMatch[1]) });
      } else {
        segments.push(
          ...applyBoldConditionsToText(restedPart, highlightConditions)
        );
      }
    }
  }

  return segments;
}

function splitTextSegment(text: string) {
  return text.split(/(\n|\s+)/).filter((part) => part.length > 0);
}

function getRestedIconMetrics(fontSize: number) {
  const diameter = fontSize * 0.85;
  // El texto original ya trae su propio espacio antes/después de "//n"
  // (queda como segmento de texto normal al partir con RESTED_ICON_REGEX);
  // sumar aquí un gap adicional duplicaba la separación visual.
  const gap = 0;
  return { diameter, gap };
}

function measureStyledSegment(
  ctx: CanvasRenderingContext2D,
  segment: StyledSegment,
  fontSize: number,
  baseFontWeight: string
) {
  if (segment.type === "text") {
    const fontStyle = segment.italic ? "italic " : "";
    ctx.font = `${fontStyle}${segment.bold ? "800" : baseFontWeight} ${fontSize}px Arial, sans-serif`;
    return {
      advanceWidth: ctx.measureText(segment.text).width,
    };
  }

  if (segment.type === "restedIcon") {
    const { diameter, gap } = getRestedIconMetrics(fontSize);
    return {
      advanceWidth: diameter + gap,
    };
  }

  const label = segment.text.slice(1, -1);
  const style = getTokenStyle(segment.category, fontSize);
  ctx.font = `${style.fontWeight} ${style.fontSize}px Arial, sans-serif`;

  const textWidth = ctx.measureText(label).width;
  const iconWidth = style.withCounterBolt ? fontSize * 0.7 : 0;
  const gapWidth = style.withCounterBolt ? fontSize * 0.18 : 0;

  return {
    advanceWidth:
      textWidth + iconWidth + gapWidth + style.paddingLeft + style.paddingRight,
  };
}

function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  line: { segments?: StyledSegment[]; text?: string },
  x: number,
  y: number,
  fontSize: number,
  defaultColor: string,
  baseFontWeight: string
) {
  let cursorX = x;
  const previousBaseline = ctx.textBaseline;

  for (const segment of line.segments ?? []) {
    if (segment.type === "text") {
      const fontStyle = segment.italic ? "italic " : "";
      ctx.font = `${fontStyle}${segment.bold ? "800" : baseFontWeight} ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = defaultColor;
      ctx.textBaseline = "top";
      ctx.fillText(segment.text, cursorX, y);
      cursorX += ctx.measureText(segment.text).width;
      continue;
    }

    if (segment.type === "restedIcon") {
      const { diameter, gap } = getRestedIconMetrics(fontSize);
      const radius = diameter / 2;
      const centerX = cursorX + radius;
      const centerY = y + fontSize * 0.5;
      const lineWidth = Math.max(1, fontSize * 0.09);

      ctx.save();
      ctx.strokeStyle = defaultColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = defaultColor;
      ctx.font = `800 ${fontSize * 0.6}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(segment.count), centerX, centerY + fontSize * 0.02);
      ctx.restore();

      cursorX += diameter + gap;
      continue;
    }

    const label = segment.text.slice(1, -1);
    const style = getTokenStyle(segment.category, fontSize);
    ctx.font = `${style.fontWeight} ${style.fontSize}px Arial, sans-serif`;

    const textWidth = ctx.measureText(label).width;
    const iconWidth = style.withCounterBolt ? fontSize * 0.7 : 0;
    const gapWidth = style.withCounterBolt ? fontSize * 0.18 : 0;
    const chipWidth =
      textWidth + iconWidth + gapWidth + style.paddingLeft + style.paddingRight;
    const chipHeight = style.height;
    const chipY = y;

    drawTokenShape(ctx, segment.category, cursorX, chipY, chipWidth, chipHeight, style);

    let textX = cursorX + style.paddingLeft;
    if (style.withCounterBolt) {
      drawCounterBolt(ctx, textX, chipY + chipHeight / 2, fontSize * 0.58);
      textX += iconWidth + gapWidth;
    }

    ctx.fillStyle = style.textColor;
    ctx.textBaseline = "middle";
    ctx.fillText(label, textX, chipY + chipHeight / 2);
    cursorX += chipWidth;
  }

  ctx.textBaseline = previousBaseline;
}

function getTokenStyle(category: GlossaryTokenCategory, fontSize: number) {
  const base = {
    fontSize: Math.max(14, fontSize * 0.72),
    fontWeight: "700",
    paddingLeft: 8,
    paddingRight: 8,
    height: Math.max(22, fontSize * 1.04),
    textColor: "#ffffff",
    fillColor: "#047699",
    radius: 6,
    withCounterBolt: false,
  };

  switch (category) {
    case "diamond":
      return { ...base, fillColor: "#e57223", radius: 0 };
    case "badge":
      return { ...base, fillColor: "#047699" };
    case "don":
      return { ...base, fillColor: "#000000", radius: 0 };
    case "once":
      return { ...base, fillColor: "#ed4469", radius: 12 };
    case "counter":
      return {
        ...base,
        fillColor: "#c20819",
        paddingLeft: 7,
        paddingRight: 8,
        withCounterBolt: true,
      };
    case "trigger":
      return {
        ...base,
        fillColor: "#fee849",
        textColor: "#000000",
        fontWeight: "800",
        paddingLeft: 8,
        paddingRight: 14,
        radius: 0,
      };
  }
}

function drawTokenShape(
  ctx: CanvasRenderingContext2D,
  category: GlossaryTokenCategory,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ReturnType<typeof getTokenStyle>
) {
  ctx.save();
  ctx.fillStyle = style.fillColor;

  if (category === "diamond") {
    drawPolygon(ctx, [
      [x + width * 0.1, y],
      [x + width * 0.9, y],
      [x + width, y + height / 2],
      [x + width * 0.9, y + height],
      [x + width * 0.1, y + height],
      [x, y + height / 2],
    ]);
    ctx.fill();
  } else if (category === "don") {
    drawPolygon(ctx, [
      [x + width * 0.1, y],
      [x + width * 0.9, y],
      [x + width, y + height * 0.2],
      [x + width, y + height * 0.8],
      [x + width * 0.9, y + height],
      [x + width * 0.1, y + height],
      [x, y + height * 0.8],
      [x, y + height * 0.2],
    ]);
    ctx.fill();
  } else if (category === "trigger") {
    drawPolygon(ctx, [
      [x, y],
      [x + width, y],
      [x + width * 0.8, y + height],
      [x, y + height],
    ]);
    ctx.fill();
  } else {
    roundRect(ctx, x, y, width, height, style.radius);
    ctx.fill();
  }

  ctx.restore();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>
) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.closePath();
}

function drawCounterBolt(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  size: number
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  drawPolygon(ctx, [
    [x + size * 0.45, centerY - size * 0.95],
    [x + size * 0.95, centerY - size * 0.15],
    [x + size * 0.62, centerY - size * 0.15],
    [x + size, centerY + size * 0.95],
    [x + size * 0.12, centerY + size * 0.08],
    [x + size * 0.45, centerY + size * 0.08],
  ]);
  ctx.fill();
  ctx.restore();
}

function applyStyledEllipsis(
  ctx: CanvasRenderingContext2D,
  lines: Array<{ segments?: StyledSegment[]; text?: string }>,
  maxWidth: number,
  fontSize: number,
  baseFontWeight: string
) {
  const lastLine = lines[lines.length - 1];
  const segments = [...(lastLine.segments ?? [])];
  const ellipsisSegment: StyledSegment = { type: "text", text: "..." };

  while (segments.length > 0) {
    const candidate = [...segments, ellipsisSegment];
    const width = candidate.reduce(
      (total, segment) =>
        total +
        measureStyledSegment(ctx, segment, fontSize, baseFontWeight)
          .advanceWidth,
      0
    );

    if (width <= maxWidth) {
      lastLine.segments = candidate;
      return;
    }

    const tail = segments[segments.length - 1];
    if (tail.type === "text" && tail.text.length > 1 && tail.text.trim() !== "") {
      tail.text = tail.text.slice(0, -1);
      continue;
    }

    segments.pop();
  }

  lastLine.segments = [ellipsisSegment];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DASH_CHARS = "\\-\u2010\u2011\u2012\u2013\u2014\u2212";
const DASH_CLASS = `[${DASH_CHARS}]`;

function normalizeDashesForRegex(value: string) {
  return value.replace(new RegExp(DASH_CLASS, "g"), DASH_CLASS);
}

// "DON!! -N" siempre va en negritas en el proxy, sin depender de si el
// scraper llegó a guardar esa condición para esta carta puntual (el dato de
// `conditions` puede venir vacío para este patrón por como se extrae del sitio
// oficial, pero el texto igual debe resaltarse en la impresión).
const DON_COST_PATTERN = `DON!!\\s*${DASH_CLASS}\\s*\\d+`;

function applyBoldConditionsToText(
  text: string,
  conditions: string[]
): StyledSegment[] {
  if (!text) {
    return applyItalicStylingToSegments([{ type: "text", text }]);
  }

  const conditionPatterns = conditions
    .map((condition) => condition.trim())
    .filter(Boolean)
    .map((condition) => normalizeDashesForRegex(escapeRegExp(condition)));

  const pattern = [DON_COST_PATTERN, ...conditionPatterns].join("|");

  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return applyItalicStylingToSegments(
    parts
      .filter((part) => part.length > 0)
      .map((part, index) => ({
        type: "text" as const,
        text: part,
        bold: index % 2 === 1,
      }))
  );
}

function applyItalicStylingToSegments(
  segments: StyledSegment[]
): StyledSegment[] {
  const result: StyledSegment[] = [];

  for (const segment of segments) {
    if (segment.type !== "text") {
      result.push(segment);
      continue;
    }

    const parts = segment.text.split(/(\([^)]+\))/g).filter((part) => part.length > 0);
    for (const part of parts) {
      const isParenthesized = /^\([^)]+\)$/.test(part);
      const contentInside = part.slice(1, -1);
      const shouldItalicize =
        isParenthesized && /\w+\s+\w+/.test(contentInside);

      result.push({
        type: "text",
        text: part,
        bold: segment.bold,
        italic: shouldItalicize || segment.italic,
      });
    }
  }

  return result;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
