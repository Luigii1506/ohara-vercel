"use client";

import React, { useState, useRef, useCallback } from "react";
import { X, ZoomIn, Gavel, ChevronDown } from "lucide-react";
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
  /** Base card for alternates - used for rulings, effects, and base info */
  baseCard?: CardWithCollectionData | null;
  onQuantityChange: (cardId: number, newQuantity: number) => void;
  onRemove: (cardId: number) => void;
}

const ProxyCardPreviewDrawer: React.FC<ProxyCardPreviewDrawerProps> = ({
  isOpen,
  onClose,
  card,
  fullCard,
  baseCard,
  onQuantityChange,
  onRemove,
}) => {
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [isRulingsExpanded, setIsRulingsExpanded] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // For alternates: use baseCard for rulings, effects, and card info
  // For regular cards: baseCard and fullCard are the same (or baseCard is null)
  const infoCard = baseCard || fullCard;
  const rulings = infoCard?.rulings || [];
  const hasRulings = rulings.length > 0;

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate tilt based on cursor position relative to center
    const tiltX = ((clientY - centerY) / (rect.height / 2)) * -15;
    const tiltY = ((clientX - centerX) / (rect.width / 2)) * 15;

    // Calculate glare position (0-100%)
    const glareX = ((clientX - rect.left) / rect.width) * 100;
    const glareY = ((clientY - rect.top) / rect.height) * 100;

    setTilt({ x: tiltX, y: tiltY });
    setGlarePosition({ x: glareX, y: glareY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        // Don't preventDefault - let touchAction: "none" on the element handle it
        // This allows scrolling elsewhere in the drawer
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
  }, []);

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
    <>
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
          style={{
            maxHeight: "calc(92vh - 100px)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Card Image with 3D Tilt Effect */}
          <div className="p-4 flex justify-center bg-gradient-to-b from-slate-100 to-slate-50">
            <div
              ref={cardRef}
              className="relative cursor-pointer"
              style={{ perspective: "1000px", touchAction: "none" }}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              onTouchMove={handleTouchMove}
              onTouchStart={handleEnter}
              onTouchEnd={handleLeave}
              onClick={() => setShowLargeImage(true)}
            >
              {/* Floating Animation Wrapper */}
              <div
                className={!isHovering ? "animate-card-float" : ""}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Card Container with Tilt */}
                <div
                  className="relative transition-transform duration-150 ease-out"
                  style={{
                    transform: isHovering
                      ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
                      : "rotateX(0deg) rotateY(0deg) scale(1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* Color Border */}
                  <div
                    className="rounded-2xl p-1.5"
                    style={{
                      background:
                        colors.length === 2
                          ? `linear-gradient(135deg, ${getColors(
                              colors[0].color
                            )} 0%, ${getColors(colors[1].color)} 100%)`
                          : colors.length > 0
                          ? getColors(colors[0].color)
                          : "#e2e8f0",
                      boxShadow: isHovering
                        ? `0 25px 50px -12px rgba(0, 0, 0, 0.4),
                           0 0 30px ${
                             colors.length > 0
                               ? getColors(colors[0].color) + "40"
                               : "rgba(148, 163, 184, 0.4)"
                           }`
                        : `0 20px 40px -10px rgba(0, 0, 0, 0.25),
                           0 0 20px ${
                             colors.length > 0
                               ? getColors(colors[0].color) + "30"
                               : "rgba(148, 163, 184, 0.3)"
                           }`,
                      transition: "box-shadow 0.3s ease",
                    }}
                  >
                    {/* Card Image Container */}
                    <div className="relative w-52 sm:w-60 aspect-[2.5/3.5] rounded-xl overflow-hidden bg-white">
                      <img
                        src={getOptimizedImageUrl(card.src, "medium")}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />

                      {/* Glare/Shine Effect */}
                      <div
                        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                        style={{
                          opacity: isHovering ? 0.6 : 0,
                          background: `radial-gradient(
                            circle at ${glarePosition.x}% ${glarePosition.y}%,
                            rgba(255, 255, 255, 0.8) 0%,
                            rgba(255, 255, 255, 0.4) 20%,
                            transparent 60%
                          )`,
                        }}
                      />

                      {/* Holographic Rainbow Effect */}
                      <div
                        className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-color-dodge"
                        style={{
                          opacity: isHovering ? 0.15 : 0,
                          background: `linear-gradient(
                            ${45 + tilt.y * 2}deg,
                            rgba(255, 0, 0, 0.5) 0%,
                            rgba(255, 154, 0, 0.5) 10%,
                            rgba(208, 222, 33, 0.5) 20%,
                            rgba(79, 220, 74, 0.5) 30%,
                            rgba(63, 218, 216, 0.5) 40%,
                            rgba(47, 201, 226, 0.5) 50%,
                            rgba(28, 127, 238, 0.5) 60%,
                            rgba(95, 21, 242, 0.5) 70%,
                            rgba(186, 12, 248, 0.5) 80%,
                            rgba(251, 7, 217, 0.5) 90%,
                            rgba(255, 0, 0, 0.5) 100%
                          )`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Zoom Hint */}
                  <div
                    className={`absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-opacity duration-200 ${
                      isHovering ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <ZoomIn className="h-3 w-3" />
                    <span>Tap to zoom</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Details - Use infoCard (baseCard for alternates) for effects/texts */}
          <div className="px-4 py-4">
            {infoCard ? (
              <CardDetails card={infoCard} searchTerm="" isTextOnly={false} />
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

          {/* Rulings Section - Elegant expandable */}
          {hasRulings && (
            <div className="px-4 pb-4">
              <button
                onClick={() => setIsRulingsExpanded(!isRulingsExpanded)}
                className="w-full group"
              >
                <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200/60 px-4 py-3 transition-all hover:border-amber-300 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                      <Gavel className="h-5 w-5" />
                    </div>
                    <div className="text-left flex flex-col">
                      <p className="font-semibold text-slate-800">
                        Official Rulings
                      </p>
                      <p className="text-xs text-amber-700">
                        {rulings.length} Q&A{rulings.length > 1 ? "s" : ""}{" "}
                        available
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition-transform duration-300 ${
                      isRulingsExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </button>

              {/* Expandable Rulings Content */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  isRulingsExpanded
                    ? "max-h-[2000px] opacity-100 mt-3"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3">
                  {rulings.map((ruling, index) => (
                    <div
                      key={ruling.id || index}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      {/* Question */}
                      <div className="flex gap-3 mb-3">
                        <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                          Q
                        </span>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {ruling.question}
                        </p>
                      </div>
                      {/* Answer */}
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                          A
                        </span>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {ruling.answer}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </BaseDrawer>

      {/* Large Image Overlay */}
      {showLargeImage && card && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[9999] px-5 cursor-pointer"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-md pointer-events-none animate-in zoom-in-95 fade-in duration-200">
            <div className="text-white/80 text-sm font-medium text-center py-3">
              Tap anywhere to close
            </div>
            <div className="flex flex-col items-center gap-4">
              <img
                src={getOptimizedImageUrl(card.src, "large")}
                className="max-w-full max-h-[calc(100dvh-150px)] object-contain rounded-lg shadow-2xl"
                alt={card.name}
              />
              <div className="text-white text-center">
                <span className={`${oswald.className} font-medium text-lg`}>
                  {card.code}
                </span>
                {card.set && (
                  <p className="text-white/70 text-sm mt-1">{card.set}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProxyCardPreviewDrawer;
