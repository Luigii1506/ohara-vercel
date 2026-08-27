import React from "react";
import { Plus, Check, DollarSign, ExternalLink, Tag, Move, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardWithCollectionData } from "@/types";
import { GridCard, FolderDimensions } from "./types";
import { convertForListDisplay } from "@/lib/lists/currency";

interface CardGridProps {
  cards: GridCard[][];
  dimensions: FolderDimensions;
  currentPage: number;
  maxRows: number;
  maxColumns: number;
  isEditing?: boolean;
  /** Moneda de despliegue de la carpeta (ej. "MXN") y su tipo de cambio fijo. */
  displayCurrency?: string | null;
  exchangeRate?: number | string | null;
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
  /** Arrastre de una carta YA colocada (para moverla a otra casilla). */
  onCardDragStart?: (
    e: React.DragEvent,
    card: CardWithCollectionData,
    position: { page: number; row: number; column: number }
  ) => void;
  dragOverPosition?: { page: number; row: number; column: number } | null;
  /** IDs de cartas actualmente "levantadas" para mover (selección múltiple). */
  movingCardIds?: Set<string>;
  canEditPrice?: boolean;
  onEditPrice?: (entry: { card: CardWithCollectionData; listCard: any }) => void;
  onToggleSold?: (entry: { card: CardWithCollectionData; listCard: any }) => void;
  /** Botón "mover": agrega/quita esta carta de la selección múltiple. */
  onToggleMove?: (entry: { card: CardWithCollectionData; listCard: any }) => void;
  /** Campo de precio a mostrar en la esquina (por defecto marketPrice). */
  priceField?: "marketPrice" | "midPrice";
  /** Quita el backcard (reverso genérico o sleeve) de una casilla, sin abrir el modal. */
  onRemoveBackcard?: (position: {
    page: number;
    row: number;
    column: number;
  }) => void;
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
  onCardDragStart,
  dragOverPosition,
  movingCardIds,
  canEditPrice = false,
  onEditPrice,
  onToggleSold,
  onToggleMove,
  priceField = "marketPrice",
  displayCurrency,
  exchangeRate,
  onRemoveBackcard,
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

