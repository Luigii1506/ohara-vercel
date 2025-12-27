"use client";

import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CardWithCollectionData } from "@/types";
import LazyImage from "@/components/LazyImage";
import { smartPrefetch } from "@/lib/imageOptimization";

interface VirtualizedCardGridProps {
  cards: Array<{
    card: CardWithCollectionData;
    filteredAlts: CardWithCollectionData[];
    isBaseMatch: boolean;
    baseCardIndex: number;
    cardIndex: number;
  }>;
  onCardClick: (card: CardWithCollectionData, base: CardWithCollectionData) => void;
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
  const rowHeight = useMemo(() => {
    if (containerWidth === 0) return 150;
    const gap = 8; // gap-2 = 8px
    const cardWidth = (containerWidth - gap * (columns - 1)) / columns;
    // aspect-[2.5/3.5] means width/height = 2.5/3.5, so height = width * (3.5/2.5) = width * 1.4
    const cardHeight = cardWidth * 1.4;
    return Math.ceil(cardHeight + gap);
  }, [containerWidth, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 extra rows above/below for smooth scrolling
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  // Infinite scroll: fetch more when approaching the end
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;

    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    if (!lastVirtualRow) return;

    // If the last visible row is within 5 rows of the end, fetch more
    const isNearEnd = lastVirtualRow.index >= rows.length - 5;

    if (isNearEnd) {
      fetchNextPage();
    }
  }, [virtualRows, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render individual card
  const renderCard = useCallback(
    (item: FlatCardItem) => {
      const { card, baseCard, globalIndex } = item;
      const priceValue = getCardPriceValue(card);

      return (
        <div
          key={card._id || card.id}
          onClick={() => onCardClick(card, baseCard)}
          onMouseEnter={() => card.src && smartPrefetch(card.src, "large", true)}
          onTouchStart={() => {
            card.src && smartPrefetch(card.src, "large", true);
            setTouchedCardId(card.id);
          }}
          onTouchEnd={() => setTouchedCardId(null)}
          onTouchCancel={() => setTouchedCardId(null)}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full cursor-pointer max-w-[450px]"
        >
          <div className="border rounded-lg shadow bg-white justify-center items-center flex flex-col relative">
            <LazyImage
              src={card.src}
              fallbackSrc="/assets/images/backcard.webp"
              alt={card.name}
              className="w-full"
              priority={globalIndex < priorityLimit}
              size={imageSize}
            />

            {/* Code Badge - Top left */}
            {baseCard.code && (
              <div
                className={`absolute top-0 left-0 bg-black text-white rounded-tl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10 transition-all duration-300 ease-in-out ${
                  isDesktop
                    ? "opacity-100 translate-y-0"
                    : touchedCardId === card.id
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2 pointer-events-none"
                }`}
              >
                {baseCard.code}
              </div>
            )}

            {/* Price Badge - Bottom left */}
            {priceValue !== null && (
              <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
                {formatCurrency(priceValue, card.priceCurrency)}
              </div>
            )}
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
      touchedCardId,
      setTouchedCardId,
      isDesktop,
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
