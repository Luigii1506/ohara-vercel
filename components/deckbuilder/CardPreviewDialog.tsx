"use client";

import React from "react";
import { X } from "lucide-react";
import { CardWithCollectionData } from "@/types";
import { Oswald } from "next/font/google";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { getColors } from "@/helpers/functions";
import BaseDrawer from "@/components/ui/BaseDrawer";
import CardDetails from "@/components/CardDetails";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

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

interface CardPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardWithCollectionData | null;
  baseCard?: CardWithCollectionData | null;
  currentQuantity?: number;
}

const CardPreviewDialog: React.FC<CardPreviewDialogProps> = ({
  isOpen,
  onClose,
  card,
  baseCard,
  currentQuantity = 0,
}) => {
  // For alternates: use card for image/price/set, baseCard for effect/texts/types
  // For regular cards: card and baseCard are the same
  const altCard = card || baseCard;
  const infoCard = baseCard || card;

  if (!altCard || !infoCard) return null;

  const priceValue = getNumericPrice(altCard.marketPrice);

  // Get colors for gradient (from base card)
  const colors = infoCard.colors || [];

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="92vh"
      desktopModal
      desktopMaxWidth="max-w-lg"
    >
      {/* Header - Use base card info */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Code, Rarity, Category */}
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <span
                className={`${oswald.className} font-medium text-slate-700`}
              >
                {infoCard.code}
              </span>
              <span className="text-slate-300">•</span>
              <span>{infoCard.rarity}</span>
              <span className="text-slate-300">•</span>
              <span>{infoCard.category}</span>
            </div>
            {/* Name */}
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {infoCard.name}
            </h2>
            {/* Types - from base card */}
            {infoCard.types && infoCard.types.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {infoCard.types
                  .map((t: { type: string }) => t.type)
                  .join(" / ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="overflow-y-auto flex-1 pb-4"
        style={{ maxHeight: "calc(92vh - 100px)" }}
      >
        {/* Card Image with Color Border and Badges */}
        <div className="p-4 flex justify-center bg-slate-50">
          <div
            className="relative rounded-2xl p-1 shadow-lg"
            style={{
              background:
                colors.length === 2
                  ? `linear-gradient(135deg, ${getColors(
                      colors[0].color
                    )} 0%, ${getColors(colors[1].color)} 100%)`
                  : colors.length > 0
                  ? getColors(colors[0].color)
                  : "#e2e8f0",
            }}
          >
            <div className="relative w-48 sm:w-56 aspect-[3/4.2] rounded-xl overflow-hidden bg-white">
              {/* Image from alternate card */}
              <img
                src={getOptimizedImageUrl(altCard.src, "medium")}
                alt={infoCard.name}
                className="w-full h-full object-cover"
              />

              {/* Quantity Badge - Top Right (like CardWithBadges) */}
              {currentQuantity > 0 && (
                <div className="absolute top-0 right-0 bg-black text-white rounded-tr-xl rounded-bl-lg min-w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg z-10">
                  x{currentQuantity}
                </div>
              )}

              {/* Price Badge - Bottom Left - from alternate card */}
              {priceValue && (
                <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-xl px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-10">
                  {formatCurrency(priceValue, altCard.priceCurrency)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Info Section - Using base card for effect/texts */}
        <div className="mx-4 my-3">
          <CardDetails
            card={infoCard}
            searchTerm=""
            isModal={false}
            isTextOnly={false}
          />

          {/* Set Info - from alternate card */}
          {/* {altCard.sets && altCard.sets.length > 0 && (
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-500">
                {(altCard.sets[0] as { set?: { title?: string } })?.set?.title}
              </p>
            </div>
          )} */}
        </div>
      </div>
    </BaseDrawer>
  );
};

export default CardPreviewDialog;
