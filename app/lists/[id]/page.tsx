"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, List, FileText, Copy, Loader2, Camera, Eye } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { MainContentSkeleton } from "@/components/skeletons";
import { CardWithCollectionData } from "@/types";
import { BookFlipContainer } from "@/components/folder";
import { GridCard } from "@/components/folder/types";
import { useFolderDimensions } from "@/hooks/useFolderDimensions";
import TcgplayerLogo from "@/components/Icons/TcgplayerLogo";
import { useUser } from "@/app/context/UserContext";
import CollectionReportDrawer from "@/components/CollectionReportDrawer";
import SnapshotsDrawer from "@/components/SnapshotsDrawer";
import { convertForListDisplay } from "@/lib/lists/currency";

import { Oswald } from "next/font/google";

const oswald = Oswald({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

interface ListCard {
  id: number;
  cardId: string;
  quantity: number;
  position: number | null;
  page: number | null;
  row: number | null;
  column: number | null;
  customPrice?: number | string | null;
  customCurrency?: string | null;
  isSold?: boolean;
  soldAt?: string | null;
  soldPrice?: number | string | null;
  card: CardWithCollectionData;
}

interface UserList {
  id: number;
  name: string;
  description: string | null;
  isOrdered: boolean;
  isCollection: boolean;
  isPublic: boolean;
  hideTcgLink: boolean;
  displayCurrency?: string | null;
  exchangeRate?: number | string | null;
  totalPages: number;
  maxRows: number | null;
  maxColumns: number | null;
  cards: ListCard[];
  color: string | null;
}

const ListDetailPage = () => {
  const params = (useParams() ?? {}) as Record<string, string>;
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = params.id as string;
  const { role, userId } = useUser();
  const isAdmin = role === "ADMIN";
  const isLoggedIn = Boolean(userId);

  const snapshotParam = searchParams?.get("snapshot") ?? null;
  const viewingSnapshotId = snapshotParam ? Number(snapshotParam) : null;

  // States
  const [list, setList] = useState<UserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportDrawer, setShowReportDrawer] = useState(false);
  const [showSnapshotsDrawer, setShowSnapshotsDrawer] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [snapshotData, setSnapshotData] = useState<any | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  // Start at view 0 (interior cover + page 1)
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [shareUrl, setShareUrl] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [importing, setImporting] = useState(false);
  // Listed Median (midPrice) se muestra por default; admin puede alternar a Market Price.
  const [showListedMedian, setShowListedMedian] = useState(true);

  // Cartas congeladas del snapshot, adaptadas al mismo shape que usa la
  // página para el estado en vivo (ListCard[]), para reusar el mismo grid,
  // paginación y helpers de precio sin duplicar lógica de render.
  const snapshotCards: ListCard[] = useMemo(() => {
    if (!snapshotData?.cardsSnapshot) return [];
    return snapshotData.cardsSnapshot.map((c: any) => ({
      id: c.listCardId,
      cardId: String(c.cardId),
      quantity: c.quantity,
      position: null,
      page: c.page,
      row: c.row,
      column: c.column,
      customPrice: c.customPrice,
      customCurrency: c.customCurrency,
      isSold: c.isSold,
      soldAt: c.soldAt,
      soldPrice: c.soldPrice,
      card: {
        id: c.cardId,
        name: c.name,
        code: c.code,
        src: c.src,
        marketPrice: c.marketPrice,
        priceCurrency: c.priceCurrency,
      } as CardWithCollectionData,
    }));
  }, [snapshotData]);

  const displayedCards: ListCard[] = viewingSnapshotId
    ? snapshotCards
    : list?.cards ?? [];

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    // Listed Median (midPrice) es el default para todos; solo un admin puede
    // alternar a Market Price con el toggle.
    if (isAdmin && !showListedMedian) {
      return getNumericPrice(card.marketPrice) ?? null;
    }
    return (
      getNumericPrice((card as any).midPrice) ??
      getNumericPrice(card.marketPrice) ??
      null
    );
  };

  const getListCardPriceValue = (listCard: ListCard) => {
    return (
      getNumericPrice(listCard.customPrice) ?? getCardPriceValue(listCard.card)
    );
  };

  // Si la carpeta tiene una moneda de despliegue distinta a USD (ej. MXN con
  // un tipo de cambio fijo), convertimos aquí antes de formatear — así todos
  // los lugares que ya llaman a formatCurrency(valor, moneda) heredan la
  // conversión sin tener que tocar cada uno. Solo convierte valores que ya
  // están en USD (o sin moneda explícita); un customCurrency ya distinto de
  // USD se deja tal cual para no convertir dos veces.
  const formatCurrency = (value: number, currency?: string | null) => {
    const sourceCurrency = currency || "USD";
    const { value: displayValue, currency: displayCurrencyCode } =
      sourceCurrency === "USD"
        ? convertForListDisplay(value, list)
        : { value, currency: sourceCurrency };

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: displayCurrencyCode,
      minimumFractionDigits: 2,
    }).format(displayValue);
  };

  const folderTotalValue = useMemo(() => {
    let totalValue = 0;
    let currency = "USD";

    displayedCards.forEach((listCard) => {
      const priceValue = getListCardPriceValue(listCard);
      const quantity = listCard.quantity || 1;
      if (priceValue !== null) {
        totalValue += priceValue * quantity;
        currency =
          listCard.customCurrency || listCard.card.priceCurrency || currency;
      }
    });

    return { totalValue, currency };
  }, [displayedCards, showListedMedian, isAdmin]);

  // En modo snapshot usamos el total ya congelado (usa el precio real de
  // venta de las cartas vendidas, no el precio de lista) en vez de
  // recalcularlo con la lógica de la vista en vivo.
  const folderTotalLabel =
    viewingSnapshotId && snapshotData
      ? formatCurrency(Number(snapshotData.totalValue), snapshotData.currency)
      : formatCurrency(folderTotalValue.totalValue, folderTotalValue.currency);

  const getTcgUrl = (card: CardWithCollectionData) => {
    if (list?.hideTcgLink) return null;
    if (card.tcgUrl && card.tcgUrl.trim() !== "") {
      return card.tcgUrl;
    }
    if (card.tcgplayerProductId) {
      return `https://www.tcgplayer.com/product/${card.tcgplayerProductId}`;
    }
    return null;
  };

  // Navigation functions from BookFlipContainer
  const [navigationFunctions, setNavigationFunctions] = useState<{
    flipNext: () => void;
    flipPrev: () => void;
  } | null>(null);

  // Touch state for mobile navigation
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(
    null
  );

  // Helper functions for mobile-aware navigation
  const navigateNext = () => {
    if (!navigationFunctions) return;

    console.log("🔄 Page navigateNext() called");
    navigationFunctions.flipNext(); // This now internally handles mobile vs desktop
  };

  const navigatePrev = () => {
    if (!navigationFunctions) return;

    console.log("🔄 Page navigatePrev() called");
    navigationFunctions.flipPrev(); // This now internally handles mobile vs desktop
  };

  const [selectedCard, setSelectedCard] =
    useState<CardWithCollectionData | null>(null);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [backcardPositions, setBackcardPositions] = useState<
    Map<string, string | null>
  >(new Map());

  // Use the shared hook for folder dimensions
  const folderDimensions = useFolderDimensions(
    list?.maxRows || 3,
    list?.maxColumns || 3,
    windowSize,
    false // viewing mode (not editing)
  );

  // Helper functions for FolderContainer
  const createGrid = (
    pageCards: ListCard[],
    pageNumber?: number | string
  ): GridCard[][] => {
    const maxRows = list?.maxRows || 3;
    const maxColumns = list?.maxColumns || 3;
    const grid = Array(maxRows)
      .fill(null)
      .map(() => Array(maxColumns).fill(null));

    pageCards.forEach((listCard) => {
      if (!listCard || !listCard.card) return;
      const row = Math.max(0, Math.min((listCard.row || 1) - 1, maxRows - 1));
      const col = Math.max(
        0,
        Math.min((listCard.column || 1) - 1, maxColumns - 1)
      );

      // Convert to GridCard format
      const gridCard: GridCard = {
        card: listCard.card,
        quantity: listCard.quantity,
        existing: listCard,
      };

      grid[row][col] = gridCard;
    });

    const currentPageNum =
      typeof pageNumber === "number"
        ? pageNumber
        : typeof pageCards[0]?.page === "number"
        ? pageCards[0]?.page
        : null;

    if (currentPageNum) {
      for (let row = 0; row < maxRows; row++) {
        for (let col = 0; col < maxColumns; col++) {
          if (!grid[row][col]) {
            const positionKey = `${currentPageNum}-${row + 1}-${col + 1}`;
            if (backcardPositions.has(positionKey)) {
              grid[row][col] = {
                card: null as any,
                hasBackcard: true,
                backcardImageUrl: backcardPositions.get(positionKey) ?? null,
              };
            }
          }
        }
      }
    }

    return grid;
  };

  const getCardsForPage = (pageNumber: number | string) => {
    if (pageNumber === 0 || pageNumber === "cover") return []; // Cover pages have no cards

    return displayedCards.filter((listCard) => listCard.page === pageNumber);
  };

  // Window resize handler for responsive calculations
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(window.location.href);
  }, [listId]);

  useEffect(() => {
    if (!list?.id) return;
    const fetchBackcards = async () => {
      try {
        const response = await fetch(`/api/lists/${list.id}/backcards`);
        if (response.ok) {
          const backcards = await response.json();
          const backcardsMap = new Map<string, string | null>(
            backcards.map((b: any) => [
              `${b.page}-${b.row}-${b.column}`,
              b.imageUrl ?? null,
            ])
          );
          setBackcardPositions(backcardsMap);
        }
      } catch (error) {
        console.error("Error loading backcards:", error);
      }
    };
    fetchBackcards();
  }, [list?.id]);

  // Keyboard navigation for folders
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation for ordered lists (folders)
      if (!list || !list.isOrdered) return;

      // Don't handle if user is typing in an input field
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          (activeElement as HTMLElement).contentEditable === "true")
      ) {
        return;
      }

      const totalPages = Math.max(1, list.totalPages || 1);

      const safePage = Math.max(0, Math.min(currentPage, totalPages));

      // Calculate max page: interior cover (0) + pages (1 to totalPages)
      const maxPage = totalPages; // 0 → 1 → 2 → ... → totalPages

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          if (navigationFunctions && safePage > 0) {
            navigatePrev();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (navigationFunctions && safePage < maxPage) {
            navigateNext();
          }
          break;
        case "Home":
          event.preventDefault();
          setCurrentPage(0); // Go to interior cover
          break;
        case "End":
          event.preventDefault();
          setCurrentPage(maxPage); // Go to last page
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [list, currentPage]);

  // Swipe detection functions
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!list?.isOrdered || windowSize.width >= 768) return; // Only on mobile and folders

    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !list?.isOrdered || windowSize.width >= 768) return;

    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !list?.isOrdered || windowSize.width >= 768)
      return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50; // Minimum distance for a valid swipe
    const maxVerticalDistance = 100; // Maximum vertical movement allowed

    // Check if it's a horizontal swipe (more horizontal than vertical movement)
    if (
      Math.abs(deltaX) > minSwipeDistance &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaY) < maxVerticalDistance
    ) {
      const totalPages = list.totalPages || 1;
      const maxPage = totalPages; // 0 (interior) → 1 → 2 → ... → totalPages

      if (deltaX > 0) {
        // Swipe left (go to next page)
        if (currentPage < maxPage) {
          setCurrentPage(currentPage + 1);
        }
      } else {
        // Swipe right (go to previous page)
        if (currentPage > 0) {
          setCurrentPage(currentPage - 1);
        }
      }
    }

    // Reset
    setTouchStart(null);
    setTouchEnd(null);
  };

  const fetchList = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}?limit=0`);
      if (!response.ok) throw new Error("Failed to fetch list");
      const data = await response.json();

      setList(data.list || data); // Handle both data.list and data formats
      setIsOwner(Boolean(data.isOwner));
    } catch (error) {
      console.error("Error fetching list:", error);
      toast.error("Error al cargar la lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [listId]);

  // Cuando la URL trae ?snapshot=<id>, cargamos ese snapshot congelado en
  // vez del estado en vivo de la carpeta.
  useEffect(() => {
    if (!viewingSnapshotId) {
      setSnapshotData(null);
      return;
    }
    let cancelled = false;
    setLoadingSnapshot(true);
    fetch(`/api/lists/${listId}/snapshots/${viewingSnapshotId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSnapshotData(data?.snapshot ?? null);
      })
      .catch(() => {
        if (!cancelled) setSnapshotData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSnapshot(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listId, viewingSnapshotId]);

  // Cambia entre ver un snapshot puntual (id) o el estado en vivo (null),
  // reflejado en la URL para que sea compartible/navegable.
  const goToSnapshot = (snapshotId: number | null) => {
    const url = new URL(window.location.href);
    if (snapshotId) {
      url.searchParams.set("snapshot", String(snapshotId));
    } else {
      url.searchParams.delete("snapshot");
    }
    router.push(`${url.pathname}${url.search}`);
  };

  const handleCardClick = (card: CardWithCollectionData) => {
    setSelectedCard(card);
    setShowLargeImage(true);
  };

  // Handle page change from flipbook
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Importar (copiar) esta lista a la cuenta del usuario → crea una lista nueva.
  const handleImportList = async () => {
    try {
      setImporting(true);
      const res = await fetch("/api/lists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: Number(listId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo importar la lista");
      }
      const created = await res.json();
      const newId = created?.id ?? created?.list?.id;
      toast.success("Lista importada a tu cuenta");
      if (newId) router.push(`/lists/${newId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar la lista");
    } finally {
      setImporting(false);
    }
  };

  // Función para renderizar carpetas (isOrdered = true) sin scroll
  const renderOrderedList = () => {
    if (!list || !list.isOrdered) return null;

    const maxRows = Math.max(1, list.maxRows || 3);
    const maxColumns = Math.max(1, list.maxColumns || 3);
    const totalPages = Math.max(1, list.totalPages || 1);

    // Use the shared folder dimensions
    const dims = folderDimensions;

    // Different safePage logic for mobile vs desktop
    const safePage = Math.max(0, currentPage);
    const totalPagesWithCover = totalPages; // 0 (interior) → 1 → 2 → ... → totalPages

    return (
      <div className="h-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col relative w-full">
        {/* Navigation buttons are now inside BookFlipContainer */}

        {/* Mobile Page Info - Top */}
        {dims.showSinglePage && (
          <div className="absolute top-4 left-4 right-4 flex justify-center z-10">
            <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
              {safePage === 0
                ? "Cubierta Interior"
                : `Página ${safePage} de ${totalPages}`}
            </div>
          </div>
        )}

        {/* Mobile navigation buttons are now inside BookFlipContainer */}

        {/* Folder Container */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative min-h-0">
          <BookFlipContainer
            name={list.name}
            color={list.color || "white"}
            dimensions={dims}
            currentPage={safePage}
            totalPages={totalPages}
            maxRows={maxRows}
            maxColumns={maxColumns}
            cardCount={displayedCards.length}
            // totalValueLabel={folderTotalLabel} // oculto: no mostrar el valor total en esta vista pública
            shareUrl={shareUrl || undefined}
            createGrid={createGrid}
            getCardsForPage={getCardsForPage}
            isEditing={false}
            onCardClick={handleCardClick}
            priceField={isAdmin && !showListedMedian ? "marketPrice" : "midPrice"}
            displayCurrency={list.displayCurrency}
            exchangeRate={list.exchangeRate}
            showInteriorPage={true} // page.tsx shows interior page on desktop
            onPageChange={handlePageChange}
            onNavigationReady={setNavigationFunctions}
            // 🔄 Navigation inside folder
            showNavigationButtons={true}
            onNavigatePrev={navigatePrev}
            onNavigateNext={navigateNext}
            maxNavigablePage={totalPagesWithCover}
          />
        </div>
      </div>
    );
  };

  // Función para renderizar listas simples
  const renderSimpleList = () => {
    if (!list || list.isOrdered) return null;

    const safeFilteredCards = displayedCards.filter(
      (listCard) =>
        listCard && listCard.card && listCard.card.name && listCard.card.code
    );

    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {/* Header compacto */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/lists")}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <h1 className="text-lg font-bold text-slate-900">{list.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Importar (copiar) la lista a mi cuenta — solo si NO es mía y estoy logueado. */}
              {!isOwner && isLoggedIn && (
                <Button
                  onClick={handleImportList}
                  disabled={importing}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {importing ? "Importando…" : "Importar copia"}
                  </span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  onClick={() => setShowListedMedian((v) => !v)}
                  variant={showListedMedian ? "default" : "outline"}
                  size="sm"
                  className="gap-2 text-xs font-semibold"
                  title="Solo admin: alternar entre Listed Median y Market Price"
                >
                  {showListedMedian ? "Listed Median" : "Market Price"}
                </Button>
              )}
              {isAdmin && (
                <Button
                  onClick={() => setShowReportDrawer(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Generate Report</span>
                </Button>
              )}
              {isOwner && !list?.isCollection && (
                <Button
                  onClick={() => setShowSnapshotsDrawer(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <Camera className="h-4 w-4" />
                  <span className="hidden sm:inline">Snapshots</span>
                </Button>
              )}
              <div className="text-sm text-slate-600">
                {safeFilteredCards.length} cartas
              </div>
            </div>
          </div>
        </div>

        {/* Cards Grid - Sin scroll, usa todo el espacio disponible */}
        <div className="flex-1 p-2 md:p-6 overflow-hidden">
          {safeFilteredCards.length > 0 ? (
            <div className="h-full overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {safeFilteredCards.map((listCard) => (
                  <div
                    key={listCard.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => handleCardClick(listCard.card)}
                  >
                    <div className="aspect-[3/4] relative">
                      <img
                        src={listCard.card.src}
                        alt={listCard.card.name}
                        className={`w-full h-full object-cover ${
                          listCard.isSold ? "grayscale opacity-50" : ""
                        }`}
                      />
                      {listCard.isSold && (
                        <div className="pointer-events-none absolute inset-x-[-15%] top-[38%] -rotate-[18deg] bg-slate-900/85 py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-md">
                          Vendida
                        </div>
                      )}
                      {listCard.quantity > 1 && (
                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border-2 border-white shadow-md">
                          {listCard.quantity}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm text-slate-900 truncate">
                        {listCard.card.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {listCard.card.code}
                      </p>
                      {(() => {
                        const soldPriceValue = getNumericPrice(
                          listCard.soldPrice
                        );
                        const priceValue = listCard.isSold
                          ? soldPriceValue ?? getListCardPriceValue(listCard)
                          : getListCardPriceValue(listCard);
                        const tcgUrl = listCard.isSold
                          ? null
                          : getTcgUrl(listCard.card);
                        if (priceValue !== null) {
                          return (
                            <div className="mt-1.5 space-y-1.5">
                              <p
                                className={`text-sm font-bold ${
                                  listCard.isSold
                                    ? "text-slate-500"
                                    : "text-emerald-600"
                                }`}
                              >
                                {listCard.isSold && "Vendida en "}
                                {formatCurrency(
                                  priceValue,
                                  listCard.customCurrency ||
                                    listCard.card.priceCurrency
                                )}
                              </p>
                              {tcgUrl && (
                                <a
                                  href={tcgUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                                >
                                  <TcgplayerLogo className="h-3.5 w-auto" />
                                  Ver en TCGplayer
                                </a>
                              )}
                            </div>
                          );
                        }
                        return (
                          <p className="text-xs text-gray-400 mt-1">No price</p>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <List className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Lista vacía
                </h3>
                <p className="text-slate-600">
                  Tu lista está esperando las primeras cartas
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
        <div className="container mx-auto px-4 py-6 h-full">
          <MainContentSkeleton />
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Lista no encontrada
          </h3>
          <p className="text-slate-600 mb-4">
            La lista que buscas no existe o no tienes acceso a ella.
          </p>
          <Link href="/lists">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a las listas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {viewingSnapshotId && (
        <div className="fixed inset-x-0 top-0 z-[65] flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          <div className="flex min-w-0 items-center gap-2">
            <Camera className="h-4 w-4 shrink-0 text-slate-300" />
            <span className="truncate">
              {loadingSnapshot
                ? "Cargando snapshot…"
                : `Viendo snapshot${
                    snapshotData?.label ? `: ${snapshotData.label}` : ""
                  }`}
            </span>
          </div>
          <button
            onClick={() => goToSnapshot(null)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
          >
            <Eye className="h-3.5 w-3.5" />
            Vista actual
          </button>
        </div>
      )}
      {list.isOrdered ? (
        <div
          className="h-full overflow-hidden w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {renderOrderedList()}
        </div>
      ) : (
        renderSimpleList()
      )}

      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard.src}
                className="max-w-full max-h-[calc(100dvh-200px)] object-contain rounded-lg shadow-2xl"
                alt={selectedCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                {(() => {
                  const priceValue = getCardPriceValue(selectedCard);
                  const tcgUrl = getTcgUrl(selectedCard);
                  if (priceValue !== null) {
                    return (
                      <div className="flex flex-col">
                        <span className="inline-block mt-3 px-6 py-3 bg-emerald-600 text-white text-xl font-bold rounded-lg shadow-lg">
                          {formatCurrency(
                            priceValue,
                            selectedCard.priceCurrency
                          )}
                        </span>
                        {tcgUrl && (
                          <a
                            href={tcgUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                          >
                            <TcgplayerLogo className="h-4 w-auto" />
                            Ver en TCGplayer
                          </a>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Report Drawer */}
      {list && (
        <CollectionReportDrawer
          isOpen={showReportDrawer}
          onClose={() => setShowReportDrawer(false)}
          listId={list.id}
          listName={list.name}
        />
      )}

      {/* Snapshots Drawer (dueño, carpetas normales — no la Colección) */}
      {list && isOwner && !list.isCollection && (
        <SnapshotsDrawer
          isOpen={showSnapshotsDrawer}
          onClose={() => setShowSnapshotsDrawer(false)}
          listId={list.id}
          listName={list.name}
          currentSnapshotId={viewingSnapshotId}
          onSelectSnapshot={goToSnapshot}
        />
      )}

      {/* Floating Admin Report Button for Folders */}
      {isAdmin && list?.isOrdered && (
        <button
          onClick={() => setShowReportDrawer(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-lg transition-all hover:scale-105"
          title="Generate Collection Report"
        >
          <FileText className="h-5 w-5" />
          <span className="hidden sm:inline">Report</span>
        </button>
      )}

      {/* Floating Snapshots Button para carpetas ordenadas (dueño, no Colección).
          Anclado a la izquierda para no chocar con el stack de botones de la derecha. */}
      {isOwner && list?.isOrdered && !list?.isCollection && (
        <button
          onClick={() => setShowSnapshotsDrawer(true)}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full shadow-lg transition-all hover:scale-105"
          title="Ver snapshots de esta carpeta"
        >
          <Camera className="h-5 w-5" />
          <span className="hidden sm:inline">Snapshots</span>
        </button>
      )}

      {/* Botones flotantes en carpetas: importar copia (si no es mía) + toggle admin.
          Abajo-derecha, apilados ARRIBA del botón Report (la izquierda/arriba
          chocaban con el navbar). */}
      {list?.isOrdered && (!isOwner || isAdmin) && (
        <div
          className={`fixed right-6 z-[60] flex flex-col items-end gap-2 ${
            isAdmin && list?.isOrdered ? "bottom-24" : "bottom-6"
          }`}
        >
          {!isOwner && isLoggedIn && (
            <button
              onClick={handleImportList}
              disabled={importing}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-700 disabled:opacity-70"
              title="Crear una copia de esta lista en tu cuenta"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {importing ? "Importando…" : "Importar copia"}
              </span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowListedMedian((v) => !v)}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all hover:scale-105 ${
                showListedMedian
                  ? "bg-sky-600 text-white hover:bg-sky-700"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Solo admin: alternar entre Listed Median y Market Price"
            >
              {showListedMedian ? "Listed Median" : "Market Price"}
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default ListDetailPage;