          const hasCardsToMove = (movingCardIds?.size ?? 0) > 0;
          const isAvailableForPlacement = hasCardsToMove && !cell && isEditing;
          const canReplaceCard = hasCardsToMove && cell && isEditing;

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
                          ? "cursor-pointer hover:scale-105 active:cursor-grabbing"
                          : "cursor-grab"
                      )}
                      style={{
                        width: `${dimensions.cardWidth}px`,
                        height: `${dimensions.cardHeight}px`,
                        maxWidth: "100%",
                        maxHeight: "100%",
                      }}
                      draggable={isEditing && !!onCardDragStart}
                      onDragStart={(e) =>
                        onCardDragStart?.(e, cell.card!, {
                          page: currentPage,
                          row: actualRow,
                          column: actualCol,
                        })
                      }
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
                          // Si hay cartas "levantadas" para mover, este toque
                          // completa el movimiento (mueve/intercambia/acomoda)
                          // en vez de abrir el visor de imagen.
                          if (isEditing && hasCardsToMove) {
                            onPositionClick?.(actualRow, actualCol, currentPage);
                            return;
                          }
                          if (onCardClick && cell.card) {
                            onCardClick(cell.card);
                          }
                        }}
                      >
                        <img
                          alt={cell.card.name}
                          className={cn(
                            "w-full h-full object-cover transition-opacity duration-300 opacity-100",
                            cell.existing?.isSold && "grayscale opacity-50"
                          )}
                          loading="lazy"
                          src={cell.card.src}
                        />
                      </div>

                      {/* Vendida - Cinta diagonal, visible en cualquier vista */}
                      {cell.existing?.isSold && (
                        <div className="pointer-events-none absolute inset-x-[-15%] top-[38%] z-10 -rotate-[18deg] bg-slate-900/85 py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-md">
                          Vendida
                        </div>
                      )}

                      {/* Consignatario - a quién le pertenece esta carta dentro de la carpeta */}
                      {cell.existing?.consignor && (
                        <div
                          className="pointer-events-none absolute top-1 left-1 z-10 flex max-w-[85%] items-center gap-1 truncate rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md"
                          title={cell.existing.consignor.name}
                        >
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: cell.existing.consignor.color || "#a78bfa" }}
                          />
                          <span className="truncate">{cell.existing.consignor.name}</span>
                        </div>
                      )}

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

                        const formatCurrency = (value: number, currency?: string | null) => {
                          const sourceCurrency = currency || "USD";
                          const { value: displayValue, currency: displayCurrencyCode } =
                            sourceCurrency === "USD"
                              ? convertForListDisplay(value, {
                                  displayCurrency,
                                  exchangeRate,
                                })
                              : { value, currency: sourceCurrency };

                          return new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: displayCurrencyCode,
                            minimumFractionDigits: 2,
                          }).format(displayValue);
                        };

                        const customPriceValue = getNumericPrice(cell.existing?.customPrice);
                        // Si la carta no tiene el precio preferido (ej. midPrice
                        // sin poblar aún), caemos al otro campo de precio en vez
                        // de dejar el badge en blanco.
                        const fallbackPriceField =
                          priceField === "midPrice" ? "marketPrice" : "midPrice";
                        const priceValue =
                          customPriceValue ??
                          getNumericPrice((cell.card as any)[priceField]) ??
                          getNumericPrice((cell.card as any)[fallbackPriceField]);
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
                          {canEditPrice &&
                            cell.existing &&
                            !cell.existing.isOptimistic &&
                            onToggleSold && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleSold({ card: cell.card!, listCard: cell.existing });
                              }}
                              className={cn(
                                "absolute bottom-2 left-2 w-8 h-8 flex items-center justify-center text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                cell.existing?.isSold
                                  ? "bg-slate-500 hover:bg-slate-600"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              )}
                              title={
                                cell.existing?.isSold
                                  ? "Marcar como disponible"
                                  : "Marcar como vendida"
                              }
                            >
                              <Tag className="h-4 w-4" />
                            </button>
                          )}
                          {/* Ir a TCGplayer (lado derecho) — si la carta está linkeada. */}
                          {cell.card?.tcgUrl && (
                            <a
                              href={cell.card.tcgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Ver en TCGplayer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
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
                          {/* Mover: agrega/quita la carta de la selección para
                              moverla (tap-to-move, funciona igual en mobile
                              que arrastrando con mouse; admite varias). */}
                          {canEditPrice &&
                            cell.existing &&
                            !cell.existing.isOptimistic &&
                            onToggleMove && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleMove({ card: cell.card!, listCard: cell.existing });
                              }}
                              className={cn(
                                "absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center text-white rounded-full shadow-lg transition-opacity duration-200",
                                // Comparar por el id de la FILA (cell.existing.id), no por el id
                                // de catálogo (cell.card.id): la misma carta puede repetirse en
                                // varias celdas, y comparar por catálogo resaltaría todas a la vez.
                                movingCardIds?.has(String(cell.existing?.id ?? ""))
                                  ? "bg-indigo-700 opacity-100"
                                  : "bg-indigo-500 hover:bg-indigo-600 opacity-0 group-hover:opacity-100"
                              )}
                              title="Agregar/quitar de la selección para mover"
                            >
                              <Move className="h-4 w-4" />
                            </button>
                          )}
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
                        src={cell.backcardImageUrl || "/assets/images/backcard.webp"}
                      />

                      {isEditing && onRemoveBackcard && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveBackcard({
                              page: currentPage,
                              row: actualRow,
                              column: actualCol,
                            });
                          }}
                          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-white rounded-full shadow-lg bg-red-500 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          title={
                            cell.backcardImageUrl
                              ? "Quitar sleeve"
                              : "Quitar reverso de carta"
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
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
                      {hasCardsToMove ? (
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
