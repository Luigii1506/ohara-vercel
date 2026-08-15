"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { X, ZoomIn, Gavel, Info, DollarSign, Layers } from "lucide-react";
import { CardWithCollectionData } from "@/types";
import { Oswald } from "next/font/google";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import BaseDrawer from "@/components/ui/BaseDrawer";
import CardDetails from "@/components/CardDetails";
import TcgplayerLogo from "@/components/Icons/TcgplayerLogo";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

const openTcgplayer = (webUrl: string) => {
  window.open(webUrl, "_blank", "noopener,noreferrer");
};

type TabId = "details" | "pricing" | "rulings" | "variants";

interface CardPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardWithCollectionData | null;
  baseCard?: CardWithCollectionData | null;
  currentQuantity?: number;
  // Optional deck builder actions
  onAddCard?: () => void;
  onRemoveCard?: () => void;
  maxQuantity?: number;
  canAdd?: boolean;
  canRemove?: boolean;
  isLeaderSelection?: boolean;
}

const CardPreviewDialog: React.FC<CardPreviewDialogProps> = ({
  isOpen,
  onClose,
  card,
  baseCard,
  currentQuantity = 0,
}) => {
  const { t } = useI18n();
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const cardRef = useRef<HTMLDivElement>(null);

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

  // For alternates: use card for image/price/set, baseCard for effect/texts/types
  // For regular cards: card and baseCard are the same
  const altCard = card || baseCard;
  const infoCard = baseCard || card;

  // Rulings from base card (infoCard)
  const rulings = infoCard?.rulings || [];
  const hasRulings = rulings.length > 0;
  const isDon = (infoCard?.category || "").toLowerCase() === "don";
  const variants = useMemo(
    () => (infoCard ? [infoCard, ...(infoCard.alternates ?? [])] : []),
    [infoCard]
  );
  const hasVariants = variants.length > 1;

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof Info }[] = [];
    if (!isDon) list.push({ id: "details", label: t("cardPreview.tabDetails"), icon: Info });
    list.push({ id: "pricing", label: t("cardPreview.tabPricing"), icon: DollarSign });
    if (!isDon && hasRulings)
      list.push({ id: "rulings", label: t("cardPreview.tabRulings"), icon: Gavel });
    list.push({ id: "variants", label: t("cardPreview.tabVariants"), icon: Layers });
    return list;
  }, [isDon, hasRulings, t]);

  // Reset a la primera pestaña disponible cuando cambia la carta mostrada o
  // cuando la pestaña activa deja de existir (ej. cambia isDon/hasRulings).
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "pricing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoCard?.id, tabs]);

  if (!altCard || !infoCard) return null;

  const priceValue = getNumericPrice(altCard.marketPrice);
  const lowValue = getNumericPrice(altCard.lowPrice);
  const midValue = getNumericPrice(altCard.midPrice);
  const highValue = getNumericPrice(altCard.highPrice);
  const tcgUrl =
    altCard?.tcgUrl && altCard.tcgUrl !== ""
      ? altCard.tcgUrl
      : `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
          infoCard.name
        )}&Rarity=${encodeURIComponent(
          infoCard.rarity ?? ""
        )}&Color=${encodeURIComponent(
          infoCard.colors?.[0]?.color ?? ""
        )}&CardType=${encodeURIComponent(infoCard.category ?? "")}`;
  const isUsCard = (altCard?.region ?? infoCard?.region) === "US";

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );

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
          style={{
            maxHeight: "calc(92vh - 100px)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Card Image with 3D Tilt Effect */}
          <div className="px-4 pt-3 pb-2 flex justify-center bg-gradient-to-b from-slate-100 to-slate-50">
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
                  {/* Card Image Container - Sin borde, solo sombra */}
                  <div
                    className="relative w-44 sm:w-60 aspect-[2.5/3.5] rounded-xl overflow-hidden"
                    style={{
                      boxShadow: isHovering
                        ? "0 30px 60px -15px rgba(0, 0, 0, 0.5), 0 15px 30px -10px rgba(0, 0, 0, 0.3)"
                        : "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 10px 25px -8px rgba(0, 0, 0, 0.2)",
                      transition: "box-shadow 0.3s ease",
                    }}
                  >
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

                  {/* Zoom Hint */}
                  <div
                    className={`absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-opacity duration-200 ${
                      isHovering ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <ZoomIn className="h-3 w-3" />
                    <span>{t("cardPreview.tapToExpand")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabId)}
            className="mt-1"
          >
            <div className="sticky top-0 z-[5] bg-white/95 backdrop-blur px-4 py-2">
              <TabsList className="relative flex w-full rounded-2xl bg-slate-100 p-1 h-auto">
                <div
                  className="absolute inset-y-1 left-1 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md transition-transform duration-300 ease-out"
                  style={{
                    width: `calc(${100 / tabs.length}% - 4px)`,
                    transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 2}px))`,
                  }}
                />
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="relative z-10 flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-transparent px-1 py-2 text-[10.5px] font-bold text-slate-500 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {!isDon && (
              <TabsContent value="details" className="mt-0 px-4 py-3">
                <CardDetails
                  card={infoCard}
                  searchTerm=""
                  isModal={false}
                  isTextOnly={false}
                />
              </TabsContent>
            )}

            <TabsContent value="pricing" className="mt-0 px-4 py-4 space-y-4">
              {priceValue ? (
                <>
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center">
                    <p className="block text-[11px] font-bold uppercase tracking-wide text-emerald-700/70">
                      {t("cardPreview.priceMarket")}
                    </p>
                    <p className="mt-1 block text-3xl font-black text-emerald-700">
                      {formatCurrency(priceValue, altCard.priceCurrency)}
                    </p>
                    {altCard.priceUpdatedAt && (
                      <p className="mt-1 block text-[11px] text-emerald-700/60">
                        {t("cardPreview.priceLastUpdated", {
                          date: new Date(
                            altCard.priceUpdatedAt as unknown as string
                          ).toLocaleDateString(),
                        })}
                      </p>
                    )}
                  </div>

                  {(lowValue || midValue || highValue) && (
                    <div className="grid grid-cols-3 gap-2">
                      <PriceStat
                        label={t("cardPreview.priceLow")}
                        value={lowValue}
                        currency={altCard.priceCurrency}
                      />
                      <PriceStat
                        label={t("cardPreview.priceMid")}
                        value={midValue}
                        currency={altCard.priceCurrency}
                        emphasize
                      />
                      <PriceStat
                        label={t("cardPreview.priceHigh")}
                        value={highValue}
                        currency={altCard.priceCurrency}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  {t("cardPreview.noPriceData")}
                </div>
              )}

              {isUsCard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTcgplayer(tcgUrl);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                >
                  <TcgplayerLogo className="h-5 w-12 text-white" />
                  <span>{t("cardPreview.viewOnTcg")}</span>
                </button>
              )}
            </TabsContent>

            {!isDon && hasRulings && (
              <TabsContent value="rulings" className="mt-0 px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                    <Gavel className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-amber-700">
                    {t("cardPreview.rulingsSubtitle", { count: rulings.length })}
                  </p>
                </div>
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
              </TabsContent>
            )}

            <TabsContent value="variants" className="mt-0 px-4 py-4">
              {hasVariants ? (
                <div
                  className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {variants.map((variant, idx) => {
                    const isCurrent = variant.id === altCard.id;
                    const vPrice = getNumericPrice(variant.marketPrice);
                    const label =
                      idx === 0
                        ? t("cardPreview.variantsBase")
                        : variant.alias && variant.alias !== "0"
                          ? variant.alias
                          : variant.alternateArt || t("cardPreview.tabVariants");
                    return (
                      <div
                        key={variant.id}
                        className={`flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-colors ${
                          isCurrent
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-100 bg-white"
                        }`}
                      >
                        <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded-lg">
                          <img
                            src={getOptimizedImageUrl(variant.src, "thumb")}
                            alt={variant.name}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                          {isCurrent && (
                            <div className="pointer-events-none absolute top-1 left-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow">
                              {t("cardPreview.variantsViewing")}
                            </div>
                          )}
                        </div>
                        <span className="line-clamp-1 text-center text-[10px] font-semibold text-slate-600">
                          {label}
                        </span>
                        {vPrice ? (
                          <span className="text-[10px] font-bold text-emerald-600">
                            {formatCurrency(vPrice, variant.priceCurrency)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  {t("cardPreview.noVariants")}
                </div>
              )}
            </TabsContent>
          </Tabs>
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
              {t("cardPreview.tapToClose")}
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
                    {
                      (altCard.sets[0] as { set?: { title?: string } })?.set
                        ?.title
                    }
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

const PriceStat: React.FC<{
  label: string;
  value: number | null;
  currency?: string | null;
  emphasize?: boolean;
}> = ({ label, value, currency, emphasize }) => (
  <div
    className={`rounded-xl border p-2.5 text-center ${
      emphasize
        ? "border-slate-300 bg-slate-50"
        : "border-slate-100 bg-white"
    }`}
  >
    <p className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p
      className={`mt-0.5 block text-sm font-bold ${
        emphasize ? "text-slate-800" : "text-slate-600"
      }`}
    >
      {value ? formatCurrency(value, currency) : "—"}
    </p>
  </div>
);

export default CardPreviewDialog;
