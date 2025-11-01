// CompleteDeckBuilderLayout.tsx
"use client";

import {
  useState,
  useRef,
  MouseEvent,
  useEffect,
  useMemo,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import {
  ChartColumnBigIcon,
  Eye,
  Grid,
  RotateCcw,
  X,
  Layers,
  Users,
  Save,
  Minus,
  Plus,
} from "lucide-react";
import { Oswald } from "next/font/google";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { CardWithCollectionData } from "@/types";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import React from "react";
import GroupedCardPreview from "../deckbuilder/GroupedCardPreview";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import SearchFilters from "@/components/home/SearchFilters";
import ClearFiltersButton from "../ClearFiltersButton";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

import LazyImage from "@/components/LazyImage";

import { DeckCard } from "@/types";
import ViewSwitch from "../ViewSwitch";
import StoreCard from "../StoreCard";

interface ProxiesBuilderLayoutProps {
  onSave: () => void;
  onRestart: () => void;
  initialCards: CardWithCollectionData[];
}

const ProxiesBuilder = ({
  onSave,
  onRestart,
  initialCards,
}: ProxiesBuilderLayoutProps) => {
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [showLargeImage, setShowLargeImage] = useState<boolean>(false);

  const [proxies, setProxies] = useState<DeckCard[]>([]);
  const [showFab, setShowFab] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);

  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);

  const [isGrid, setIsGrid] = useState(false);

  const [isTouchable, setIsTouchable] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<string>("");
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("list");

  const [visibleCount, setVisibleCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<DeckCard | undefined>();

  const [showLargeImageCard, setShowLargeImageCard] = useState<boolean>(false);

  // Estados adicionales para StoreCard
  const [baseCard, setBaseCard] = useState<any>(null);
  const [alternatesCards, setAlternatesCards] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Estado para controlar la vista mobile
  const [mobileView, setMobileView] = useState<"cards" | "proxies">("cards");

  // Función para resaltar texto en búsquedas
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  };

  // Función para manejar click en cards desde StoreCard
  const handleStoreCardClick = (card: CardWithCollectionData) => {
    // Verificar si la carta ya existe en el array de proxies
    const existingCardIndex = proxies.findIndex(
      (proxy) => proxy.cardId === Number(card.id)
    );

    if (existingCardIndex !== -1) {
      // Si la carta ya existe, incrementar su cantidad
      setProxies((prev) =>
        prev.map((proxy, index) =>
          index === existingCardIndex
            ? { ...proxy, quantity: proxy.quantity + 1 }
            : proxy
        )
      );
    } else {
      // Si la carta no existe, agregarla como nueva
      const newProxy: DeckCard = {
        cardId: Number(card.id),
        id: Number(card.id),
        name: card.name,
        rarity: card.rarity ?? "",
        src: card.src,
        quantity: 1,
        code: card.code,
        color: card.colors.length ? card.colors[0].color : "gray",
        colors: card.colors,
        cost: card.cost ?? "",
        category: card.category,
        set: card.sets[0]?.set?.title ?? "",
        power: card.power ?? "",
        counter: card.counter ?? "",
        attribute: card.attribute ?? "",
      };

      setProxies((prev) => [...prev, newProxy]);
    }
  };

  // Función wrapper para setSelectedCard compatible con StoreCard
  const handleSetSelectedCard = (card: CardWithCollectionData) => {
    // Conversión de CardWithCollectionData a DeckCard
    const deckCard: DeckCard = {
      cardId: Number(card.id),
      id: Number(card.id),
      name: card.name,
      rarity: card.rarity ?? "",
      src: card.src,
      quantity: 1,
      code: card.code,
      color: card.colors.length ? card.colors[0].color : "gray",
      colors: card.colors,
      cost: card.cost ?? "",
      category: card.category,
      set: card.sets[0]?.set?.title ?? "",
      power: card.power ?? "",
      counter: card.counter ?? "",
      attribute: card.attribute ?? "",
    };
    setSelectedCard(deckCard);
  };

  const totalFilters =
    selectedColors?.length +
    selectedRarities?.length +
    selectedCategories?.length +
    (selectedCounter !== "" ? 1 : 0) +
    (selectedTrigger !== "" ? 1 : 0) +
    selectedEffects?.length +
    selectedTypes?.length +
    selectedSets?.length +
    selectedCosts?.length +
    selectedPower?.length +
    selectedAttributes?.length;

  const matchesCardCode = (code: string, search: string) => {
    const query = search.toLowerCase().trim();
    const fullCode = code.toLowerCase();

    // Si el query incluye un guión, se busca de forma literal.
    if (query.includes("-")) {
      return fullCode.includes(query);
    }

    // Separamos el código en partes usando el guión.
    const parts = code.split("-");

    // Si el query es numérico.
    if (/^\d+$/.test(query)) {
      if (query[0] === "0") {
        // Si inicia con cero, se compara la cadena exacta.
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits ? matchDigits[0] === query : false;
        });
      } else {
        // Si no inicia con cero, se compara numéricamente.
        const queryNumber = parseInt(query, 10);
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits
            ? parseInt(matchDigits[0], 10) === queryNumber
            : false;
        });
      }
    }

    // Si el query no es numérico, se busca por subcadena en cada parte.
    return parts.some((part) => part.toLowerCase().includes(query));
  };

  const handleProxies = () => {
    // Expandir cartas según su cantidad para impresión
    const expandedCards = proxies.flatMap((card) =>
      Array(card.quantity).fill(card)
    );

    if (expandedCards.length === 0) {
      alert("No hay cartas en el deck para imprimir");
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
          <h2>Generar PDF de Proxies</h2>
          <div class="print-modal-actions">
            <button id="print-btn" class="print-modal-btn print-modal-btn-primary" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
              </svg>
              Imprimir PDF
            </button>
            <button class="print-modal-btn print-modal-btn-close" id="close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Cerrar
            </button>
          </div>
        </div>
        <div class="print-preview-container">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Generando PDF...</div>
            <div class="loading-progress">Preparando imágenes</div>
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

        const { jsPDF } = window.jspdf;

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
            error instanceof Error ? error.message : "Unknown error";
          previewContainer.innerHTML = `
            <div class="loading-container">
              <div style="color: #f44336; font-size: 18px;">Error al generar el PDF</div>
              <div style="color: #666; margin-top: 10px;">Por favor, intenta de nuevo</div>
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
          reject(new Error("Timeout cargando imagen"));
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
    }
  };

  const filteredCards = useMemo(() => {
    if (!initialCards || initialCards.length === 0) return [];

    return initialCards
      .filter((card) => {
        const searchLower = search.trim().toLowerCase();
        const matchesSearch =
          card.name.toLowerCase().includes(searchLower) ||
          (card.power ?? "").toLowerCase().includes(searchLower) ||
          (card.cost ?? "").toLowerCase().includes(searchLower) ||
          (card.attribute ?? "").toLowerCase().includes(searchLower) ||
          (card.rarity ?? "").toLowerCase().includes(searchLower) ||
          matchesCardCode(card.code, search) ||
          (card.texts ?? []).some((item) =>
            item.text.toLowerCase().includes(searchLower)
          ) ||
          (card.types ?? []).some((item) =>
            item.type.toLowerCase().includes(searchLower)
          ) ||
          (card.sets ?? []).some((item) =>
            item.set.title.toLowerCase().includes(searchLower)
          );

        const matchesColors =
          selectedColors.length === 0 ||
          card.colors.some((col) =>
            selectedColors.includes(col.color.toLowerCase())
          );

        const matchesSets =
          selectedSets?.length === 0 ||
          card.sets.some((set) => selectedSets.includes(set.set.title)) ||
          (card.alternates ?? []).some((alt) =>
            alt.sets.some((set) => selectedSets.includes(set.set.title))
          );

        const matchesTypes =
          selectedTypes.length === 0 ||
          card.types.some((type) => selectedTypes.includes(type.type));

        const matchesEffects =
          selectedEffects.length === 0 ||
          (card.effects ?? []).some((effect) =>
            selectedEffects.includes(effect.effect)
          );

        const matchesRarity =
          selectedRarities?.length === 0 ||
          selectedRarities.includes(card.rarity ?? "");

        const matchesAltArts =
          selectedAltArts?.length === 0 ||
          (card.alternates ?? []).some((alt) =>
            selectedAltArts.includes(alt.alternateArt ?? "")
          );

        const matchesCosts =
          selectedCosts.length === 0 || selectedCosts.includes(card.cost ?? "");

        const matchesPower =
          selectedPower.length === 0 ||
          selectedPower.includes(card.power ?? "");

        const matchesCategories =
          selectedCategories.length === 0 ||
          selectedCategories.includes(card.category ?? "");

        const matchesAttributes =
          selectedAttributes.length === 0 ||
          selectedAttributes.includes(card.attribute ?? "");

        const matchesCounter =
          selectedCounter === ""
            ? true
            : selectedCounter === "No counter"
            ? card.counter == null
            : card.counter?.includes(selectedCounter);

        const matchedTrigger =
          selectedTrigger === ""
            ? true
            : selectedTrigger === "No trigger"
            ? card.triggerCard === null
            : card.triggerCard !== null;

        const matchedCode =
          selectedCodes?.length === 0 || selectedCodes.includes(card.setCode);

        return (
          matchesSearch &&
          matchesColors &&
          matchesRarity &&
          matchesCategories &&
          matchesCounter &&
          matchedTrigger &&
          matchesEffects &&
          matchesTypes &&
          matchesSets &&
          matchesCosts &&
          matchesPower &&
          matchesAttributes &&
          matchedCode &&
          matchesAltArts
        );
      })
      .sort((a, b) => {
        if (selectedSort === "Most variants") {
          return b.alternates?.length - a.alternates?.length;
        } else if (selectedSort === "Less variants") {
          return a.alternates?.length - b.alternates?.length;
        }
        return 0;
      });
  }, [
    initialCards,
    search,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedCounter,
    selectedTrigger,
    selectedEffects,
    selectedTypes,
    selectedSets,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedSort,
    selectedAltArts,
    selectedCodes,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInputClear, setIsInputClear] = useState(false);

  // Ref para la lista de cartas (grid)
  const gridRef = useRef<HTMLDivElement>(null);

  // Estado para controlar el sidebar de filtros
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handler para el click en cada carta (compatible con DeckBuilderLayout)
  const handleCardClick = (
    e: MouseEvent<HTMLDivElement>,
    card: CardWithCollectionData,
    alternate: CardWithCollectionData
  ) => {
    setSelectedCard({
      cardId: Number(alternate.id),
      id: Number(alternate.id),
      name: card.name,
      rarity: card.rarity ?? "",
      src: alternate.src,
      quantity: 1,
      code: card.code,
      color: card.colors.length ? card.colors[0].color : "gray",
      colors: card.colors,
      cost: card.cost ?? "",
      category: card.category,
      set: card.sets[0]?.set?.title ?? "",
      power: card.power ?? "",
      counter: card.counter ?? "",
      attribute: card.attribute ?? "",
    });

    // Verificar si la carta ya existe en el array de proxies
    const existingCardIndex = proxies.findIndex(
      (proxy) => proxy.cardId === Number(alternate.id)
    );

    if (existingCardIndex !== -1) {
      // Si la carta ya existe, incrementar su cantidad
      setProxies((prev) =>
        prev.map((proxy, index) =>
          index === existingCardIndex
            ? { ...proxy, quantity: proxy.quantity + 1 }
            : proxy
        )
      );
    } else {
      // Si la carta no existe, agregarla como nueva
      setProxies((prev) => [
        ...prev,
        {
          cardId: Number(alternate.id),
          name: card.name,
          rarity: card.rarity ?? "",
          src: alternate.src,
          quantity: 1,
          color: card.colors.length ? card.colors[0].color : "gray",
          code: card.code,
          cost: card.cost ?? "",
          category: card.category,
          set: card.sets[0]?.set?.title ?? "",
          power: card.power ?? "",
          counter: card.counter ?? "",
          attribute: card.attribute ?? "",
          colors: card.colors,
          id: Number(alternate.id),
        },
      ]);
    }

    // Scroll para que el card clickeado quede centrado
    const containerRect = gridRef.current?.getBoundingClientRect();
    const cardRect = e.currentTarget.getBoundingClientRect();

    if (containerRect) {
      if (
        cardRect.top < containerRect.top ||
        cardRect.bottom > containerRect.bottom
      ) {
        e.currentTarget.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    } else {
      e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Scroll al grupo de la carta agregada después de un breve delay
    setTimeout(() => {
      const groupElement = groupRefs.current[card.code];
      if (groupElement) {
        groupElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
  };

  // Función para eliminar la carta al hacer swipe
  const removeCard = (cardId: number) => {
    setProxies((prev) => prev.filter((card) => card.cardId !== cardId));
  };
  // Agrupamos las cartas por código sin modificar sus cantidades:
  const groupedCards = Object.values(
    proxies.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof proxies>)
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Si el sentinel está visible y aún quedan elementos por cargar...
        if (
          entries[0].isIntersecting &&
          visibleCount < (filteredCards?.length ?? 0)
        ) {
          setVisibleCount((prev) => prev + 50); // Incrementa de a 20 elementos (ajusta según convenga)
        }
      },
      { rootMargin: "200px" } // Permite cargar antes de llegar al final
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) observer.unobserve(sentinelRef.current);
    };
  }, [visibleCount, filteredCards?.length]);

  useEffect(() => {
    if (!showLargeImageCard) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImageCard]);

  const totalCards = proxies.reduce((total, card) => total + card.quantity, 0);

  console.log(groupedCards);
  return (
    <div className="flex flex-1 bg-[#f2eede] w-full h-full overflow-hidden">
      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-50 shadow-lg">
        <div className="flex justify-around items-center">
          <button
            onClick={() => setMobileView("cards")}
            className={`flex flex-col items-center py-2 px-4 rounded-md transition-all min-w-0 flex-1 mx-1 ${
              mobileView === "cards"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Grid className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Cards</span>
          </button>

          <button
            onClick={() => setMobileView("proxies")}
            className={`flex flex-col items-center py-2 px-4 rounded-md transition-all min-w-0 flex-1 mx-1 relative ${
              mobileView === "proxies"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="relative flex flex-col">
              <Layers className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Proxies</span>
              {totalCards > 0 && (
                <div className="absolute -top-2 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {totalCards}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Sidebar izquierdo: Lista de cartas disponibles con filtros */}
      <div
        className={`bg-white ${
          mobileView === "cards" ? "flex" : "hidden md:flex"
        } w-full md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col`}
      >
        {/* Controles móviles */}
        <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
          <DropdownSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search..."
          />

          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2 justify-center items-center">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className={`
              ${
                totalFilters > 0
                  ? "bg-[#2463eb] !text-white"
                  : "bg-gray-100 !text-black"
              }
              px-4 py-2 text-black font-bold border rounded-lg
                `}
              >
                Filters
                {totalFilters > 0 && (
                  <Badge className="ml-2 !bg-white !text-[#2463eb] font-bold">
                    {totalFilters}
                  </Badge>
                )}
              </button>
              <ClearFiltersButton
                isTouchable={
                  selectedColors.length > 0 ||
                  selectedRarities.length > 0 ||
                  selectedCategories.length > 0 ||
                  selectedCounter !== "" ||
                  selectedTrigger !== "" ||
                  selectedEffects.length > 0 ||
                  selectedTypes.length > 0 ||
                  selectedSets.length > 0 ||
                  selectedCosts.length > 0 ||
                  selectedPower.length > 0 ||
                  selectedAttributes.length > 0 ||
                  selectedCodes.length > 0
                }
                clearFilters={() => {
                  setSelectedColors([]);
                  setSelectedRarities([]);
                  setSelectedCategories([]);
                  setSelectedCounter("");
                  setSelectedTrigger("");
                  setSelectedEffects([]);
                  setSelectedTypes([]);
                  setSelectedSets([]);
                  setSelectedCosts([]);
                  setSelectedPower([]);
                  setSelectedAttributes([]);
                  setSelectedCodes([]);
                }}
                isMobile={true}
              />
            </div>

            <div className="flex justify-center items-center gap-2">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              />
            </div>
          </div>
        </div>

        {/* Lista de cartas disponibles */}
        <div
          className="p-3 pb-20 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
        >
          {viewSelected === "alternate" && (
            <div className="flex flex-col gap-5">
              {filteredCards?.slice(0, visibleCount).map((card) => {
                const totalQuantityBase = proxies
                  ?.filter((card_alt) => card_alt.code === card.code)
                  .reduce((sum, card_alt) => sum + card_alt.quantity, 0);

                return (
                  <div className="flex flex-col gap-5" key={card.id}>
                    <div className="grid gap-3 grid-cols-2 mb-3">
                      {/* Info Card */}
                      <div className="bg-black border rounded-lg shadow p-5 h-full text-white">
                        <div className="h-full flex flex-col justify-around items-center relative">
                          <div className="flex items-center justify-between flex-col mt-4">
                            <h2 className="text-lg font-black break-normal mb-2 text-center leading-tight line-clamp-2">
                              {card?.name}
                            </h2>
                            <p
                              className={`${oswald.className} text-md text-white leading-[16px] mb-4 font-[400]`}
                            >
                              {card?.code}
                            </p>
                            <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1">
                              <Badge
                                variant="secondary"
                                className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                              >
                                <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                                  {card?.rarity}
                                </span>
                              </Badge>
                            </div>
                            <div className="flex flex-col mt-2">
                              {card?.types.map((type) => (
                                <span
                                  key={type.type}
                                  className="text-[13px] leading-[15px] font-[200] text-center"
                                >
                                  {type.type}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 mt-3">
                            <div className="flex items-center flex-col">
                              <span className="font-bold text-2xl text-white leading-[30px]">
                                {(card?.alternates?.length ?? 0) + 1}
                              </span>
                              <span className="text-sm text-white leading-[13px]">
                                {card?.alternates?.length === 0
                                  ? "variant"
                                  : "variants"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Base Card */}
                      <div
                        onClick={(e) => handleCardClick(e, card, card)}
                        className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full ${
                          totalQuantityBase >= 4
                            ? "opacity-70 grayscale"
                            : "hover:shadow-md"
                        }`}
                      >
                        <div className="flex justify-center items-center w-full relative">
                          <LazyImage
                            src={card?.src}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={card?.name}
                            className="w-[80%] m-auto"
                          />
                          {(() => {
                            const baseCardInProxies = proxies.find(
                              (proxyCard) =>
                                proxyCard.cardId === Number(card.id)
                            );
                            return (
                              baseCardInProxies && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {baseCardInProxies.quantity}
                                  </span>
                                </div>
                              )
                            );
                          })()}
                        </div>
                        <div>
                          <div className="text-center font-bold mt-2">Base</div>
                          {card.sets?.map((set) => (
                            <p
                              key={set.set.title}
                              className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                            >
                              {set.set.title}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Alternate Cards */}
                      {card?.alternates?.map((alt) => {
                        const alternateInProxies = proxies.find(
                          (proxyCard) => proxyCard.cardId === Number(alt.id)
                        );

                        return (
                          <div
                            key={alt.id}
                            onClick={(e) => handleCardClick(e, card, alt)}
                            className={`cursor-pointer border rounded-lg shadow bg-white flex justify-center items-center p-4 flex-col h-full hover:shadow-md`}
                          >
                            <div className="flex justify-center items-center w-full relative">
                              <LazyImage
                                src={alt?.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt?.name}
                                className="w-[80%] m-auto"
                              />
                              {alternateInProxies && (
                                <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                                  <span className="mb-[2px]">
                                    {alternateInProxies.quantity}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-center font-bold mt-2">
                                {alt?.alternateArt}
                              </div>
                              {alt?.sets?.map((set) => (
                                <p
                                  key={set.set.title}
                                  className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                >
                                  {set.set.title}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewSelected === "text" && (
            <div className="grid gap-3 grid-cols-1 justify-items-center">
              {filteredCards?.slice(0, visibleCount).map((card) => (
                <React.Fragment key={card.id}>
                  <div
                    className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg`}
                    onClick={() => handleStoreCardClick(card)}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <StoreCard
                        card={card}
                        searchTerm={search}
                        viewSelected={viewSelected}
                        selectedRarities={selectedAltArts}
                        selectedSets={selectedSets}
                        setSelectedCard={handleSetSelectedCard}
                        setBaseCard={setBaseCard}
                        setAlternatesCards={setAlternatesCards}
                        setIsOpen={setIsOpen}
                      />
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {viewSelected === "list" && (
            <div className="grid gap-3 grid-cols-3 justify-items-center">
              {filteredCards?.slice(0, visibleCount).map((card) => (
                <React.Fragment key={card.id}>
                  <div
                    onClick={(e) => handleCardClick(e, card, card)}
                    className="w-full cursor-pointer transition-all duration-200 rounded-lg"
                  >
                    <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col relative">
                      <LazyImage
                        src={card.src}
                        fallbackSrc="/assets/images/backcard.webp"
                        alt={card.name}
                        className="w-full"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-center items-center w-full flex-col">
                              <span
                                className={`${oswald.className} text-[13px] font-bold mt-2`}
                              >
                                {card?.code}
                              </span>
                              <span className="text-center text-[13px] line-clamp-1">
                                {card?.sets[0]?.set?.title}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{card?.sets[0]?.set?.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {(() => {
                        const baseCardInProxies = proxies.find(
                          (proxyCard) => proxyCard.cardId === Number(card.id)
                        );
                        return (
                          baseCardInProxies && (
                            <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                              <span className="mb-[2px]">
                                {baseCardInProxies.quantity}
                              </span>
                            </div>
                          )
                        );
                      })()}
                    </div>
                  </div>

                  {card?.alternates?.map((alt) => {
                    const alternateInProxies = proxies.find(
                      (proxyCard) => proxyCard.cardId === Number(alt.id)
                    );

                    return (
                      <div
                        key={alt.id}
                        onClick={(e) => handleCardClick(e, card, alt)}
                        className="w-full cursor-pointer transition-all duration-200 rounded-lg"
                      >
                        <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col relative">
                          <LazyImage
                            src={alt.src}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt={alt.name}
                            className="w-full"
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center items-center w-full flex-col">
                                  <span
                                    className={`${oswald.className} text-[13px] font-bold mt-2`}
                                  >
                                    {card?.code}
                                  </span>
                                  <span className="text-center text-[13px] line-clamp-1">
                                    {alt?.sets[0]?.set?.title}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{alt?.sets[0]?.set?.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {alternateInProxies && (
                            <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white z-10">
                              <span className="mb-[2px]">
                                {alternateInProxies.quantity}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}

          {viewSelected === "grid" && (
            <div className="grid gap-3 grid-cols-1 justify-items-center">
              {filteredCards?.slice(0, visibleCount).map((card) => (
                <React.Fragment key={card.id}>
                  <div
                    className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                    onClick={(e) => handleCardClick(e, card, card)}
                  >
                    <LazyImage
                      src={card.src ?? "/assets/images/backcard.webp"}
                      fallbackSrc="/assets/images/backcard.webp"
                      alt={card?.name}
                      className="w-full"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-center items-center w-full flex-col">
                            <span
                              className={`${oswald.className} text-[13px] font-[500] mt-1`}
                            >
                              {card.code}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{card.sets?.[0]?.set?.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {(() => {
                      const baseCardInProxies = proxies.find(
                        (proxyCard) => proxyCard.cardId === Number(card.id)
                      );
                      return (
                        baseCardInProxies && (
                          <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[30px] w-[30px] flex items-center justify-center text-[12px] font-bold border-2 border-white z-10">
                            <span className="mb-[2px]">
                              {baseCardInProxies.quantity}
                            </span>
                          </div>
                        )
                      );
                    })()}
                  </div>

                  {card?.alternates?.map((alt) => {
                    const alternateInProxies = proxies.find(
                      (proxyCard) => proxyCard.cardId === Number(alt.id)
                    );

                    return (
                      <div
                        key={alt.id}
                        className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit mb-3"
                        onClick={(e) => handleCardClick(e, card, alt)}
                      >
                        <LazyImage
                          src={alt.src ?? "/assets/images/backcard.webp"}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={alt?.name}
                          className="w-full"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center items-center w-full flex-col">
                                <span
                                  className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                >
                                  {card.code}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{alt.sets?.[0]?.set?.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {alternateInProxies && (
                          <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[30px] w-[30px] flex items-center justify-center text-[12px] font-bold border-2 border-white z-10">
                            <span className="mb-[2px]">
                              {alternateInProxies.quantity}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}

          {visibleCount < (filteredCards?.length ?? 0) && (
            <div ref={sentinelRef} style={{ height: "1px" }} />
          )}
        </div>
      </div>

      {/* Área principal: Lista de Proxies */}
      <div
        className={`flex flex-col flex-1 min-h-0 bg-[#f2eede] ${
          mobileView === "proxies" ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Header de proxies */}
        <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 border-b border-[#d3d3d3] p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-7 h-7 text-purple-500" />
                Proxy Builder
              </h1>
              <div className="bg-white rounded-xl p-3 shadow-md border border-gray-200">
                <div className="text-center">
                  <div className="font-bold text-lg text-purple-600 leading-none">
                    {totalCards}
                  </div>
                  <div className="text-xs text-gray-600 leading-tight mt-0.5">
                    Proxies
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProxies([])}
                disabled={proxies.length === 0}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear All
              </Button>
              <Button
                onClick={handleProxies}
                disabled={proxies.length === 0}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                Generate Proxies
              </Button>
            </div>
          </div>
        </div>

        {/* Contenido de proxies */}
        <div className="flex-1 p-5 overflow-auto">
          <div className="rounded-lg h-full">
            {proxies.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="max-w-md mx-auto bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 shadow-lg p-8 text-center rounded-lg">
                  <div className="mb-6">
                    <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                      <Layers className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      Build Your Proxies
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Select cards from the left panel to add them to your proxy
                      list.
                    </p>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3">
                    <p className="text-purple-700 text-xs font-medium">
                      💡 Tip: Click on any card to add it to your proxy
                      collection
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
                {proxies.map((proxy, index) => (
                  <div
                    key={`${proxy.cardId}-${index}`}
                    className="flex flex-col items-center"
                  >
                    <div className="cursor-pointer border rounded-lg shadow p-2 bg-white justify-center items-center flex flex-col relative h-fit hover:shadow-xl transition-all duration-200 w-full mb-2">
                      <div
                        onClick={() => {
                          setSelectedCard(proxy);
                          setShowLargeImageCard(true);
                        }}
                      >
                        <LazyImage
                          src={proxy.src}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={proxy.name}
                          className="w-full rounded"
                        />
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-center items-center w-full flex-col">
                              <span
                                className={`${oswald.className} text-[13px] font-[500] mt-1`}
                              >
                                {proxy.code}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{proxy.set}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {proxy.quantity > 0 && (
                        <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white shadow-lg z-10">
                          <span className="mb-[2px]">{proxy.quantity}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 w-full mt-3">
                        <Button
                          onClick={() => {
                            const newQuantity = Math.max(0, proxy.quantity - 1);
                            if (newQuantity === 0) {
                              removeCard(proxy.cardId);
                            } else {
                              setProxies((prev) =>
                                prev.map((p) =>
                                  p.cardId === proxy.cardId
                                    ? { ...p, quantity: newQuantity }
                                    : p
                                )
                              );
                            }
                          }}
                          disabled={proxy.quantity <= 0}
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-12 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg shadow-red-500/25 hover:shadow-red-500/40 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-gray-300/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border-none"
                        >
                          <Minus className="w-5 h-5" />
                        </Button>

                        <Button
                          onClick={() => {
                            setProxies((prev) =>
                              prev.map((p) =>
                                p.cardId === proxy.cardId
                                  ? { ...p, quantity: p.quantity + 1 }
                                  : p
                              )
                            );
                          }}
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-lg shadow-lg shadow-green-500/25 hover:shadow-green-500/40 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-gray-300/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border-none"
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar de filtros móviles */}
      <Transition
        show={isModalOpen}
        enter="transition transform duration-300"
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leave="transition transform duration-200"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
      >
        <FiltersSidebar
          isOpen={isModalOpen}
          setIsOpen={setIsModalOpen}
          search={search}
          setSearch={setSearch}
          selectedColors={selectedColors}
          setSelectedColors={setSelectedColors}
          selectedRarities={selectedRarities}
          setSelectedRarities={setSelectedRarities}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          selectedCounter={selectedCounter}
          setSelectedCounter={setSelectedCounter}
          selectedTrigger={selectedTrigger}
          setSelectedTrigger={setSelectedTrigger}
          selectedEffects={selectedEffects}
          setSelectedEffects={setSelectedEffects}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedSets={selectedSets}
          setSelectedSets={setSelectedSets}
          selectedCosts={selectedCosts}
          setSelectedCosts={setSelectedCosts}
          selectedPower={selectedPower}
          setSelectedPower={setSelectedPower}
          selectedAttributes={selectedAttributes}
          setSelectedAttributes={setSelectedAttributes}
          disabledColors={[]}
          selectedAltArts={selectedAltArts}
          setSelectedAltArts={setSelectedAltArts}
          disabledTypes={[]}
        />
      </Transition>

      {showLargeImageCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => {
            setShowLargeImageCard(false);
          }}
          onTouchEnd={() => {
            setIsTouchable(false);
            setShowLargeImageCard(false);
          }}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard?.src ?? "/assets/images/backcard.webp"}
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

export default ProxiesBuilder;
