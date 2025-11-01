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
        backgroundColor: isInteriorCover
          ? color || "rgb(30, 41, 59)"
          : "#000000",
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
            <div className="text-center opacity-40">
              <div className="text-6xl mb-4">📁</div>
              <div className="text-lg font-medium text-white mb-2">
                {listName}
              </div>
              <div className="text-sm text-gray-200">Cubierta interior</div>
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
