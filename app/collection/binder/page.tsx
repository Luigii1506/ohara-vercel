"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogIn } from "lucide-react";
import { toast } from "react-toastify";
import { signIn } from "next-auth/react";
import { MainContentSkeleton } from "@/components/skeletons";
import { CardWithCollectionData } from "@/types";
import { BookFlipContainer } from "@/components/folder";
import { GridCard } from "@/components/folder/types";
import { useFolderDimensions } from "@/hooks/useFolderDimensions";
import Image from "next/image";
import Logo from "@/public/assets/images/new_logo.png";

import { Oswald } from "next/font/google";

const oswald = Oswald({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

interface CollectionCard {
  id: number;
  cardId: number;
  quantity: number;
  notes: string | null;
  condition: string | null;
  customPrice: number | null;
  customCurrency: string | null;
  card: CardWithCollectionData;
}

interface CollectionSlot {
  id: number;
  collectionCardId: number;
  sortOrder: number;
  cardId: number;
  card: CardWithCollectionData;
}

interface SlotCard {
  id: number;
  card: CardWithCollectionData;
}

interface CollectionResponse {
  collection: {
    id: number;
    userId: number;
    isPublic: boolean;
    stats: {
      totalUniqueCards: number;
      totalCardsCount: number;
    };
  };
  cards: CollectionCard[];
  slots?: CollectionSlot[];
  pagination: {
    totalCards: number;
  };
}

const CollectionBinderContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const rows = parseInt(searchParams.get("rows") || "3");
  const cols = parseInt(searchParams.get("cols") || "3");

  // States
  const [cards, setCards] = useState<SlotCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [totalPages, setTotalPages] = useState(1);

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    return getNumericPrice(card.marketPrice) ?? null;
  };

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

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

  const navigateNext = () => {
    if (!navigationFunctions) return;
    navigationFunctions.flipNext();
  };

  const navigatePrev = () => {
    if (!navigationFunctions) return;
    navigationFunctions.flipPrev();
  };

  const [selectedCard, setSelectedCard] =
    useState<CardWithCollectionData | null>(null);
  const [showLargeImage, setShowLargeImage] = useState(false);

  // Use the shared hook for folder dimensions
  const folderDimensions = useFolderDimensions(rows, cols, windowSize, false);

  // Create grid from cards for a specific page
  const createGrid = (pageCards: SlotCard[]): GridCard[][] => {
    const grid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(null));

    pageCards.forEach((collectionCard, index) => {
      if (!collectionCard || !collectionCard.card) return;
      const row = Math.floor(index / cols);
      const col = index % cols;

      if (row < rows) {
        const gridCard: GridCard = {
          card: collectionCard.card,
          quantity: 1,
        };
        grid[row][col] = gridCard;
      }
    });

    return grid;
  };

  const getCardsForPage = (pageNumber: number | string) => {
    if (pageNumber === 0 || pageNumber === "cover") return [];

    const cardsPerPage = rows * cols;
    const startIndex = (Number(pageNumber) - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;

    return cards.slice(startIndex, endIndex);
  };

  // Window resize handler for responsive calculations
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

      const safePage = Math.max(0, Math.min(currentPage, totalPages));
      const maxPage = totalPages;

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
          setCurrentPage(0);
          break;
        case "End":
          event.preventDefault();
          setCurrentPage(maxPage);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, navigationFunctions]);

  // Swipe detection for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (windowSize.width >= 768) return;

    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || windowSize.width >= 768) return;

    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || windowSize.width >= 768) return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;

    if (
      Math.abs(deltaX) > minSwipeDistance &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaY) < maxVerticalDistance
    ) {
      const maxPage = totalPages;

      if (deltaX > 0) {
        if (currentPage < maxPage) {
          setCurrentPage(currentPage + 1);
        }
      } else {
        if (currentPage > 0) {
          setCurrentPage(currentPage - 1);
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Fetch all collection cards
  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collection?limit=0&includeSlots=1`);
      if (!response.ok) throw new Error("Failed to fetch collection");
      const data: CollectionResponse = await response.json();

      if (data.slots && data.slots.length) {
        setCards(
          data.slots.map((slot) => ({
            id: slot.id,
            card: slot.card,
          }))
        );
      } else {
        const expanded = data.cards.flatMap((item) =>
          Array.from({ length: item.quantity }, (_, idx) => ({
            id: item.id * 1000 + idx,
            card: item.card,
          }))
        );
        setCards(expanded);
      }

      // Calculate total pages based on grid size
      const cardsPerPage = rows * cols;
      const totalCount = data.slots?.length ?? data.cards.length;
      const calculatedPages = Math.ceil(totalCount / cardsPerPage);
      setTotalPages(Math.max(1, calculatedPages));
    } catch (error) {
      console.error("Error fetching collection:", error);
      toast.error("Error al cargar la colección");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchCollection();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, rows, cols]);

  const handleCardClick = (card: CardWithCollectionData) => {
    setSelectedCard(card);
    setShowLargeImage(true);
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Not authenticated view
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-black rounded-xl p-4 mb-6 inline-block">
            <Image
              src={Logo}
              height={150}
              width={150}
              alt="logo"
              className="invert"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ver Carpeta
          </h1>
          <p className="text-slate-300 mb-8">
            Inicia sesión para ver tu colección como carpeta
          </p>
          <Button
            size="lg"
            className="bg-white text-black hover:bg-slate-100"
            onClick={() => signIn("google")}
          >
            <LogIn className="w-5 h-5 mr-2" />
            Iniciar sesión con Google
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
        <div className="container mx-auto px-4 py-6 h-full">
          <MainContentSkeleton />
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Colección vacía
          </h3>
          <p className="text-slate-600 mb-4">
            Agrega cartas a tu colección para verlas en la carpeta.
          </p>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/collection")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la colección
          </Button>
        </div>
      </div>
    );
  }

  const dims = folderDimensions;
  const safePage = Math.max(0, currentPage);
  const totalPagesWithCover = totalPages;

  return (
    <>
      <div
        className="h-full overflow-hidden w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col relative w-full">
          {/* Mobile header */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={() => router.push("/collection")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
              {dims.showSinglePage && (
                <div className="text-xs font-semibold text-slate-700">
                  {safePage === 0
                    ? "Cubierta"
                    : `Página ${safePage} de ${totalPages}`}
                </div>
              )}
            </div>
          </div>

          {/* Desktop back button */}
          <div className="absolute top-4 left-4 z-20 hidden md:block">
            <Button
              onClick={() => router.push("/collection")}
              variant="secondary"
              size="sm"
              className="gap-2 bg-white/90 backdrop-blur-sm shadow-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
          </div>

          {/* Mobile Page Info - Top */}
          {dims.showSinglePage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 hidden md:block">
              <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                {safePage === 0
                  ? "Cubierta Interior"
                  : `Página ${safePage} de ${totalPages}`}
              </div>
            </div>
          )}

          {/* Folder Container */}
          <div className="flex-1 flex items-center justify-center p-1 pt-16 sm:p-4 relative min-h-0 md:pt-4">
            <BookFlipContainer
              name="Mi Colección"
              color="blue"
              dimensions={dims}
              currentPage={safePage}
              totalPages={totalPages}
              maxRows={rows}
              maxColumns={cols}
              cardCount={cards.length}
              createGrid={createGrid}
              getCardsForPage={getCardsForPage}
              isEditing={false}
              onCardClick={handleCardClick}
              showInteriorPage={true}
              onPageChange={handlePageChange}
              onNavigationReady={setNavigationFunctions}
              showNavigationButtons={true}
              showMobileNavigationButtons={false}
              onNavigatePrev={navigatePrev}
              onNavigateNext={navigateNext}
              maxNavigablePage={totalPagesWithCover}
            />
          </div>

          {/* Mobile nav */}
          <div className="md:hidden pb-[calc(env(safe-area-inset-bottom)+12px)] px-3">
            <div className="mx-auto flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={navigatePrev}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Anterior
              </button>
              <div className="flex flex-col items-center px-2 text-[11px] font-semibold text-slate-600">
                <span className="uppercase tracking-wide text-[10px] text-slate-400">
                  Página
                </span>
                <span>
                  {safePage === 0
                    ? "Cubierta"
                    : `${safePage} / ${totalPages}`}
                </span>
              </div>
              <button
                type="button"
                onClick={navigateNext}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card preview modal - view only */}
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
                  if (priceValue !== null) {
                    return (
                      <>
                        <br />
                        <span className="inline-block mt-3 px-6 py-3 bg-emerald-600 text-white text-xl font-bold rounded-lg shadow-lg">
                          {formatCurrency(priceValue, selectedCard.priceCurrency)}
                        </span>
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

// Wrap with Suspense for useSearchParams
const CollectionBinderPage = () => {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
          <div className="container mx-auto px-4 py-6 h-full">
            <MainContentSkeleton />
          </div>
        </div>
      }
    >
      <CollectionBinderContent />
    </Suspense>
  );
};

export default CollectionBinderPage;
