"use client";

import { useState, useRef, MouseEvent, useEffect, useMemo } from "react";
import {
  RotateCcw,
  Layers,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Printer,
  Eye,
} from "lucide-react";
import { Oswald } from "next/font/google";
import { CardWithCollectionData } from "@/types";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import LazyImage from "@/components/LazyImage";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { DeckCard } from "@/types";
import ViewSwitch from "../ViewSwitch";
import ProxyCardPreviewDrawer from "./ProxyCardPreviewDrawer";
import ProxyFiltersDrawer from "./ProxyFiltersDrawer";
import ProxiesDrawer from "./ProxiesDrawer";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import {
  usePaginatedCards,
  useCardsCount,
  serializeFiltersForKey,
} from "@/hooks/useCards";

const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "700"] });

const PAGE_SIZE = 60;

interface ProxiesBuilderProps {
  initialData: CardsPage;
  initialFilters: CardsFilters;
}

const ProxiesBuilder = ({
  initialData,
  initialFilters,
}: ProxiesBuilderProps) => {
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [proxies, setProxies] = useState<DeckCard[]>([]);
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");

  const normalizedSelectedSets = useMemo(
    () => selectedSets.map((value) => value.toLowerCase()),
    [selectedSets]
  );

  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("list");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Build filters for the paginated API
  const filters = useMemo<CardsFilters>(() => {
    return {
      search: search.trim() || undefined,
      sets: selectedSets.length > 0 ? selectedSets : undefined,
      setCodes: selectedCodes.length > 0 ? selectedCodes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      rarities: selectedRarities.length > 0 ? selectedRarities : undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      costs: selectedCosts.length > 0 ? selectedCosts : undefined,
      power: selectedPower.length > 0 ? selectedPower : undefined,
      attributes: selectedAttributes.length > 0 ? selectedAttributes : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      effects: selectedEffects.length > 0 ? selectedEffects : undefined,
      altArts: selectedAltArts.length > 0 ? selectedAltArts : undefined,
      counter: selectedCounter && selectedCounter !== "No counter" ? selectedCounter : undefined,
      trigger: selectedTrigger && selectedTrigger !== "No trigger" ? selectedTrigger : undefined,
    };
  }, [
    search,
    selectedSets,
    selectedCodes,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedTypes,
    selectedEffects,
    selectedAltArts,
    selectedCounter,
    selectedTrigger,
  ]);

  // Check if current filters match initial filters for using SSR data
  const filtersSignature = useMemo(() => serializeFiltersForKey(filters), [filters]);
  const initialFiltersSignatureRef = useRef<string | null>(null);
  if (initialFiltersSignatureRef.current === null) {
    initialFiltersSignatureRef.current = filtersSignature;
  }
  const matchesInitialFilters = initialFiltersSignatureRef.current === filtersSignature;

  // Prepare initial data for the hook
  const initialQueryData = useMemo(() => {
    if (!initialData || !matchesInitialFilters) return undefined;
    return {
      pages: [initialData],
      pageParams: [null],
    };
  }, [initialData, matchesInitialFilters]);

  // Use paginated cards hook
  const {
    cards: paginatedCards,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    totalCount,
  } = usePaginatedCards(filters, {
    limit: PAGE_SIZE,
    initialData: initialQueryData,
  });

  // Get total count from database with filters
  const { data: countData, isFetching: isCounting } = useCardsCount(filters);

  // Get cards from paginated data or initial data
  const allCards = useMemo(() => {
    if (paginatedCards?.length) {
      return paginatedCards;
    }
    if (matchesInitialFilters) {
      return initialData?.items ?? [];
    }
    return [];
  }, [paginatedCards, initialData, matchesInitialFilters]);

  // Drawer states
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [selectedFullCard, setSelectedFullCard] =
    useState<CardWithCollectionData | null>(null);
  const [isCardDrawerOpen, setIsCardDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isProxiesDrawerOpen, setIsProxiesDrawerOpen] = useState(false);

  const totalFilters =
    selectedColors.length +
    selectedRarities.length +
    selectedCategories.length +
    (selectedCounter !== "" ? 1 : 0) +
    (selectedTrigger !== "" ? 1 : 0) +
    selectedEffects.length +
    selectedTypes.length +
    selectedSets.length +
    selectedCosts.length +
    selectedPower.length +
    selectedAttributes.length +
    selectedCodes.length +
    selectedAltArts.length;

  const clearFilters = () => {
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
    setSelectedAltArts([]);
  };

  // Handle card click - add to proxies
  const handleCardClick = (
    e: MouseEvent<HTMLDivElement>,
    card: CardWithCollectionData,
    alternate: CardWithCollectionData
  ) => {
    const existingCardIndex = proxies.findIndex(
      (proxy) => proxy.cardId === Number(alternate.id)
    );

    if (existingCardIndex !== -1) {
      setProxies((prev) =>
        prev.map((proxy, index) =>
          index === existingCardIndex
            ? { ...proxy, quantity: proxy.quantity + 1 }
            : proxy
        )
      );
    } else {
      setProxies((prev) => [
        ...prev,
        {
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
        },
      ]);
    }

    // Scroll to added group
    setTimeout(() => {
      const groupElement = groupRefs.current[card.code];
      if (groupElement) {
        groupElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
  };

  // Open card preview drawer
  const handleProxyCardClick = (
    proxy: DeckCard,
    fullCard?: CardWithCollectionData
  ) => {
    setSelectedCard(proxy);
    // Find the full card data from allCards or alternates
    if (fullCard) {
      setSelectedFullCard(fullCard);
    } else {
      const foundCard = allCards.find(
        (c) =>
          Number(c.id) === proxy.cardId ||
          c.alternates?.some((alt) => Number(alt.id) === proxy.cardId)
      );
      if (foundCard) {
        if (Number(foundCard.id) === proxy.cardId) {
          setSelectedFullCard(foundCard);
        } else {
          const altCard = foundCard.alternates?.find(
            (alt) => Number(alt.id) === proxy.cardId
          );
          setSelectedFullCard(altCard || foundCard);
        }
      } else {
        setSelectedFullCard(null);
      }
    }
    setIsCardDrawerOpen(true);
  };

  // Open preview for a card from the left panel (card selection list)
  const handleLeftPanelPreview = (
    baseCard: CardWithCollectionData,
    displayCard: CardWithCollectionData
  ) => {
    // Create a temporary DeckCard for the preview
    const tempDeckCard: DeckCard = {
      cardId: Number(displayCard.id),
      id: Number(displayCard.id),
      name: baseCard.name,
      rarity: baseCard.rarity ?? "",
      src: displayCard.src,
      quantity:
        proxies.find((p) => p.cardId === Number(displayCard.id))?.quantity ?? 0,
      code: baseCard.code,
      color: baseCard.colors.length ? baseCard.colors[0].color : "gray",
      colors: baseCard.colors,
      cost: baseCard.cost ?? "",
      category: baseCard.category,
      set: baseCard.sets[0]?.set?.title ?? "",
      power: baseCard.power ?? "",
      counter: baseCard.counter ?? "",
      attribute: baseCard.attribute ?? "",
    };
    setSelectedCard(tempDeckCard);
    setSelectedFullCard(displayCard);
    setIsCardDrawerOpen(true);
  };

  // Quantity handlers for drawer
  const handleQuantityChange = (cardId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setProxies((prev) => prev.filter((p) => p.cardId !== cardId));
    } else {
      setProxies((prev) =>
        prev.map((p) =>
          p.cardId === cardId ? { ...p, quantity: newQuantity } : p
        )
      );
    }
    // Update selected card if it's open
    if (selectedCard && selectedCard.cardId === cardId) {
      setSelectedCard((prev) =>
        prev ? { ...prev, quantity: newQuantity } : null
      );
    }
  };

  const removeCard = (cardId: number) => {
    setProxies((prev) => prev.filter((card) => card.cardId !== cardId));
  };

  // Generate PDF handler
  const handleProxies = () => {
    const expandedCards = proxies.flatMap((card) =>
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

    // Create print modal
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
  };

  // Filtered cards - server handles filtering, we just sort here
  const filteredCards = useMemo(() => {
    if (!allCards || allCards.length === 0) return [];
    return [...allCards].sort((a, b) => sortByCollectionOrder(a, b));
  }, [allCards]);

  // Total results - prefer count from API, fallback to pagination count, then initial data
  const totalResults =
    countData ??
    totalCount ??
    (matchesInitialFilters ? initialData?.totalCount : undefined) ??
    filteredCards.length;

  const gridRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const queuedVisibleCountRef = useRef<number | null>(null);

  const LOAD_THRESHOLD_PX = 10000;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    isLoadingMoreRef.current = false;
    queuedVisibleCountRef.current = null;
    gridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [filtersSignature]);

  // Sync visibleCount when new data arrives (from CardListClient pattern)
  useEffect(() => {
    if (filteredCards.length === 0) {
      if (!isLoading && !isFetching) {
        setVisibleCount(0);
      }
      isLoadingMoreRef.current = false;
      queuedVisibleCountRef.current = null;
      return;
    }

    if (visibleCount === 0) {
      setVisibleCount(Math.min(PAGE_SIZE, filteredCards.length));
      isLoadingMoreRef.current = false;
      queuedVisibleCountRef.current = null;
      return;
    }

    if (visibleCount > filteredCards.length) {
      setVisibleCount(filteredCards.length);
      queuedVisibleCountRef.current = null;
      isLoadingMoreRef.current = false;
      return;
    }

    // Check if we have a queued target and data has arrived
    const queuedTarget = queuedVisibleCountRef.current;
    if (
      queuedTarget !== null &&
      (filteredCards.length >= queuedTarget ||
        (!hasNextPage && !isFetchingNextPage))
    ) {
      queuedVisibleCountRef.current = null;
      setVisibleCount(Math.min(queuedTarget, filteredCards.length));
      isLoadingMoreRef.current = false;
      return;
    }

    isLoadingMoreRef.current = false;
  }, [
    filteredCards.length,
    visibleCount,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  ]);

  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, clientHeight, scrollHeight } = target;
    const remaining = scrollHeight - (scrollTop + clientHeight);

    if (remaining <= LOAD_THRESHOLD_PX && !isLoadingMoreRef.current) {
      // First, show more of already fetched cards
      if (visibleCount < filteredCards.length) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredCards.length));
        requestAnimationFrame(() => {
          isLoadingMoreRef.current = false;
        });
      }
      // Then fetch more from server if needed - queue the next visible count
      else if (hasNextPage && !isFetchingNextPage) {
        isLoadingMoreRef.current = true;
        queuedVisibleCountRef.current = visibleCount + PAGE_SIZE;
        fetchNextPage()
          .catch(() => {
            queuedVisibleCountRef.current = null;
          })
          .finally(() => {
            isLoadingMoreRef.current = false;
          });
      }
    }
  };

  const totalCards = proxies.reduce((total, card) => total + card.quantity, 0);

  return (
    <div className="flex flex-1 bg-slate-100 w-full h-full overflow-hidden">
      {/* FAB for Proxies (Mobile only) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsProxiesDrawerOpen(true)}
          className="relative flex items-center justify-center h-16 w-16 rounded-full bg-purple-600 text-white shadow-xl hover:bg-purple-700 active:scale-95 transition-all"
        >
          <Layers className="h-7 w-7" />
          {totalCards > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
              {totalCards}
            </div>
          )}
        </button>
      </div>

      {/* Cards Panel (Left on desktop, full on mobile) */}
      <div className="bg-white flex w-full md:w-[320px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex-col">
        {/* Search + Filters Header */}
        <div className="p-3 border-b border-slate-100 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Button + View Switch */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                totalFilters > 0
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {totalFilters > 0 && (
                <Badge className="ml-1 bg-purple-600 text-white text-xs px-1.5">
                  {totalFilters}
                </Badge>
              )}
            </button>

            {totalFilters > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-purple-600 font-medium hover:underline"
              >
                Clear all
              </button>
            )}

            <div className="ml-auto">
              <ViewSwitch
                viewSelected={viewSelected}
                setViewSelected={setViewSelected}
              />
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-slate-500">
            {totalResults} cards found
            {(isFetching || isFetchingNextPage || isCounting) && (
              <span className="ml-2 text-purple-600">Loading...</span>
            )}
          </p>
        </div>

        {/* Cards Grid */}
        <div
          className="p-3 pb-24 md:pb-3 overflow-y-auto flex-1 min-h-0"
          ref={gridRef}
          onScroll={handleScroll}
        >
          {/* Initial loading state */}
          {isLoading && filteredCards.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-600 border-t-transparent" />
                <p className="text-sm text-slate-500">Loading cards...</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredCards.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">No cards match your filters.</p>
            </div>
          )}

          {viewSelected === "list" && filteredCards.length > 0 && (
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-3">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
                const baseCardMatches = (): boolean => {
                  if (!card) return false;
                  if (normalizedSelectedSets.length > 0) {
                    const baseSetCodes = (card.setCode ?? "")
                      .split(",")
                      .map((code: string) => code.trim().toLowerCase())
                      .filter(Boolean);
                    if (
                      !baseSetCodes.some((code: string) =>
                        normalizedSelectedSets.includes(code)
                      )
                    ) {
                      return false;
                    }
                  }
                  if (selectedAltArts.length > 0) {
                    return selectedAltArts.includes(card?.alternateArt ?? "");
                  }
                  return true;
                };

                const getFilteredAlternates = () => {
                  if (!card?.alternates) return [];
                  return card.alternates.filter((alt) => {
                    if (normalizedSelectedSets.length > 0) {
                      const altSetCodes = (alt.setCode ?? "")
                        .split(",")
                        .map((code) => code.trim().toLowerCase())
                        .filter(Boolean);
                      if (
                        !altSetCodes.some((code) =>
                          normalizedSelectedSets.includes(code)
                        )
                      ) {
                        return false;
                      }
                    }
                    if (selectedAltArts.length > 0) {
                      return selectedAltArts.includes(alt.alternateArt ?? "");
                    }
                    return true;
                  });
                };

                const filteredAlts = getFilteredAlternates();

                if (!baseCardMatches() && filteredAlts.length === 0)
                  return null;

                return (
                  <React.Fragment key={card.id}>
                    {baseCardMatches() && (
                      <div
                        onClick={(e) => handleCardClick(e, card, card)}
                        className="cursor-pointer transition-all duration-200 active:scale-95"
                      >
                        <div className="rounded-lg shadow-sm bg-white overflow-hidden p-1.5">
                          <div className="relative">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              priority={index < 20}
                              size="small"
                              className="w-full rounded-md"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLeftPanelPreview(card, card);
                              }}
                              className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                              aria-label="View card details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {(() => {
                            const baseCardInProxies = proxies.find(
                              (proxyCard) =>
                                proxyCard.cardId === Number(card.id)
                            );
                            if (!baseCardInProxies) return null;
                            return (
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        baseCardInProxies.cardId,
                                        baseCardInProxies.quantity - 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-white font-bold text-sm">
                                    {baseCardInProxies.quantity}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        baseCardInProxies.cardId,
                                        baseCardInProxies.quantity + 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {filteredAlts.map((alt) => {
                      const alternateInProxies = proxies.find(
                        (proxyCard) => proxyCard.cardId === Number(alt.id)
                      );

                      return (
                        <div
                          key={alt.id}
                          onClick={(e) => handleCardClick(e, card, alt)}
                          className="cursor-pointer transition-all duration-200 active:scale-95"
                        >
                          <div className="rounded-lg shadow-sm overflow-hidden">
                            <div className="relative">
                              <LazyImage
                                src={alt.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={alt.name}
                                priority={index < 20}
                                size="small"
                                className="w-full rounded-md"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLeftPanelPreview(card, alt);
                                }}
                                className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                                aria-label="View card details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {alternateInProxies && (
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        alternateInProxies.cardId,
                                        alternateInProxies.quantity - 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-white font-bold text-sm">
                                    {alternateInProxies.quantity}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(
                                        alternateInProxies.cardId,
                                        alternateInProxies.quantity + 1
                                      );
                                    }}
                                    className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {viewSelected === "grid" && filteredCards.length > 0 && (
            <div className="grid gap-2 grid-cols-1">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
                const baseCardMatches = (c: any): boolean => {
                  if (!c) return false;
                  if (
                    [
                      "Demo Version",
                      "Not for Sale",
                      "Pre-Errata",
                      "Pre-Release",
                    ].includes(c.alternateArt ?? "")
                  ) {
                    return false;
                  }
                  if (normalizedSelectedSets.length > 0) {
                    const baseSetCodes = (c.setCode ?? "")
                      .split(",")
                      .map((code: string) => code.trim().toLowerCase())
                      .filter(Boolean);
                    if (
                      !baseSetCodes.some((code: string) =>
                        normalizedSelectedSets.includes(code)
                      )
                    ) {
                      return false;
                    }
                  }
                  if (selectedAltArts.length > 0) {
                    return selectedAltArts.includes(c?.alternateArt ?? "");
                  }
                  return true;
                };

                if (!baseCardMatches(card)) return null;

                const baseCardInProxies = proxies.find(
                  (proxyCard) => proxyCard.cardId === Number(card.id)
                );

                return (
                  <div
                    key={card.id}
                    onClick={(e) => handleCardClick(e, card, card)}
                    className="cursor-pointer transition-all duration-200 active:scale-95"
                  >
                    <div className="rounded-xl shadow-sm bg-white p-2 relative flex gap-3">
                      <div className="w-20 flex-shrink-0">
                        <LazyImage
                          src={card.src ?? "/assets/images/backcard.webp"}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={card?.name}
                          priority={index < 20}
                          size="small"
                          className="w-full rounded-lg"
                        />
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <p
                          className={`${oswald.className} text-xs font-medium text-slate-500`}
                        >
                          {card.code}
                        </p>
                        <h3 className="font-semibold text-sm text-slate-900 line-clamp-1">
                          {card.name}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {card.sets?.[0]?.set?.title}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {card.cost && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Cost: {card.cost}
                            </span>
                          )}
                          {card.power && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Power: {card.power}
                            </span>
                          )}
                        </div>
                      </div>
                      {baseCardInProxies && (
                        <div className="absolute top-1 right-1">
                          <div className="flex items-center gap-1 bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(
                                  baseCardInProxies.cardId,
                                  baseCardInProxies.quantity - 1
                                );
                              }}
                              className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-white font-bold text-sm min-w-[16px] text-center">
                              {baseCardInProxies.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(
                                  baseCardInProxies.cardId,
                                  baseCardInProxies.quantity + 1
                                );
                              }}
                              className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(viewSelected === "alternate" || viewSelected === "text") && filteredCards.length > 0 && (
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-3">
              {filteredCards?.slice(0, visibleCount).map((card, index) => {
                const baseCardInProxies = proxies.find(
                  (proxyCard) => proxyCard.cardId === Number(card.id)
                );

                return (
                  <div
                    key={card.id}
                    onClick={(e) => handleCardClick(e, card, card)}
                    className="cursor-pointer transition-all duration-200 active:scale-95"
                  >
                    <div className="rounded-lg shadow-sm bg-white overflow-hidden relative">
                      <LazyImage
                        src={card.src}
                        fallbackSrc="/assets/images/backcard.webp"
                        alt={card.name}
                        priority={index < 20}
                        size="small"
                        className="w-full"
                      />
                      {/* <div className="p-1.5 text-center">
                        <span
                          className={`${oswald.className} text-[11px] font-medium text-slate-700`}
                        >
                          {card.code}
                        </span>
                      </div> */}
                      {baseCardInProxies && (
                        <div className="absolute bottom-0 left-0 right-0 p-1">
                          <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-1.5 py-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(
                                  baseCardInProxies.cardId,
                                  baseCardInProxies.quantity - 1
                                );
                              }}
                              className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-white font-bold text-sm">
                              {baseCardInProxies.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(
                                  baseCardInProxies.cardId,
                                  baseCardInProxies.quantity + 1
                                );
                              }}
                              className="h-6 w-6 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Proxies Panel (Desktop only - on mobile use ProxiesDrawer via FAB) */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 bg-slate-100">
        {/* Proxies Header */}
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Proxy Builder
                </h1>
                <p className="text-xs text-slate-500">
                  {totalCards} {totalCards === 1 ? "card" : "cards"} selected
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setProxies([])}
                disabled={proxies.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={handleProxies}
                disabled={proxies.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Generate PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Proxies Content */}
        <div className="flex-1 p-4 overflow-auto">
          {proxies.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-sm mx-auto text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Layers className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Build Your Proxies
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select cards from the left panel to add them to your proxy
                  list for printing.
                </p>
                <div className="mt-4 p-3 rounded-xl bg-purple-50 text-purple-700 text-xs font-medium">
                  Tip: Click on any card to add it to your collection
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {proxies.map((proxy, index) => (
                <div
                  key={`${proxy.cardId}-${index}`}
                  onClick={() => handleProxyCardClick(proxy)}
                  className="cursor-pointer"
                >
                  <div className="rounded-xl shadow-sm bg-white p-2 relative transition-all hover:shadow-md active:scale-[0.98]">
                    <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                      <img
                        src={getOptimizedImageUrl(proxy.src, "small")}
                        alt={proxy.name}
                        className="w-full h-full object-cover"
                        loading={index < 20 ? "eager" : "lazy"}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProxyCardClick(proxy);
                        }}
                        className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-lg rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                        aria-label="View card details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-2 text-center">
                            <span
                              className={`${oswald.className} text-xs font-medium text-slate-700`}
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
                    {/* Quantity Control Bar - CardWithBadges style */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(
                              proxy.cardId,
                              Math.max(0, proxy.quantity - 1)
                            );
                          }}
                          className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="flex items-center justify-center">
                          <span className="text-white font-bold text-base">
                            {proxy.quantity}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(
                              proxy.cardId,
                              proxy.quantity + 1
                            );
                          }}
                          className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Preview Drawer */}
      <ProxyCardPreviewDrawer
        isOpen={isCardDrawerOpen}
        onClose={() => setIsCardDrawerOpen(false)}
        card={selectedCard}
        fullCard={selectedFullCard}
        onQuantityChange={handleQuantityChange}
        onRemove={removeCard}
      />

      {/* Filters Drawer */}
      <ProxyFiltersDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
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
        selectedAltArts={selectedAltArts}
        setSelectedAltArts={setSelectedAltArts}
        selectedCodes={selectedCodes}
        setSelectedCodes={setSelectedCodes}
        onClearFilters={clearFilters}
        totalFilters={totalFilters}
      />

      {/* Proxies Drawer (Mobile) */}
      <ProxiesDrawer
        isOpen={isProxiesDrawerOpen}
        onClose={() => setIsProxiesDrawerOpen(false)}
        proxies={proxies}
        setProxies={setProxies}
        onGeneratePDF={handleProxies}
        allCards={allCards}
      />
    </div>
  );
};

export default ProxiesBuilder;
