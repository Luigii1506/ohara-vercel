"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { Eye, Minus, Plus } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { smartPrefetch } from "@/lib/imageOptimization";

interface CardWithBadgesProps {
  id: number | string;
  src: string;
  alt: string;
  code?: string;
  price?: number | null;
  priceCurrency?: string | null;
  onClick?: () => void;
  onInfoClick?: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  onMouseEnter?: () => void;
  priority?: boolean;
  size?: "thumb" | "small" | "medium" | "large";
  className?: string;
  disabled?: boolean;
  quantityInDeck?: number;
  maxQuantity?: number;
  children?: ReactNode;
  // Touch state can be managed externally for performance with many cards
  touchedCardId?: number | string | null;
  onTouchStart?: (id: number | string) => void;
  onTouchEnd?: () => void;
  // If true, always show the code badge
  alwaysShowCode?: boolean;
  // Show controls (info button, quantity bar)
  showControls?: boolean;
}

// Helper functions for price formatting
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

const CardWithBadges: React.FC<CardWithBadgesProps> = ({
  id,
  src,
  alt,
  code,
  price,
  priceCurrency,
  onClick,
  onInfoClick,
  onAdd,
  onRemove,
  onMouseEnter,
  priority = false,
  size = "small",
  className = "",
  disabled = false,
  quantityInDeck = 0,
  maxQuantity = 4,
  children,
  touchedCardId,
  onTouchStart,
  onTouchEnd,
  alwaysShowCode = false,
  showControls = false,
}) => {
  // Detect desktop for hover behavior
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return false;
  });

  // Internal touch state if not managed externally
  const [internalTouchedId, setInternalTouchedId] = useState<number | string | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // Use external touch state if provided, otherwise use internal
  const isTouched = touchedCardId !== undefined
    ? touchedCardId === id
    : internalTouchedId === id;

  const handleTouchStart = () => {
    if (src) smartPrefetch(src, "large", true);
    if (onTouchStart) {
      onTouchStart(id);
    } else {
      setInternalTouchedId(id);
    }
  };

  const handleTouchEnd = () => {
    if (onTouchEnd) {
      onTouchEnd();
    } else {
      setInternalTouchedId(null);
    }
  };

  const handleMouseEnter = () => {
    if (src) smartPrefetch(src, "large", true);
    onMouseEnter?.();
  };

  const handleInfoClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onInfoClick?.();
  };

  const handleRemove = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRemove?.();
  };

  const handleAdd = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAdd?.();
  };

  const priceValue = getNumericPrice(price);
  const showCodeBadge = alwaysShowCode || isDesktop || isTouched;
  const hasQuantity = quantityInDeck > 0;
  const canAdd = quantityInDeck < maxQuantity && !disabled;

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 ${
        disabled ? "opacity-70 grayscale" : ""
      } ${className}`}
    >
      <div className="border rounded-lg shadow bg-white justify-center items-center flex flex-col">
        <div className="relative w-full overflow-hidden rounded-t-lg">
          <LazyImage
            src={src}
            fallbackSrc="/assets/images/backcard.webp"
            alt={alt}
            className="w-full"
            priority={priority}
            size={size}
          />

          {/* Code Badge - Top left corner */}
          {code && (
            <div
              className={`absolute top-0 left-0 bg-black text-white rounded-tl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10 transition-all duration-300 ease-in-out ${
                showCodeBadge
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {code}
            </div>
          )}

          {/* Info button - Always visible when showControls */}
          {showControls && onInfoClick && (
            <button
              onClick={handleInfoClick}
              onTouchEnd={handleInfoClick}
              className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-md rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
              aria-label="View card details"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Price Badge - Bottom left corner */}
          {priceValue !== null && (
            <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-md px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
              {formatCurrency(priceValue, priceCurrency)}
            </div>
          )}

          {/* Quantity Badge - Only shown when no controls */}
          {!showControls && quantityInDeck > 0 && (
            <div className="absolute top-0 right-0 bg-black text-white rounded-tr-md rounded-bl-lg min-w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg z-10">
              x{quantityInDeck}
            </div>
          )}
        </div>

        {/* Quantity Control Bar - Below image when has quantity and showControls */}
        {showControls && hasQuantity && (
          <div className="w-full px-2 pb-2 pt-2">
            <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
              {/* Remove button */}
              <button
                onClick={handleRemove}
                onTouchEnd={handleRemove}
                className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                aria-label="Remove one"
              >
                <Minus className="h-4 w-4" />
              </button>

              {/* Quantity display */}
              <div className="flex items-center justify-center">
                <span className="text-white font-bold text-base">
                  {quantityInDeck}
                </span>
                <span className="text-white/60 text-xs ml-1">
                  /{maxQuantity}
                </span>
              </div>

              {/* Add button */}
              <button
                onClick={handleAdd}
                onTouchEnd={handleAdd}
                disabled={!canAdd}
                className={`h-7 w-7 rounded-md flex items-center justify-center active:scale-95 transition-all ${
                  canAdd
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
                aria-label="Add one"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Additional content */}
        {children}
      </div>
    </div>
  );
};

export default CardWithBadges;
