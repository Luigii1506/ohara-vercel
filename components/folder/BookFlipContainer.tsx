"use client";

import React, { useRef, useEffect, forwardRef, useState, useMemo } from "react";
import HTMLFlipBook from "react-pageflip";
import { FolderPage } from "./FolderPage";
import { FolderCover } from "./FolderCover";
import { FolderDimensions, GridCard } from "./types";
import { CardWithCollectionData } from "@/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

interface BookFlipContainerProps {
  name: string;
  color: string;
  dimensions: FolderDimensions;
  currentPage: number;
  totalPages: number;
  maxRows: number;
  maxColumns: number;
  cardCount: number;
  totalValueLabel?: string;
  shareUrl?: string;
  // Page creation functions
  createGrid: (pageCards: any[], pageNumber?: number) => GridCard[][];
  getCardsForPage: (pageNumber: number) => any[];
  // Interaction handlers
  isEditing?: boolean;
  onCardClick?: (card: CardWithCollectionData) => void;
  onPositionClick?: (row: number, col: number) => void;
  onDragHandlers?: {
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (
      e: React.DragEvent,
      page: number,
      row: number,
      column: number
    ) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (
      e: React.DragEvent,
      page: number,
      row: number,
      column: number
    ) => void;
  };
  dragOverPosition?: { page: number; row: number; column: number } | null;
  selectedCardForPlacement?: CardWithCollectionData | null;
  canEditPrice?: boolean;
  onEditPrice?: (entry: { card: CardWithCollectionData; listCard: any }) => void;
  // Mode flags
  showInteriorPage?: boolean;
  // Page change callback
  onPageChange?: (pageNumber: number) => void;
  // Navigation functions
  onNavigationReady?: (navigation: {
    flipNext: () => void;
    flipPrev: () => void;
  }) => void;
  // 🔄 Navigation controls inside folder
  showNavigationButtons?: boolean;
  showMobileNavigationButtons?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  maxNavigablePage?: number;
}

// Page component that will be used by react-pageflip
const FlipPage = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    isMobile?: boolean;
  }
>((props, ref) => {
  return (
    <div
      ref={ref}
      className={`${props.className || ""}`}
      data-density="hard"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: props.isMobile ? "block" : "inline-block", // Desktop: inline-block for two pages
      }}
    >
      {props.children}
    </div>
  );
});

FlipPage.displayName = "FlipPage";

