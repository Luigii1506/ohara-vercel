"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Oswald } from "next/font/google";
import { CardWithCollectionData } from "@/types";
import {
  Share2,
  Pencil,
  Download,
  Eye as OpenEye,
  EyeOff as CloseEye,
  X,
  Check,
  Copy,
  ChartColumnBigIcon,
} from "lucide-react";
import { getColors } from "@/helpers/functions";
import GroupedCardPreviewStatic from "@/components/deckbuilder/GroupedCardPreviewStatic";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { rarityFormatter } from "@/helpers/formatters";
import { showSuccessToast } from "@/lib/toastify";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import DeckStats from "@/components/deckbuilder/DeckStats";
import { DeckCard } from "@/types";
import { useUser } from "@/app/context/UserContext";
import { useI18n } from "@/components/i18n/I18nProvider";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const DeckBuilderUniqueUrl = () => {
  const { t } = useI18n();
  const { uniqueUrl } = useParams(); // URL único del deck original
  const router = useRouter();
  const { userId, loading: userLoading } = useUser();

  const deckRef = useRef(null);
  const modalRef = useRef(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showLargeImage, setShowLargeImage] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [isTouchable, setIsTouchable] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const [content, setContent] = useState("");

  const [activeTab, setActiveTab] = useState("sansan");
  // Estados para el deck a visualizar
  const [deckData, setDeckData] = useState<any>(null);
  const [isDeckLoaded, setIsDeckLoaded] = useState(false);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [selectedLeader, setSelectedLeader] =
    useState<CardWithCollectionData | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isOn, setIsOn] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const totalCards = deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  // Función para compartir el URL del deck usando la API nativa o copiando el link
  const handleShare = async () => {
    const shareData = {
      title: deckData?.name || t("deckbuilder.defaultDeckName"),
      text: t("deckbuilder.shareText"),
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error al compartir:", err);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert(t("deckbuilder.linkCopied"));
    }
  };

  const handleDownload = () => {
    if (deckRef.current) {
      html2canvas(deckRef.current, {
        useCORS: true,
        scale: 6, // Ajusta este valor según la resolución deseada
      }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        setPreviewImage(imgData);
        setShowModal(true);
      });
    }
  };

  // Función para redirigir a la vista de fork (edición) del deck
  const handleFork = () => {
    router.push(`/deckbuilder/${uniqueUrl}/fork`);
  };

  const handleExport = () => {
    setIsModalOpen(true);

    requestAnimationFrame(() => {
      setContent(formatSanSanEvents());
    });
  };

  const handleProxies = () => {
    // Incluir el leader al inicio si existe
    const leaderCards = selectedLeader
      ? [
          {
            cardId: Number(selectedLeader.id),
            id: Number(selectedLeader.id),
            name: selectedLeader.name,
            rarity: selectedLeader.rarity ?? "",
            quantity: 1,
            src: selectedLeader.src,
            code: selectedLeader.code,
            category: selectedLeader.category,
            color: selectedLeader.colors[0].color,
            colors: selectedLeader.colors,
            cost: selectedLeader.cost ?? "",
            set: selectedLeader.sets[0].set.title,
            power: selectedLeader.power ?? "",
            counter: selectedLeader.counter ?? "",
            attribute: selectedLeader.attribute ?? "",
          },
        ]
      : [];

    // Expandir cartas según su cantidad para impresión
    const expandedCards = [
      ...leaderCards,
      ...deckCards.flatMap((card) => Array(card.quantity).fill(card)),
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

        return originalUrl; // Las de tu dominio no necesitan proxy
      } catch {
        return originalUrl; // Si falla el parsing, usar URL original
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

        .info-box {
          background: #e3f2fd;
          border: 1px solid #bbdefb;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
          font-size: 14px;
        }

        .info-box strong {
          color: #1976d2;
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

    // Función para cerrar el modal - definida localmente
    const closeModal = () => {
      printModal.remove();
      document.removeEventListener("keydown", handleEsc);
    };

    // Event listener para el botón de cerrar
    const closeBtn = document.getElementById("close-modal-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Cerrar con ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleEsc);

    // Cerrar al hacer click fuera del modal
    printModal.addEventListener("click", (e) => {
      if (e.target === printModal) {
        closeModal();
      }
    });

    // Generar PDF
    generatePDFContent();

    async function generatePDFContent() {
      try {
        // Cargar jsPDF
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

        // Pre-cargar TODAS las imágenes antes de crear el PDF
        if (loadingProgress) {
          loadingProgress.textContent = `Cargando ${expandedCards.length} imágenes...`;
        }

        const imageCache = new Map<number, string>();
        const loadPromises: Promise<void>[] = [];

        // Cargar todas las imágenes en paralelo usando el proxy para dominios problemáticos
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

        // Esperar a que TODAS las imágenes se carguen
        await Promise.all(loadPromises);

        if (loadingProgress) {
          loadingProgress.textContent = "Creando PDF...";
        }

        // Crear PDF con configuración optimizada
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [210, 297],
          compress: false,
        });

        // Configuración de las cartas
        const cardWidth = 62;
        const cardHeight = 87;
        const gap = 1;
        const startX = 11;
        const startY = 10;

        // Organizar cartas en páginas
        const cardsPerPage = 9;
        const pages = [];
        for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
          pages.push(expandedCards.slice(i, i + cardsPerPage));
        }

        // Helper function to draw placeholder
        const drawPlaceholder = (
          x: number,
          y: number,
          card: any,
          globalIndex: number
        ) => {
          // Si la imagen falló, dibujar un placeholder
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

          // Mensaje de error
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

        // Procesar cada página
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

          // Procesar cada carta de la página
          for (let i = 0; i < pageCards.length; i++) {
            const card = pageCards[i];
            const globalIndex = pageIndex * cardsPerPage + i;
            const row = Math.floor(i / 3);
            const col = i % 3;

            const x = startX + col * (cardWidth + gap);
            const y = startY + row * (cardHeight + gap);

            // Usar la imagen pre-cargada del cache
            const imgData = imageCache.get(globalIndex);

            if (imgData && imgData !== "error") {
              try {
                // Como ahora usamos el proxy, las imágenes deberían cargarse como base64
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

          // Pequeña pausa para no bloquear el UI
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }

        if (loadingProgress) {
          loadingProgress.textContent = "Finalizando PDF...";
        }

        // Generar blob del PDF
        const pdfBlob = pdf.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Mostrar PDF en iframe
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

        // Habilitar botón de impresión
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
            error instanceof Error ? error.message : t("deckbuilder.unknownError");
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

    // Nueva función optimizada para cargar imágenes usando el proxy
    async function loadImageWithProxy(url: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const img = new Image();

        // Las imágenes proxiadas no necesitan crossOrigin ya que vienen del mismo dominio
        if (!url.startsWith("/api/proxy-image")) {
          img.crossOrigin = "anonymous";
        }

        const timeout = setTimeout(() => {
          img.src = "";
          reject(new Error(t("deckbuilder.imageTimeout")));
        }, 15000); // Aumentamos timeout para images proxiadas

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

  // Función para copiar el texto al portapapeles
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccessToast(t("deckbuilder.textCopied"));
      setCopied(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };
  const handleCopyUrl = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast(t("deckbuilder.textCopied"));
      setCopiedUrl(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };

  // Función que genera el primer formato: "cantidad x código" por línea
  const formatOptgsim = (): string => {
    // Agrupa las cartas por código sumando las cantidades
    const groupedCards = deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        if (acc[card.code]) {
          acc[card.code].quantity += card.quantity;
        } else {
          // Se clona la carta para no modificar el array original
          acc[card.code] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    // Formatea cada grupo en "cantidad x código"
    const formattedCards = Object.values(groupedCards).map(
      (card) => `${card.quantity}x${card.code}`
    );

    // Retorna la cadena final, empezando con el líder
    return `1x${selectedLeader?.code ?? ""}\n${formattedCards.join("\n")}`;
  };

  // Función que genera el segundo formato: array con cabecera y luego el código repetido según la cantidad
  const formatTableTop = () => {
    const output = [t("deckbuilder.exportedFrom"), [`${selectedLeader?.code}`]];
    deckCards.forEach((card) => {
      for (let i = 0; i < card.quantity; i++) {
        output.push(card.code);
      }
    });
    return JSON.stringify(output);
  };

  const formatSanSanEvents = () => {
    // Agrupar cartas por su código, sumando las cantidades
    const groupedCards = deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        if (acc[card.code]) {
          acc[card.code].quantity += card.quantity;
        } else {
          // Copia la carta para luego acumular su cantidad
          acc[card.code] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    // Formatear el resultado agrupado con `&nbsp;`
    const formattedCards = Object.values(groupedCards).map(
      (card) =>
        `${card.quantity} -\u200B ${card.code} ${rarityFormatter(
          card.rarity
        )}\u200B.\u200B`
    );

    return `1 - ${
      selectedLeader?.code ?? ""
    } L\u200B.\u200B\n${formattedCards.join("\n")}`;
  };

  // Agrupamos las cartas por código sin modificar sus cantidades:
  const groupedCards = Object.values(
    deckCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof deckCards>)
  );

  // Ordenamos las cartas según el criterio:
  // 1. Las cartas que no son "Event" se ordenan por costo de menor a mayor.
  // 2. Las cartas de tipo "Event" se ubican siempre al final, sin importar el costo.
  groupedCards.sort((groupA, groupB) => {
    const cardA = groupA[0];
    const cardB = groupB[0];

    const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
    const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";

    // Si uno es Event/Stage y el otro no, el Event/Stage va al final:
    if (isSpecialA !== isSpecialB) {
      return isSpecialA ? 1 : -1;
    }

    // Si ambos son Event/Stage o ninguno lo es, ordenar por costo ascendente.
    const costA = parseInt(cardA.cost ?? "0", 10);
    const costB = parseInt(cardB.cost ?? "0", 10);
    return costA - costB;
  });

  // Fetch del deck original mediante su uniqueUrl
  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      router.push("/unauthorized");
      return;
    }

    const fetchDeck = async () => {
      try {
        const res = await fetch(`/api/decks/${uniqueUrl}`);
        if (!res.ok) throw new Error(t("deckbuilder.deckNotFound"));
        const data = await res.json();
        const ownerId = data?.userId ?? data?.user?.id;
        if (ownerId && Number(ownerId) !== Number(userId)) {
          router.push("/unauthorized");
          return;
        }
        setDeckData(data);
        // Se asume que el deck original tiene exactamente 1 Leader
        const leaderEntry = data.deckCards.find(
          (dc: any) => dc.card.category === "Leader"
        );
        if (leaderEntry) setSelectedLeader(leaderEntry.card);

        console.log(" data.deckCards", data.deckCards);
        // Las cartas no Leader se usan para inicializar el deck
        const nonLeaderCards = data.deckCards
          .filter((dc: any) => dc.card.category !== "Leader")
          .map((dc: any) => ({
            cardId: dc.card.id,
            name: dc.card.name,
            rarity: dc.card.rarity || t("deckbuilder.unknownRarity"),
            quantity: dc.quantity,
            src: dc.card.src,
            code: dc.card.code,
            category: dc.card.category,
            color: dc.card.colors.length ? dc.card.colors[0].color : "gray",
            cost: dc.card.cost || "",
            set: dc.card.sets[0].set.title ?? "",
          }));
        setDeckCards(nonLeaderCards);
        setIsDeckLoaded(true);
      } catch (error) {
        console.error(error);
      } finally {
        setAccessChecked(true);
      }
    };

    if (uniqueUrl) fetchDeck();
  }, [uniqueUrl, userId, userLoading, router]);

  useEffect(() => {
    if (!showLargeImage) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImage]);

  if (!accessChecked && !isDeckLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#f2eede]">
        <div className="text-sm text-slate-500">
          {t("deckbuilder.loadingDeck")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-[#f2eede] w-full">
      <div className="flex flex-col flex-shrink-0 h-full bg-white px-4 py-4 gap-4">
        <div className="flex items-center gap-4 w-full justify-between">
          <div className="flex items-center gap-3 w-2/3">
            {selectedLeader && (
              <div
                className="relative w-[50px] h-[50px] rounded-full cursor-pointer"
                onClick={() => {
                  if (isTouchable) {
                    setSelectedCard({
                      cardId: Number(selectedLeader.id),
                      id: Number(selectedLeader.id),
                      name: selectedLeader.name,
                      rarity: selectedLeader.rarity ?? "",
                      quantity: 1,
                      src: selectedLeader.src,
                      code: selectedLeader.code,
                      color: selectedLeader.colors[0].color,
                      colors: selectedLeader.colors,
                      cost: selectedLeader.cost ?? "",
                      category: selectedLeader.category,
                      set: selectedLeader.sets[0].set.title,
                      power: selectedLeader.power ?? "",
                      counter: selectedLeader.counter ?? "",
                      attribute: selectedLeader.attribute ?? "",
                    });
                    setShowLargeImage(true);
                  }
                }}
              >
                {selectedLeader.colors.length === 2 ? (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `linear-gradient(
                                    to right,
                                    ${getColors(
                                      selectedLeader.colors[0].color
                                    )} 0%,
                                    ${getColors(
                                      selectedLeader.colors[0].color
                                    )} 40%,
                                    ${getColors(
                                      selectedLeader.colors[1].color
                                    )} 60%,
                                    ${getColors(
                                      selectedLeader.colors[1].color
                                    )} 100%
                                  )`,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: getColors(
                        selectedLeader.colors[0].color
                      ),
                    }}
                  />
                )}
                <div
                  className="absolute inset-1 rounded-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${selectedLeader.src})`,
                    backgroundSize: "150%",
                    backgroundPosition: "-80px -5px",
                  }}
                />
              </div>
            )}

            <div className="flex flex-col flex-1">
              <div className="flex items-start justify-center gap-0 flex-col">
                <span className="font-semibold text-sm line-clamp-1 break-all text-left">
                  {selectedLeader?.name ?? t("deckbuilder.nameFallback")}
                </span>
                <span
                  className={`${oswald.className} text-sm text-muted-foreground text-left`}
                >
                  {selectedLeader?.code ?? "-"}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border w-1/3 text-center">
            <span className="font-bold text-2xl">{totalCards}/50</span>
          </div>
          <div className="w-[42p] h-[42px]">
            <button
              onClick={() => setIsStatsOpen(!isStatsOpen)}
              className={`
        !w-[42px] h-[42px] rounded-lg flex items-center justify-center
        transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          isStatsOpen
            ? "bg-[#2463eb] text-white shadow-lg ring-[#2463eb]"
            : "bg-secondary text-secondary-foreground ring-secondary"
        }
      `}
              aria-pressed={isStatsOpen}
              aria-label={
                isStatsOpen
                  ? t("deckbuilder.statsToggleOnLabel")
                  : t("deckbuilder.statsToggleOffLabel")
              }
            >
              <ChartColumnBigIcon />
              <span className="sr-only">
                {isStatsOpen
                  ? t("deckbuilder.statsAriaOn")
                  : t("deckbuilder.statsAriaOff")}
              </span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#F3F4F6] rounded-lg border overflow-auto flex-1">
          {isDeckLoaded ? (
            deckCards.length === 0 ? (
              <p>{t("deckbuilder.noCardsInDeck")}</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10 max-w-[1900px] m-auto gap-2">
                {groupedCards.map((group) =>
                  group.map((c, index) => {
                    // Buscamos la carta en el mazo por su id
                    const cardInDeck = deckCards.find(
                      (card) => card.cardId === c.cardId
                    );
                    return (
                      <div
                        key={index}
                        onClick={() => {
                          if (isTouchable) {
                            setSelectedCard(c);
                            setShowLargeImage(true);
                          }
                        }}
                        className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit"
                      >
                        <img src={c?.src} alt={c?.name} className="w-full" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center items-center w-full flex-col">
                                <span
                                  className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                >
                                  {c?.code}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{c?.set}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {cardInDeck && cardInDeck.quantity > 0 && (
                          <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white">
                            <span className="mb-[2px]">
                              {cardInDeck.quantity}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )
          ) : (
            <p>{t("deckbuilder.loadingDeck")}</p>
          )}
        </div>

        {/* Botones de acción */}

        <div className="m-auto w-full sm:w-auto">
          <div className="flex justify-between gap-2 max-w-none w-full sm:max-w-[500px] sm:w-screen">
            <Button
              onClick={handleFork}
              className="flex-1 gap-2 bg-blue-500 hover:bg-blue-600 text-white py-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-lg font-medium">
                {t("deckbuilder.edit")}
              </span>
            </Button>

            <Button
              onClick={handleExport}
              className="flex-1 gap-2 bg-violet-500 hover:bg-violet-600 text-white py-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              <span className="text-lg font-medium">
                {t("deckbuilder.export")}
              </span>
            </Button>
            <Button
              onClick={handleProxies}
              className="flex-1 gap-2 bg-violet-500 hover:bg-violet-600 text-white py-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              <span className="text-lg font-medium">
                {t("deckbuilder.proxies")}
              </span>
            </Button>
          </div>
        </div>
      </div>
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            setIsModalOpen(false);
            setActiveTab("sansan");
          }}
          ref={modalRef}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[430px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[430px] h-screen md:h-fit max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden transition-shadow duration-300">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[96px]">
                    <DialogTitle className="text-lg lg:text-2xl font-bold">
                      {t("deckbuilder.exportDeckTitle")}
                    </DialogTitle>
                    <button
                      onClick={() => {
                        setActiveTab("sansan");
                        setCopiedUrl(false);
                        setCopied(false);
                        setIsModalOpen(false);
                        setContent("");
                      }}
                      aria-label="Close"
                    >
                      <X className="h-[30px] w-[30px] md:h-[60px] md:w-[60px] text-white cursor-pointer absolute right-5 top-0 bottom-0 m-auto" />
                    </button>
                  </div>

                  <div className="p-3 md:p-6 flex-1 flex flex-col min-h-0 gap-4">
                    <div className="inline-flex items-center gap-3 rounded-lg bg-muted p-2">
                      <button
                        onClick={() => {
                          setActiveTab("sansan");
                          setContent(formatSanSanEvents());
                          setCopied(false);
                          setCopiedUrl(false);
                        }}
                        className={cn(
                          "w-1/2 relative px-4 py-2 text-md font-medium transition-colors",
                          "rounded-md hover:text-foreground/90",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          activeTab === "sansan"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted-foreground/10"
                        )}
                        role="tab"
                        aria-selected={activeTab === "sansan"}
                        aria-controls={`panel-${"sansan"}`}
                      >
                        SangSang
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("optcgsim");
                          setContent(formatOptgsim());
                          setCopied(false);
                          setCopiedUrl(false);
                        }}
                        className={cn(
                          "w-1/2 relative px-4 py-2 text-md font-medium transition-colors",
                          "rounded-md hover:text-foreground/90",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          activeTab === "optcgsim"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted-foreground/10"
                        )}
                        role="tab"
                        aria-selected={activeTab === "optcgsim"}
                        aria-controls={`panel-${"optcgsim"}`}
                      >
                        OPSim
                      </button>
                    </div>
                    <div className="flex flex-col bg-gray-200 rounded-b-lg min-h-0 overflow-auto rounded-lg px-4 py-3">
                      {content.split("\n").map((line, index) => (
                        <p
                          key={index}
                          style={{
                            all: "unset",
                            margin: 0,
                            padding: 0,
                            pointerEvents: "none",
                            userSelect: "none",
                            textDecoration: "none",
                            listStyleType: "none",
                            display: "block",
                            fontSize: "inherit",
                            fontFamily: "Arial, sans-serif", // Prueba otra fuente
                            WebkitUserModify: "read-only",
                            MozUserModify: "read-only",
                            WebkitTouchCallout: "none",
                          }}
                          spellCheck="false"
                          translate="no"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                    <Button
                      onClick={() => handleCopy()}
                      className="w-full bg-[#4F7DFF] hover:bg-[#4F7DFF]/90 text-white py-6 text-lg font-medium"
                    >
                      {copied ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="w-5 h-5" />
                          {t("deckbuilder.copied")}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Copy className="w-5 h-5" />
                          {t("deckbuilder.copyText")}
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Panel lateral estático: URL y botón Share */}
                  <div className="w-full flex flex-col gap-5 p-4">
                    <div className="flex w-full flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          id="deck-url"
                          type="text"
                          value={
                            "https://oharatcg.com/deckbuilder/" + uniqueUrl
                          }
                          readOnly
                          className="font-mono h-[48px]"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="w-fit px-2 h-[48px]"
                          onClick={() =>
                            handleCopyUrl(
                              "https://oharatcg.com/deckbuilder/" + uniqueUrl
                            )
                          }
                        >
                          {copiedUrl ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                          {t("deckbuilder.copyUrl")}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleShare}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg font-medium"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="text-lg font-medium">
                        {t("deckbuilder.share")}
                      </span>
                    </Button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isStatsOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            setIsStatsOpen(false);
          }}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[900px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[900px] h-screen md:h-fit max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col transition-shadow duration-300 overflow-auto">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[80px]">
                    <DialogTitle className="text-lg lg:text-2xl font-bold">
                      {t("deckbuilder.statsTitle")}
                    </DialogTitle>
                    <div className="absolute right-5 top-0 bottom-0 m-auto h-fit">
                      <button
                        onClick={() => setIsStatsOpen(false)}
                        aria-label="Close"
                      >
                        <X className="h-[20px] w-[20px] md:h-[60px] md:w-[60px] text-white cursor-pointer" />
                      </button>
                    </div>
                  </div>

                  <DeckStats deck={deckData?.deckCards} />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {showModal && previewImage && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative w-full">
            <img
              src={previewImage}
              alt={t("deckbuilder.deckPreview")}
              className="w-full"
            />
            <div className="flex justify-between">
              <a
                href={previewImage}
                download="deck.png"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded"
              >
                {t("deckbuilder.downloadImage")}
              </a>
            </div>
          </div>
        </div>
      )}

      {showLargeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              {t("cardPreview.tapToClose")}
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard?.src}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt=""
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard?.code}
                </span>
                <br />
                <span>{selectedCard?.set}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckBuilderUniqueUrl;
