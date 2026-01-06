"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CardWithCollectionData } from "@/types";
import LazyImage from "@/components/LazyImage";
import { smartPrefetch } from "@/lib/imageOptimization";
import { Plus, Check } from "lucide-react";

interface VirtualizedCardGridProps {
  cards: Array<{
    card: CardWithCollectionData;
    filteredAlts: CardWithCollectionData[];
    isBaseMatch: boolean;
    baseCardIndex: number;
    cardIndex: number;
  }>;
  onCardClick: (
    card: CardWithCollectionData,
    base: CardWithCollectionData
  ) => void;
  imageSize: "thumb" | "small";
  priorityLimit: number;
  formatCurrency: (value: number, currency?: string | null) => string;
  getCardPriceValue: (card: CardWithCollectionData) => number | null;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  touchedCardId: number | string | null;
  setTouchedCardId: (id: number | string | null) => void;
  isDesktop: boolean;
  // Infinite scroll props
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  // Collection props
  collectionCardIds?: Map<string, number>;
  addingToCollection?: Set<string>;
  onAddToCollection?: (cardId: string, e: React.MouseEvent) => void;
}

// Flatten cards data into individual card items for virtualization
interface FlatCardItem {
  card: CardWithCollectionData;
  baseCard: CardWithCollectionData;
  globalIndex: number;
  isAlternate: boolean;
}

const VirtualizedCardGrid: React.FC<VirtualizedCardGridProps> = ({
  cards,
  onCardClick,
  imageSize,
  priorityLimit,
  formatCurrency,
  getCardPriceValue,
  scrollContainerRef,
  touchedCardId,
  setTouchedCardId,
  isDesktop,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  collectionCardIds,
  addingToCollection,
  onAddToCollection,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  // Measure container width for column calculation
  useEffect(() => {
    const updateWidth = () => {
      if (measureRef.current) {
        setContainerWidth(measureRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate columns based on container width (mobile: 3 cols, sm: 4 cols)
  const columns = useMemo(() => {
    if (containerWidth === 0) return 3;
    // Approximate breakpoints: sm = 640px
    return containerWidth >= 640 ? 4 : 3;
  }, [containerWidth]);

  // Flatten all cards into a single array
  const flatCards = useMemo<FlatCardItem[]>(() => {
    const result: FlatCardItem[] = [];
    let globalIndex = 0;

    cards.forEach(({ card, filteredAlts, isBaseMatch }) => {
      if (isBaseMatch) {
        result.push({
          card,
          baseCard: card,
          globalIndex: globalIndex++,
          isAlternate: false,
        });
      }

      filteredAlts.forEach((alt) => {
        result.push({
          card: alt,
          baseCard: card,
          globalIndex: globalIndex++,
          isAlternate: true,
        });
      });
    });

    return result;
  }, [cards]);

  // Group flat cards into rows
  const rows = useMemo(() => {
    const result: FlatCardItem[][] = [];
    for (let i = 0; i < flatCards.length; i += columns) {
      result.push(flatCards.slice(i, i + columns));
    }
    return result;
  }, [flatCards, columns]);

  // Calculate row height based on card aspect ratio and gaps
  // Card aspect ratio is 2.5/3.5 = 0.714, so height = width * 1.4
  // Plus info section height (~44px for stacked code/price)
  const rowHeight = useMemo(() => {
    if (containerWidth === 0) return 200;
    const gap = 8; // gap-2 = 8px
    const cardWidth = (containerWidth - gap * (columns - 1)) / columns;
    // aspect-[2.5/3.5] means width/height = 2.5/3.5, so height = width * (3.5/2.5) = width * 1.4
    const imageHeight = cardWidth * 1.4;
    const infoSectionHeight = 44; // px-2 py-1.5 with stacked text-xs lines
    const cardHeight = imageHeight + infoSectionHeight;
    return Math.ceil(cardHeight + gap);
  }, [containerWidth, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 extra rows above/below for smooth scrolling
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastFetchTriggerRef = useRef<number | null>(null);

  // Infinite scroll: fetch more when approaching the end
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;

    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    if (!lastVirtualRow) return;

    // If the last visible row is within 5 rows of the end, fetch more
    const isNearEnd = lastVirtualRow.index >= rows.length - 5;
    if (!isNearEnd) return;

    if (lastFetchTriggerRef.current === lastVirtualRow.index) return;
    lastFetchTriggerRef.current = lastVirtualRow.index;
    fetchNextPage();
  }, [
    virtualRows,
    rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Render individual card
  const renderCard = useCallback(
    (item: FlatCardItem) => {
      const { card, baseCard, globalIndex } = item;
      const priceValue = getCardPriceValue(card);
      const priceText =
        priceValue !== null
          ? formatCurrency(priceValue, card.priceCurrency)
          : "0";

      const cardKey = String(card.id);
      const isInCollection = collectionCardIds?.has(cardKey);
      const collectionQty = collectionCardIds?.get(cardKey);
      const isAdding = addingToCollection?.has(cardKey);

      return (
        <div
          key={card._id || card.id}
          onClick={() => onCardClick(card, baseCard)}
          onMouseEnter={() =>
            card.src && smartPrefetch(card.src, "large", true)
          }
          onTouchStart={() => {
            card.src && smartPrefetch(card.src, "large", true);
            setTouchedCardId(card.id);
          }}
          onTouchEnd={() => setTouchedCardId(null)}
          onTouchCancel={() => setTouchedCardId(null)}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full cursor-pointer max-w-[450px]"
        >
          <div className="border rounded-lg shadow bg-white justify-center items-center flex flex-col overflow-hidden">
            <div className="relative w-full">
              <LazyImage
                src={card.src}
                fallbackSrc="/assets/images/backcard.webp"
                alt={card.name}
                className="w-full"
                priority={globalIndex < priorityLimit}
                size={imageSize}
              />
              {/* Collection toggle button  aqui*/}
              {onAddToCollection && (
                <button
                  onClick={(e) => onAddToCollection(String(card.id), e)}
                  className={`absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 shadow-md ${
                    isInCollection
                      ? "bg-emerald-500 text-white"
                      : "bg-black/50 text-white/90 active:scale-90"
                  }`}
                >
                  {isInCollection ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Info section - Code and Price (stacked, centered) */}
            <div className="w-full px-2 py-2 flex flex-col items-center justify-center text-center flex-1">
              {baseCard.code && (
                <span className="text-xs font-bold text-gray-800 truncate max-w-full leading-tight">
                  {baseCard.code}
                </span>
              )}
              <span
                className={`text-xs font-semibold leading-tight ${
                  priceValue !== null ? "text-emerald-600" : "text-transparent"
                }`}
              >
                {priceText}
              </span>
            </div>
          </div>
        </div>
      );
    },
    [
      onCardClick,
      imageSize,
      priorityLimit,
      formatCurrency,
      getCardPriceValue,
      setTouchedCardId,
      collectionCardIds,
      addingToCollection,
      onAddToCollection,
    ]
  );

  return (
    <div ref={measureRef} className="w-full">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowCards = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid gap-2 pb-2"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                }}
              >
                {rowCards.map((item) => renderCard(item))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualizedCardGrid;