export const BookFlipContainer: React.FC<BookFlipContainerProps> = ({
  name,
  color,
  dimensions,
  currentPage,
  totalPages,
  maxRows,
  maxColumns,
  cardCount,
  totalValueLabel,
  shareUrl,
  createGrid,
  getCardsForPage,
  isEditing = false,
  onCardClick,
  onPositionClick,
  onDragHandlers,
  dragOverPosition,
  selectedCardForPlacement,
  canEditPrice,
  onEditPrice,
  showInteriorPage = true,
  onPageChange,
  onNavigationReady,
  // 🔄 Navigation controls
  showNavigationButtons = false,
  showMobileNavigationButtons = true,
  onNavigatePrev,
  onNavigateNext,
  maxNavigablePage,
}) => {
  const { t } = useI18n();
  const bookRef = useRef<any>(null);
  const interceptorRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Custom swipe detection state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Mobile detection
  const isMobile = dimensions.showSinglePage;

  // Helper functions for mobile-aware navigation
  const navigateNext = () => {
    if (!bookRef.current) return;

    try {
      const flipBook = bookRef.current.pageFlip();
      if (!flipBook) return;

      if (isMobile) {
        flipBook.turnToNextPage();
      } else {
        flipBook.flipNext();
      }
    } catch (error) {
      console.error("Error in navigateNext:", error);
    }
  };

  const navigatePrev = () => {
    if (!bookRef.current) return;

    try {
      const flipBook = bookRef.current.pageFlip();
      if (!flipBook) return;

      if (isMobile) {
        flipBook.turnToPrevPage();
      } else {
        flipBook.flipPrev();
      }
    } catch (error) {
      console.error("Error in navigatePrev:", error);
    }
  };

  // Calculate page dimensions for HTMLFlipBook
  // Mobile: single page needs full width, Desktop: half width for double pages
  const pageWidth = dimensions.showSinglePage
    ? dimensions.binderWidth - 8 // Mobile: full width minus margin
    : Math.floor((dimensions.binderWidth - 8) / 2); // Desktop: half width for TWO pages side by side
  const pageHeight = dimensions.binderHeight;

  // For desktop two-page view, we need full container width
  const containerWidth = dimensions.showSinglePage
    ? pageWidth
    : dimensions.binderWidth - 8; // Desktop: full container width to show two pages

  // Dimensions calculated and ready

  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      if (bookRef.current) {
        setIsResizing(true);

        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }

        resizeTimeout = setTimeout(() => {
          try {
            const flipBook = bookRef.current;
            if (flipBook && flipBook.pageFlip) {
              flipBook.pageFlip().updateSizes();

              setTimeout(() => {
                try {
                  const currentPageIndex = flipBook
                    .pageFlip()
                    .getCurrentPageIndex();
                  if (currentPageIndex !== undefined) {
                    flipBook.pageFlip().flip(currentPageIndex);
                  }
                } catch (error) {
                  console.log("Page flip error:", error);
                }
                setIsResizing(false);
              }, 50);
            }
          } catch (error) {
            console.log("Resize error:", error);
            setIsResizing(false);
          }
        }, 150);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, []);

  // Effect to handle page changes from outside
  useEffect(() => {
    if (!bookRef.current || isResizing) return;

    const flipBook = bookRef.current;

    try {
      const currentIndex = flipBook.pageFlip().getCurrentPageIndex();
      if (currentPage !== currentIndex) {
        setTimeout(() => {
          try {
            flipBook.pageFlip().flip(currentPage);
          } catch (error) {
            console.log("Delayed flip error:", error);
          }
        }, 100);
      }
    } catch (error) {
      console.log("Flip error:", error);
    }
  }, [currentPage, isResizing]);

  // Effect to expose navigation functions
  useEffect(() => {
    if (!bookRef.current || !onNavigationReady) return;

    const flipBook = bookRef.current;

    const navigation = {
      flipNext: navigateNext,
      flipPrev: navigatePrev,
    };

    onNavigationReady(navigation);
  }, [onNavigationReady]);

  // Effect to handle non-passive touch events on interceptor
  useEffect(() => {
    if (!dimensions.showSinglePage || !interceptorRef.current) return;

    const interceptor = interceptorRef.current;

    const handleNativeStart = (e: TouchEvent) => {
      // NO prevenir el evento inicial - permitir que llegue a las cartas
      setTouchEnd(null);
      setTouchStart(e.touches[0].clientX);
    };

    const handleNativeMove = (e: TouchEvent) => {
      // NO prevenir durante el movimiento - permitir scroll normal
      setTouchEnd(e.touches[0].clientX);
    };

    const handleNativeEnd = (e: TouchEvent) => {
      if (!touchStart || !touchEnd) {
        // No hay datos de swipe - permitir que el evento continue (tap normal)
        return;
      }

      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      // Solo interceptar si detectamos un swipe real
      if (isLeftSwipe || isRightSwipe) {
        // AHORA sí prevenir porque es un swipe, no un tap
        e.preventDefault();
        e.stopPropagation();

        if (bookRef.current) {
          if (isLeftSwipe) {
            navigateNext();
          } else if (isRightSwipe) {
            navigatePrev();
          }
        }
      }
      // Si no es swipe, no hacer nada - permitir que el tap llegue a onCardClick

      // Limpiar estados
      setTouchStart(null);
      setTouchEnd(null);
    };

    // Add non-passive event listeners
    interceptor.addEventListener("touchstart", handleNativeStart, {
      passive: false,
    });
    interceptor.addEventListener("touchmove", handleNativeMove, {
      passive: false,
    });
    interceptor.addEventListener("touchend", handleNativeEnd, {
      passive: false,
    });

    return () => {
      interceptor.removeEventListener("touchstart", handleNativeStart);
      interceptor.removeEventListener("touchmove", handleNativeMove);
      interceptor.removeEventListener("touchend", handleNativeEnd);
    };
  }, [dimensions.showSinglePage, touchStart, touchEnd]);

  // Generate all pages for the flip book
  const pages = useMemo(() => {
    const generatedPages: React.ReactNode[] = [];

    // For desktop two-page view:
    // currentPage=0 shows: Interior (left) + Page 1 (right) → indices [0,1]
    // currentPage=1 shows: Page 2 (left) + Page 3 (right) → indices [2,3]
    // currentPage=2 shows: Page 4 (left) + Page 5 (right) → indices [4,5]

    if (showInteriorPage) {
      // Add Interior page first (will be at index 0 = left side)
      generatedPages.push(
        <FlipPage
          key={`interior-${dimensions.binderWidth}-${dimensions.binderHeight}`}
          className="page"
          isMobile={dimensions.showSinglePage}
        >
          <FolderPage
            pageNumber={0} // Interior is page 0
            color={color}
            dimensions={dimensions}
            maxRows={maxRows}
            maxColumns={maxColumns}
            cards={Array(maxRows)
              .fill(null)
              .map(() => Array(maxColumns).fill(null))}
            isInteriorCover={true}
            tabLabel={t("folder.cover")}
            listName={name}
            cardCount={cardCount}
            totalValueLabel={totalValueLabel}
            shareUrl={shareUrl}
            isEditing={isEditing}
            isMobile={dimensions.showSinglePage}
            onCardClick={onCardClick}
            onPositionClick={onPositionClick}
            onDragHandlers={onDragHandlers}
            dragOverPosition={dragOverPosition}
            selectedCardForPlacement={selectedCardForPlacement}
            canEditPrice={canEditPrice}
            onEditPrice={onEditPrice}
          />
        </FlipPage>
      );
    }

    // Generate regular pages (will be at index 1, 2, 3... = right side, left side, right side...)
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageCards = getCardsForPage(pageNum);
      const grid = createGrid(pageCards, pageNum); // 🎴 Pasar número de página para backcard

      generatedPages.push(
        <FlipPage
          key={`page-${pageNum}-${dimensions.binderWidth}-${dimensions.binderHeight}`}
          className="page"
          isMobile={dimensions.showSinglePage}
        >
          <FolderPage
            pageNumber={pageNum}
            color={color}
            dimensions={dimensions}
            maxRows={maxRows}
            maxColumns={maxColumns}
            cards={grid}
            isInteriorCover={false}
            tabLabel={`${t("folder.page")} ${pageNum}`}
            listName={name}
            isEditing={isEditing}
            isMobile={dimensions.showSinglePage}
            onCardClick={onCardClick}
            onPositionClick={onPositionClick}
            onDragHandlers={onDragHandlers}
            dragOverPosition={dragOverPosition}
            selectedCardForPlacement={selectedCardForPlacement}
            canEditPrice={canEditPrice}
            onEditPrice={onEditPrice}
            shareUrl={shareUrl}
          />
        </FlipPage>
      );
    }

    return generatedPages;
  }, [
    dimensions.binderWidth,
    dimensions.binderHeight,
    totalPages,
    maxRows,
    maxColumns,
    name,
    color,
    cardCount,
    totalValueLabel,
    shareUrl,
    showInteriorPage,
    isEditing,
    getCardsForPage,
    createGrid,
    onCardClick,
    onPositionClick,
    onDragHandlers,
    dragOverPosition,
    selectedCardForPlacement,
  ]);

  // Handle page flip events
  const handleFlip = (e: any) => {
    if (onPageChange) {
      const flipBookIndex = e.data;
      console.log(
        "🔄 FlipBook reported index:",
        flipBookIndex,
        "showSinglePage:",
        dimensions.showSinglePage
      );
      onPageChange(flipBookIndex);
    }
  };

  return (
    <div
      className={`${
        dimensions.showSinglePage ? "px-0" : "px-5"
      }  py-2 rounded-lg`}
      style={{
        backgroundColor: color || "white",
      }}
    >
      <div
        className="relative binder-container"
        style={{
          width: `${dimensions.binderWidth}px`,
          height: `${dimensions.binderHeight}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {/* 🎨 Professional Navigation Buttons - Always visible and beautiful */}
        {showNavigationButtons && (
          <>
            {/* Desktop Navigation Buttons - Premium Design */}
            {!dimensions.showSinglePage && (
              <>
                {/* Previous Button - Left side, slightly outside folder */}
                <Button
                  onClick={onNavigatePrev}
                  disabled={currentPage <= 0}
                  variant="ghost"
                  size="lg"
                  className="absolute -left-8 top-1/2 -translate-y-1/2 z-30 group
                    h-16 w-16 rounded-full 
                    bg-gradient-to-r from-slate-800 to-slate-900 
                    hover:from-slate-900 hover:to-black
                    shadow-xl hover:shadow-2xl 
                    border-2 border-slate-600/30 hover:border-slate-500/40
                    transition-all duration-300 ease-out
                    hover:scale-110 active:scale-95
                    disabled:opacity-40 disabled:cursor-not-allowed
                    disabled:hover:scale-100 disabled:bg-gray-500"
                >
                  <ChevronLeft
                    className="h-16 w-16 text-white group-hover:text-gray-100 transition-colors duration-200"
                    strokeWidth={4}
                    stroke="white"
                    fill="white"
                    style={{
                      filter:
                        "drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.8)) drop-shadow(-1px -1px 2px rgba(255, 255, 255, 0.9))",
                    }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Button>

                {/* Next Button - Right side, slightly outside folder */}
                <Button
                  onClick={onNavigateNext}
                  disabled={currentPage >= (maxNavigablePage || totalPages)}
                  variant="ghost"
                  size="lg"
                  className="absolute -right-8 top-1/2 -translate-y-1/2 z-30 group
                    h-16 w-16 rounded-full 
                    bg-gradient-to-r from-slate-800 to-slate-900 
                    hover:from-slate-900 hover:to-black
                    shadow-xl hover:shadow-2xl 
                    border-2 border-slate-600/30 hover:border-slate-500/40
                    transition-all duration-300 ease-out
                    hover:scale-110 active:scale-95
                    disabled:opacity-40 disabled:cursor-not-allowed
                    disabled:hover:scale-100 disabled:bg-gray-500"
                >
                  <ChevronRight
                    className="h-16 w-16 text-white group-hover:text-gray-100 transition-colors duration-200"
                    strokeWidth={4}
                    stroke="white"
                    fill="white"
                    style={{
                      filter:
                        "drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.8)) drop-shadow(-1px -1px 2px rgba(255, 255, 255, 0.9))",
                    }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Button>

                {/* Page Indicator - Top center - Shows both pages in desktop mode */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30">
                  <div className="px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm font-medium rounded-full shadow-lg border border-white/10">
                    {currentPage === 0 ? (
                      <>
                        <span className="text-blue-300">
                          {t("folder.insideCover")}
                        </span>{" "}
                        - <span className="text-blue-300">{t("folder.page")}</span>{" "}
                        1
                      </>
                    ) : (
                      <>
                        {/* In desktop mode, currentPage is the flip book index */}
                        {/* Index 0 = Interior+Page1, Index 2 = Page2+Page3, Index 4 = Page4+Page5... */}
                        {/* So left page number = currentPage, right page = currentPage + 1 */}
                        <span className="text-blue-300">
                          {t("folder.pages")}
                        </span>{" "}
                        {Math.min(currentPage, totalPages)}-
                        {Math.min(currentPage + 1, totalPages)}
                        <span className="text-slate-400">
                          {" "}
                          {t("folder.of")} {totalPages}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Mobile Navigation Buttons - Premium Design */}
            {dimensions.showSinglePage && showMobileNavigationButtons && (
              <>
                {/* Navigation Buttons - Bottom with elegant spacing */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 z-30">
                  <Button
                    onClick={onNavigatePrev}
                    disabled={currentPage <= 0}
                    variant="ghost"
                    size="lg"
                    className="group h-14 w-14 rounded-full 
                      bg-gradient-to-r from-slate-800 to-slate-900 
                      hover:from-slate-900 hover:to-black
                      shadow-xl hover:shadow-2xl 
                      border-2 border-slate-600/30 hover:border-slate-500/40
                      transition-all duration-300 ease-out
                      hover:scale-110 active:scale-95
                      disabled:opacity-40 disabled:cursor-not-allowed
                      disabled:hover:scale-100 disabled:bg-gray-500"
                  >
                    <ChevronLeft
                      className="h-10 w-10 text-white group-hover:text-gray-100 transition-colors duration-200"
                      strokeWidth={4}
                      stroke="white"
                      fill="white"
                      style={{
                        filter:
                          "drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.8)) drop-shadow(-1px -1px 2px rgba(255, 255, 255, 0.9))",
                      }}
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </Button>

                  <Button
                    onClick={onNavigateNext}
                    disabled={currentPage >= (maxNavigablePage || totalPages)}
                    variant="ghost"
                    size="lg"
                    className="group h-14 w-14 rounded-full 
                      bg-gradient-to-r from-slate-800 to-slate-900 
                      hover:from-slate-900 hover:to-black
                      shadow-xl hover:shadow-2xl 
                      border-2 border-slate-600/30 hover:border-slate-500/40
                      transition-all duration-300 ease-out
                      hover:scale-110 active:scale-95
                      disabled:opacity-40 disabled:cursor-not-allowed
                      disabled:hover:scale-100 disabled:bg-gray-500"
                  >
                    <ChevronRight
                      className="h-10 w-10 text-white group-hover:text-gray-100 transition-colors duration-200"
                      strokeWidth={4}
                      stroke="white"
                      fill="white"
                      style={{
                        filter:
                          "drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.8)) drop-shadow(-1px -1px 2px rgba(255, 255, 255, 0.9))",
                      }}
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* 📏 Center Divider Line - Only on Desktop (two pages side by side) */}
        {!dimensions.showSinglePage && (
          <div className="absolute left-1/2 top-0 bottom-0 z-20 flex items-center justify-center">
            <div className="w-px h-full bg-gradient-to-b from-transparent via-slate-300/60 to-transparent"></div>
            {/* <div className="absolute top-1/2 -translate-y-1/2 w-2 h-8 bg-gradient-to-b from-slate-400/40 via-slate-500/60 to-slate-400/40 rounded-full shadow-sm border-l border-r border-slate-300/30"></div> */}
          </div>
        )}

        {dimensions.showSinglePage ? (
          <div
            ref={interceptorRef}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              //pointerEvents: "all",
            }}
          >
            <HTMLFlipBook
              key={`flipbook-${dimensions.binderWidth}-${dimensions.binderHeight}`}
              ref={bookRef}
              width={pageWidth}
              height={pageHeight}
              size="stretch"
              minWidth={pageWidth}
              maxWidth={pageWidth}
              minHeight={pageHeight}
              maxHeight={pageHeight}
              maxShadowOpacity={0.5}
              showCover={false}
              mobileScrollSupport={true}
              onFlip={handleFlip}
              className="flipbook"
              style={{
                margin: "0 auto",
                opacity: isResizing ? 0.7 : 1,
                transition: "opacity 0.3s ease-in-out",
              }}
              startPage={showInteriorPage ? 0 : 1}
              drawShadow={true}
              flippingTime={600}
              usePortrait={true}
              useMouseEvents={false}
              swipeDistance={0}
              clickEventForward={false}
              disableFlipByClick={true}
              startZIndex={0}
              autoSize={false}
              showPageCorners={false}
            >
              {pages}
            </HTMLFlipBook>
          </div>
        ) : (
          // Desktop: TWO PAGES SIDE BY SIDE - Force double page layout
          <div
            style={{
              width: `${containerWidth}px`,
              height: `${pageHeight}px`,
              margin: "0 auto",
              position: "relative",
            }}
          >
            <HTMLFlipBook
              key={`flipbook-${dimensions.binderWidth}-${dimensions.binderHeight}`}
              ref={bookRef}
              width={pageWidth} // Width of EACH individual page (half of container)
              height={pageHeight}
              size="fixed" // Fixed size for precise control
              minWidth={pageWidth}
              maxWidth={pageWidth}
              minHeight={pageHeight}
              maxHeight={pageHeight}
              maxShadowOpacity={0.5}
              showCover={false} // Consistent with mobile, prevents index misalignment
              mobileScrollSupport={false}
              onFlip={handleFlip}
              className="flipbook-desktop"
              startPage={showInteriorPage ? 0 : 1}
              drawShadow={true}
              flippingTime={600}
              usePortrait={false} // CRITICAL: Horizontal layout for two pages
              useMouseEvents={false} // 🔥 Disable mouse events to prevent accidental flips
              swipeDistance={0} // 🔥 Disable swipe to prevent accidental flips
              clickEventForward={false}
              disableFlipByClick={true} // 🔥 Disable flip by click - only allow button navigation
              startZIndex={0}
              autoSize={false}
              showPageCorners={false}
              style={{
                width: `${containerWidth}px`, // Container shows both pages
                height: `${pageHeight}px`,
                margin: "0 auto",
                opacity: isResizing ? 0.7 : 1,
                transition: "opacity 0.3s ease-in-out",
              }}
            >
              {pages}
            </HTMLFlipBook>
          </div>
        )}
      </div>
    </div>
  );
};
