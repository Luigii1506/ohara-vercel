import React from "react";
import { CardWithCollectionData } from "@/types";
import { CardGrid } from "./CardGrid";
import { FolderTab } from "./FolderTab";
import { GridCard, FolderDimensions } from "./types";

interface FolderPageProps {
  pageNumber: number;
  color: string;
  dimensions: FolderDimensions;
  maxRows: number;
  maxColumns: number;
  cards: GridCard[][];
  isInteriorCover?: boolean;
  tabLabel?: string;
  listName?: string;
  cardCount?: number;
  isEditing?: boolean;
  isMobile?: boolean;
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
}

export const FolderPage: React.FC<FolderPageProps> = ({
  pageNumber,
  color,
  dimensions,
  maxRows,
  maxColumns,
  cards,
  isInteriorCover = false,
  tabLabel,
  listName,
  cardCount,
  isEditing = false,
  isMobile = false,
  onCardClick,
  onPositionClick,
  onDragHandlers,
  dragOverPosition,
  selectedCardForPlacement,
}) => {
  return (
    <div
      className="relative rounded-lg  h-full flex flex-col"
      style={{
        //backgroundColor: isInteriorCover ? color || "#1b2416" : "#141b12",
        backgroundColor: "black",
      }}
    >
      {/* Folder holes removed - now using center divider line */}

      {/* Content with uniform padding - no holes to avoid */}
      <div
        className={`flex-1 min-h-0 ${
          isInteriorCover
            ? "p-2 md:p-6" // Interior cover: uniform padding
            : "p-2 md:p-6" // Regular pages: uniform padding
        }`}
      >
        {isInteriorCover ? (
          // Inside folder cover design
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <img
                src="/assets/images/LOGO_OHARA.svg"
                alt="Ohara"
                className="mx-auto h-auto w-64 sm:w-72 opacity-90 drop-shadow-[0_10px_24px_rgba(0,0,0,0.7)]"
              />
              <div className="mt-4 text-lg font-medium text-white">
                {listName}
              </div>
              {typeof cardCount === "number" && (
                <div className="mt-1 text-sm text-slate-200">
                  {cardCount} cartas
                </div>
              )}
              {/* <div className="mt-1 text-sm text-gray-300">
                Cubierta interior
              </div> */}
            </div>
          </div>
        ) : (
          <CardGrid
            cards={cards}
            dimensions={dimensions}
            currentPage={pageNumber}
            maxRows={maxRows}
            maxColumns={maxColumns}
            isEditing={isEditing}
            onCardClick={onCardClick}
            onPositionClick={onPositionClick}
            onDragHandlers={onDragHandlers}
            dragOverPosition={dragOverPosition}
            selectedCardForPlacement={selectedCardForPlacement}
          />
        )}
      </div>

      {/* Folder Tab */}
      {/* {tabLabel && <FolderTab label={tabLabel} />} */}
    </div>
  );
};
