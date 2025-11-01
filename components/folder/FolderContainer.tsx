import React from "react";
import { CardWithCollectionData } from "@/types";
import { FolderCover } from "./FolderCover";
import { FolderPage } from "./FolderPage";
import { FolderDimensions, GridCard } from "./types";

interface FolderContainerProps {
  name: string;
  color: string;
  dimensions: FolderDimensions;
  currentPage: number;
  totalPages: number;
  maxRows: number;
  maxColumns: number;
  cardCount: number;
  // Page creation functions
  createGrid: (pageCards: any[]) => GridCard[][];
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
  // Mode flags
  showInteriorPage?: boolean; // Controls whether to show interior cover page (add-cards = false, page.tsx = true)
}

export const FolderContainer: React.FC<FolderContainerProps> = ({
  name,
  color,
  dimensions,
  currentPage,
  totalPages,
  maxRows,
  maxColumns,
  cardCount,
  createGrid,
  getCardsForPage,
  isEditing = false,
  onCardClick,
  onPositionClick,
  onDragHandlers,
  dragOverPosition,
  selectedCardForPlacement,
  showInteriorPage = true,
}) => {
  // Calculate safe page number
  const safePage = dimensions.showSinglePage
    ? Math.max(0, currentPage)
    : Math.max(0, currentPage);

  // Determine view types
  const isExternalCoverView = safePage === 0;
  const isFirstPageView =
    safePage === 1 && !dimensions.showSinglePage && showInteriorPage;

  // Calculate actual page numbers based on view number
  let leftPageNumber: number | string | null, rightPageNumber: number | null;

  if (dimensions.showSinglePage) {
    // Mobile: show external cover on view 0, then regular pages 1, 2, 3...
    if (safePage === 0) {
      leftPageNumber = "cover";
      rightPageNumber = null;
    } else {
      leftPageNumber = safePage;
      rightPageNumber = null;
    }
  } else {
    // Desktop: dual page view with folder behavior
    if (safePage === 0) {
      // View 0: External cover + empty
      leftPageNumber = "cover";
      rightPageNumber = null;
    } else if (safePage === 1 && showInteriorPage) {
      // View 1: Inside cover + Page 1 (only if showInteriorPage is true)
      leftPageNumber = null; // Inside cover
      rightPageNumber = 1;
    } else {
      // View 2+: Page pairs (adjust for interior page if needed)
      const pageOffset = showInteriorPage ? 1 : 0;
      leftPageNumber = (safePage - pageOffset) * 2;
      rightPageNumber = (safePage - pageOffset) * 2 + 1;
    }
  }

  // Get cards for pages
  const currentPageCards = dimensions.showSinglePage
    ? getCardsForPage(safePage)
    : leftPageNumber && typeof leftPageNumber === "number"
    ? getCardsForPage(leftPageNumber)
    : [];

  const nextPageCards = dimensions.showSinglePage
    ? []
    : rightPageNumber
    ? getCardsForPage(rightPageNumber)
    : [];

  // Create grids
  const leftGrid = (() => {
    if (dimensions.showSinglePage) {
      return createGrid(currentPageCards);
    } else if (isExternalCoverView || isFirstPageView) {
      // External cover or inside cover - show empty grid
      return Array(maxRows)
        .fill(null)
        .map(() => Array(maxColumns).fill(null));
    } else {
      // Normal page view
      return createGrid(currentPageCards);
    }
  })();

  const rightGrid = dimensions.showSinglePage ? [] : createGrid(nextPageCards);

  return (
    <div
      className={`py-2 rounded-lg ${
        dimensions.showSinglePage ? "px-1" : "px-5"
      }`}
      style={{
        backgroundColor: color || "white",
      }}
    >
      <div
        className="relative binder-container"
        style={{
          width:
            isExternalCoverView && !dimensions.showSinglePage
              ? `${(dimensions.binderWidth - 8) / 2}px` // External cover: single page width
              : `${dimensions.binderWidth}px`, // Normal: full binder width
          height: `${dimensions.binderHeight}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {isExternalCoverView ? (
          <FolderCover
            name={name}
            color={color}
            cardCount={cardCount}
            width={
              dimensions.showSinglePage
                ? dimensions.binderWidth
                : (dimensions.binderWidth - 8) / 2 // Subtract spine width and divide by 2
            }
            height={dimensions.binderHeight}
          />
        ) : dimensions.showSinglePage ? (
          <FolderPage
            pageNumber={typeof leftPageNumber === "number" ? leftPageNumber : 1}
            color={color}
            dimensions={dimensions}
            maxRows={maxRows}
            maxColumns={maxColumns}
            cards={leftGrid}
            isInteriorCover={false}
            tabLabel={
              isFirstPageView
                ? "Interior"
                : typeof leftPageNumber === "number"
                ? leftPageNumber === 1
                  ? "Primera página"
                  : `Página ${leftPageNumber}`
                : "Página"
            }
            listName={name}
            isEditing={isEditing}
            isMobile={dimensions.showSinglePage}
            onCardClick={onCardClick}
            onPositionClick={onPositionClick}
            onDragHandlers={onDragHandlers}
            dragOverPosition={dragOverPosition}
            selectedCardForPlacement={selectedCardForPlacement}
          />
        ) : (
          /* Dual Page Layout for Desktop */
          <div
            className="relative flex binder-container"
            style={{
              width: `${dimensions.binderWidth}px`,
              height: `${dimensions.binderHeight}px`,
              gap: "4px",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            {/* Left Page */}
            <div
              className="relative"
              style={{
                width: "calc(50% - 2px)",
              }}
            >
              <FolderPage
                pageNumber={
                  typeof leftPageNumber === "number" ? leftPageNumber : 1
                }
                color={color}
                dimensions={dimensions}
                maxRows={maxRows}
                maxColumns={maxColumns}
                cards={leftGrid}
                isInteriorCover={isFirstPageView}
                tabLabel={
                  leftPageNumber === "cover"
                    ? "Portada"
                    : leftPageNumber === null
                    ? "Cubierta"
                    : typeof leftPageNumber === "number"
                    ? `Página ${leftPageNumber}`
                    : undefined
                }
                listName={name}
                isEditing={isEditing}
                isMobile={dimensions.showSinglePage}
                onCardClick={onCardClick}
                onPositionClick={onPositionClick}
                onDragHandlers={onDragHandlers}
                dragOverPosition={dragOverPosition}
                selectedCardForPlacement={selectedCardForPlacement}
              />
            </div>

            {/* Right Page */}
            <div
              className="relative"
              style={{
                width: "calc(50% - 2px)",
              }}
            >
              <FolderPage
                pageNumber={rightPageNumber || 1}
                color={color}
                dimensions={dimensions}
                maxRows={maxRows}
                maxColumns={maxColumns}
                cards={rightGrid}
                isInteriorCover={false}
                tabLabel={
                  rightPageNumber ? `Página ${rightPageNumber}` : undefined
                }
                listName={name}
                isEditing={isEditing}
                isMobile={dimensions.showSinglePage}
                onCardClick={onCardClick}
                onPositionClick={onPositionClick}
                onDragHandlers={onDragHandlers}
                dragOverPosition={dragOverPosition}
                selectedCardForPlacement={selectedCardForPlacement}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
