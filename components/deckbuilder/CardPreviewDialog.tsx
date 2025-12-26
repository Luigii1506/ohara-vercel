"use client";

import React, { useState, useRef, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";
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
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
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
    },
    []
  );

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

  // For alternates: use card for image/price/set, baseCard for effect/texts/types
  // For regular cards: card and baseCard are the same
  const altCard = card || baseCard;
  const infoCard = baseCard || card;

  if (!altCard || !infoCard) return null;

  const priceValue = getNumericPrice(altCard.marketPrice);

  // Get colors for gradient (from base card)
  const colors = infoCard.colors || [];

  return (
    <>
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
          style={{ maxHeight: "calc(92vh - 100px)", WebkitOverflowScrolling: "touch" }}
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
                  className="rounded-2xl p-1.5 shadow-xl"
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
                      : "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                    transition: "box-shadow 0.3s ease",
                  }}
                >
                  {/* Card Image Container */}
                  <div className="relative w-52 sm:w-60 aspect-[2.5/3.5] rounded-xl overflow-hidden bg-white">
                    {/* Image from alternate card */}
                    <img
                      src={getOptimizedImageUrl(altCard.src, "medium")}
                      alt={infoCard.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />

                    {/* Quantity Badge - Top Right */}
                    {currentQuantity > 0 && (
                      <div className="absolute top-0 right-0 bg-black text-white rounded-tr-xl rounded-bl-lg min-w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg z-20">
                        x{currentQuantity}
                      </div>
                    )}

                    {/* Price Badge - Bottom Left */}
                    {priceValue && (
                      <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-xl px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-20">
                        {formatCurrency(priceValue, altCard.priceCurrency)}
                      </div>
                    )}

                    {/* Glare/Shine Effect */}
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
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
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-color-dodge z-10"
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

          {/* Card Info Section - Using base card for effect/texts */}
          <div className="mx-4 my-3">
            <CardDetails
              card={infoCard}
              searchTerm=""
              isModal={false}
              isTextOnly={false}
            />
          </div>
        </div>
      </BaseDrawer>

      {/* Large Image Overlay */}
      {showLargeImage && altCard && (
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
                src={getOptimizedImageUrl(altCard.src, "large")}
                className="max-w-full max-h-[calc(100dvh-150px)] object-contain rounded-lg shadow-2xl"
                alt={infoCard.name}
              />
              <div className="text-white text-center">
                <span className={`${oswald.className} font-medium text-lg`}>
                  {infoCard.code}
                </span>
                {altCard.sets && altCard.sets.length > 0 && (
                  <p className="text-white/70 text-sm mt-1">
                    {(altCard.sets[0] as { set?: { title?: string } })?.set?.title}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CardPreviewDialog;
