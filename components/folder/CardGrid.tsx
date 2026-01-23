import React from "react";
import { Plus, Check, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardWithCollectionData } from "@/types";
import { GridCard, FolderDimensions } from "./types";

interface CardGridProps {
  cards: GridCard[][];
  dimensions: FolderDimensions;
  currentPage: number;
  maxRows: number;
  maxColumns: number;
  isEditing?: boolean;
  onCardClick?: (card: CardWithCollectionData) => void;
  onPositionClick?: (row: number, col: number, page?: number) => void;
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
}

export const CardGrid: React.FC<CardGridProps> = ({
  cards,
  dimensions,
  currentPage,
  maxRows,
  maxColumns,
  isEditing = false,
  onCardClick,
  onPositionClick,
  onDragHandlers,
  dragOverPosition,
  selectedCardForPlacement,
  canEditPrice = false,
  onEditPrice,
}) => {
  return (
    <div
      className="grid h-full"
      style={{
        gridTemplateColumns: `repeat(${maxColumns}, 1fr)`,
        gridTemplateRows: `repeat(${maxRows}, 1fr)`,
        gap: `${dimensions.gap}px`,
      }}
    >
      {cards.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const actualRow = rowIndex + 1;
          const actualCol = colIndex + 1;

          const isDropTarget =
            dragOverPosition?.page === currentPage &&
            dragOverPosition?.row === actualRow &&
            dragOverPosition?.column === actualCol;

          const isAvailableForPlacement =
            selectedCardForPlacement && !cell && isEditing;
          const canReplaceCard = selectedCardForPlacement && cell && isEditing;

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "relative rounded-md border-2 transition-all duration-200 border-transparent w-full h-full",
                isEditing && "cursor-pointer"
              )}
            >
              <div className="relative w-full h-full">
                {cell?.card ? (
                  <div
                    className="w-full h-full transition-all duration-200"
                    style={{ opacity: 1, zIndex: 1 }}
                  >
                    <div
                      className={cn(
                        "group relative rounded-[4%] shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg",
                        isEditing
                          ? "cursor-pointer hover:scale-105"
                          : "cursor-grab"
                      )}
                      style={{
                        width: `${dimensions.cardWidth}px`,
                        height: `${dimensions.cardHeight}px`,
                        maxWidth: "100%",
                        maxHeight: "100%",
                      }}
                      {...(isEditing && onDragHandlers
                        ? {
                            onDragOver: onDragHandlers.onDragOver,
                            onDragEnter: (e) =>
                              onDragHandlers.onDragEnter(
                                e,
                                currentPage,
                                actualRow,
                                actualCol
                              ),
                            onDragLeave: onDragHandlers.onDragLeave,
                            onDrop: (e) =>
                              onDragHandlers.onDrop(
                                e,
                                currentPage,
                                actualRow,
                                actualCol
                              ),
                          }
                        : {})}
                    >
                      <div
                        className="relative w-full h-full cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation(); // 🛡️ Evitar propagación hacia BookFlipContainer
                          if (onCardClick && cell.card) {
                            onCardClick(cell.card);
                          }
                        }}
                      >
                        <img
                          alt={cell.card.name}
                          className="w-full h-full object-cover transition-opacity duration-300 opacity-100"
                          loading="lazy"
                          src={cell.card.src}
                        />
                      </div>

                      {/* Quantity Badge - Shows in both viewing and editing modes */}
                      {cell.quantity && cell.quantity > 1 && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border-2 border-white shadow-md z-10">
                          <span className="text-sm">{cell.quantity}</span>
                        </div>
                      )}

                      {/* Price Badge - Shows in both viewing and editing modes */}
                      {cell.card && (() => {
                        const getNumericPrice = (value: any) => {
                          if (value === null || value === undefined || value === "") return null;
                          const numberValue = typeof value === "number" ? value : Number(value);
                          return Number.isFinite(numberValue) ? numberValue : null;
                        };

                        const formatCurrency = (value: number, currency?: string | null) =>
                          new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: currency || "USD",
                            minimumFractionDigits: 2,
                          }).format(value);

                        const customPriceValue = getNumericPrice(cell.existing?.customPrice);
                        const priceValue =
                          customPriceValue ?? getNumericPrice(cell.card.marketPrice);
                        const currencyValue =
                          cell.existing?.customCurrency ?? cell.card.priceCurrency;

                        if (priceValue !== null) {
                          return (
                            <div className="absolute -bottom-1 -left-1 bg-emerald-600 text-white rounded-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
                              {formatCurrency(priceValue, currencyValue)}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Status indicators for editing mode */}
                      {isEditing && (
                        <>
                          {canEditPrice &&
                            cell.existing &&
                            !cell.existing.isOptimistic &&
                            onEditPrice && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPrice({ card: cell.card!, listCard: cell.existing });
                              }}
                              className="absolute top-2 left-2 w-8 h-8 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Editar precio"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          {/* Delete Button (appears on hover) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPositionClick) {
                                onPositionClick(
                                  actualRow,
                                  actualCol,
                                  currentPage
                                );
                              }
                            }}
                            className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            title="Eliminar carta"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : cell?.hasBackcard ? (
                  // 🎴 Backcard - Imagen de reverso de carta
                  <div
                    className="w-full h-full transition-all duration-200"
                    style={{ opacity: 1, zIndex: 1 }}
                  >
                    <div
                      className={cn(
                        "group relative rounded-[4%] shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg",
                        isEditing && "cursor-pointer hover:scale-105"
                      )}
                      style={{
                        width: `${dimensions.cardWidth}px`,
                        height: `${dimensions.cardHeight}px`,
                        maxWidth: "100%",
                        maxHeight: "100%",
                      }}
                      onClick={() =>
                        isEditing &&
                        onPositionClick?.(actualRow, actualCol, currentPage)
                      }
                    >
                      <img
                        alt="Reverso de carta"
                        className="w-full h-full object-cover transition-opacity duration-300 opacity-80 hover:opacity-100"
                        loading="lazy"
                        src="/assets/images/backcard.webp"
                      />

                      {/* Indicador visual de que es un backcard */}
                    </div>
                  </div>
                ) : isEditing ? (
                  <div
                    className={cn(
                      "flex items-center justify-center h-full text-slate-400 border-2 rounded-md transition-all cursor-pointer",
                      isDropTarget &&
                        "border-blue-500 bg-blue-100 ring-2 ring-blue-300",
                      isAvailableForPlacement &&
                        "border-green-400 bg-green-50 ring-2 ring-green-300 hover:border-green-500",
                      canReplaceCard &&
                        "ring-2 ring-orange-300 hover:ring-orange-400",
                      !isDropTarget &&
                        !isAvailableForPlacement &&
                        !canReplaceCard &&
                        "border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    )}
                    style={{
                      width: `${dimensions.cardWidth}px`,
                      height: `${dimensions.cardHeight}px`,
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                    onClick={() =>
                      onPositionClick?.(actualRow, actualCol, currentPage)
                    }
                    {...(onDragHandlers
                      ? {
                          onDragOver: onDragHandlers.onDragOver,
                          onDragEnter: (e) =>
                            onDragHandlers.onDragEnter(
                              e,
                              currentPage,
                              actualRow,
                              actualCol
                            ),
                          onDragLeave: onDragHandlers.onDragLeave,
                          onDrop: (e) =>
                            onDragHandlers.onDrop(
                              e,
                              currentPage,
                              actualRow,
                              actualCol
                            ),
                        }
                      : {})}
                  >
                    <div className="text-center">
                      {selectedCardForPlacement ? (
                        <>
                          <Plus className="h-8 w-8 mx-auto mb-1 text-green-500" />
                          <div className="text-xs text-green-600 font-medium">
                            Colocar aquí
                          </div>
                        </>
                      ) : (
                        <>
                          <Plus className="h-6 w-6 mx-auto mb-1" />
                          <div className="text-xs">
                            {actualRow},{actualCol}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-600 rounded-md">
                    <div className="text-center">
                      <div className="text-xs opacity-50">
                        {actualRow}-{actualCol}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
