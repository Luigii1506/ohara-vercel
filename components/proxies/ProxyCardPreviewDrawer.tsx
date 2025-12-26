"use client";

import React from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { Oswald } from "next/font/google";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import { getColors } from "@/helpers/functions";
import BaseDrawer from "@/components/ui/BaseDrawer";
import CardDetails from "@/components/CardDetails";
import { DeckCard, CardWithCollectionData } from "@/types";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface ProxyCardPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  card: DeckCard | null;
  fullCard?: CardWithCollectionData | null;
  onQuantityChange: (cardId: number, newQuantity: number) => void;
  onRemove: (cardId: number) => void;
}

const ProxyCardPreviewDrawer: React.FC<ProxyCardPreviewDrawerProps> = ({
  isOpen,
  onClose,
  card,
  fullCard,
  onQuantityChange,
  onRemove,
}) => {
  if (!card) return null;

  const colors = card.colors || [];

  const handleDecrement = () => {
    if (card.quantity > 1) {
      onQuantityChange(card.cardId, card.quantity - 1);
    } else {
      onRemove(card.cardId);
      onClose();
    }
  };

  const handleIncrement = () => {
    onQuantityChange(card.cardId, card.quantity + 1);
  };

  const handleRemove = () => {
    onRemove(card.cardId);
    onClose();
  };

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="92vh"
      desktopModal
      desktopMaxWidth="max-w-lg"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Code, Rarity, Category */}
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <span
                className={`${oswald.className} font-medium text-slate-700`}
              >
                {card.code}
              </span>
              <span className="text-slate-300">•</span>
              <span>{card.rarity}</span>
              <span className="text-slate-300">•</span>
              <span>{card.category}</span>
            </div>
            {/* Name */}
            <h2 className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">
              {card.name}
            </h2>
            {/* Set */}
            {card.set && (
              <p className="text-xs text-slate-500 mt-0.5">{card.set}</p>
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
        {/* Card Image with Color Border */}
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
              <img
                src={getOptimizedImageUrl(card.src, "medium")}
                alt={card.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div className="px-4 py-4">
          {fullCard ? (
            <CardDetails card={fullCard} searchTerm="" isTextOnly={false} />
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              {card.cost && (
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Cost
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {card.cost}
                  </p>
                </div>
              )}
              {card.power && (
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Power
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {card.power}
                  </p>
                </div>
              )}
              {card.counter && (
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Counter
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {card.counter}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleDecrement}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-red-500/25 transition hover:from-rose-600 hover:to-red-600 active:scale-95"
          >
            <Minus className="h-6 w-6" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">
              {card.quantity}
            </span>
            <span className="text-xs text-slate-500">copies</span>
          </div>

          <button
            onClick={handleIncrement}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-green-500/25 transition hover:from-emerald-600 hover:to-green-600 active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <button
          onClick={handleRemove}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
          Remove from proxies
        </button>
      </div> */}
    </BaseDrawer>
  );
};

export default ProxyCardPreviewDrawer;
