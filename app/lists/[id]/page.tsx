"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, List } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { MainContentSkeleton } from "@/components/skeletons";
import { CardWithCollectionData } from "@/types";
import { BookFlipContainer } from "@/components/folder";
import { GridCard } from "@/components/folder/types";
import { useFolderDimensions } from "@/hooks/useFolderDimensions";
import TcgplayerLogo from "@/components/Icons/TcgplayerLogo";

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
  card: CardWithCollectionData;
}

interface UserList {
  id: number;
  name: string;
  description: string | null;
  isOrdered: boolean;
  isCollection: boolean;
  isPublic: boolean;
  totalPages: number;
  maxRows: number | null;
  maxColumns: number | null;
  cards: ListCard[];
  color: string | null;
}

const ListDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  // States
  const [list, setList] = useState<UserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0); // Start at view 0 (interior cover + page 1)
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    return getNumericPrice(card.marketPrice) ?? null;
  };

  const getListCardPriceValue = (listCard: ListCard) => {
    return (
      getNumericPrice(listCard.customPrice) ?? getCardPriceValue(listCard.card)
    );
  };

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const folderTotalValue = useMemo(() => {
    let totalValue = 0;
    let currency = "USD";

    list?.cards?.forEach((listCard) => {
      const priceValue = getListCardPriceValue(listCard);
      const quantity = listCard.quantity || 1;
      if (priceValue !== null) {
        totalValue += priceValue * quantity;
        currency =
          listCard.customCurrency ||
          listCard.card.priceCurrency ||
          currency;
      }
    });

    return { totalValue, currency };
  }, [list?.cards]);

  const folderTotalLabel = formatCurrency(
    folderTotalValue.totalValue,
    folderTotalValue.currency
  );

  const getTcgUrl = (card: CardWithCollectionData) => {
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
  const [backcardPositions, setBackcardPositions] = useState<Set<string>>(
    new Set()
  );

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

    return list?.cards.filter((listCard) => listCard.page === pageNumber) || [];
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
    if (!list?.id) return;
    const fetchBackcards = async () => {
      try {
        const response = await fetch(`/api/lists/${list.id}/backcards`);
        if (response.ok) {
          const backcards = await response.json();
          const backcardsSet = new Set<string>(
            backcards.map((b: any) => `${b.page}-${b.row}-${b.column}`)
          );
          setBackcardPositions(backcardsSet);
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

  const handleCardClick = (card: CardWithCollectionData) => {
    setSelectedCard(card);
    setShowLargeImage(true);
  };

  // Handle page change from flipbook
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
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
            cardCount={list.cards.length}
            totalValueLabel={folderTotalLabel}
            createGrid={createGrid}
            getCardsForPage={getCardsForPage}
            isEditing={false}
            onCardClick={handleCardClick}
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

    const safeFilteredCards =
      list.cards.filter(
        (listCard) =>
          listCard && listCard.card && listCard.card.name && listCard.card.code
      ) || [];

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
            <div className="text-sm text-slate-600">
              {safeFilteredCards.length} cartas
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
                        className="w-full h-full object-cover"
                      />
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
                        const priceValue = getListCardPriceValue(listCard);
                        const tcgUrl = getTcgUrl(listCard.card);
                        if (priceValue !== null) {
                          return (
                            <div className="mt-1.5 space-y-1.5">
                              <p className="text-sm font-bold text-emerald-600">
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
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard.src}
                className="max-w-full max-h-[calc(100dvh-200px)] object-contain rounded-lg shadow-2xl"
                alt={selectedCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard.code}
                </span>
                <br />
                <span>{selectedCard.set}</span>
                {(() => {
                  const priceValue = getCardPriceValue(selectedCard);
                  const tcgUrl = getTcgUrl(selectedCard);
                  if (priceValue !== null) {
                    return (
                      <>
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
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ListDetailPage;
