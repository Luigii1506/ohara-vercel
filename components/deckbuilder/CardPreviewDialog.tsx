"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { X, ZoomIn, Gavel, Info, DollarSign, Layers, Check } from "lucide-react";
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
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | number | null
  >(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // La variante que se está mostrando arriba (imagen/precio/tcgplayer):
  // la seleccionada a mano en la pestaña Variantes, o si no, la que abrió el diálogo.
  const displayedCard = useMemo<CardWithCollectionData>(() => {
    if (selectedVariantId != null) {
      const found = variants.find((v) => v.id === selectedVariantId);
      if (found) return found;
    }
    return altCard as CardWithCollectionData;
  }, [selectedVariantId, variants, altCard]);

  const selectVariant = useCallback((variant: CardWithCollectionData) => {
    setSelectedVariantId(variant.id);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof Info }[] = [];
    if (!isDon) list.push({ id: "details", label: t("cardPreview.tabDetails"), icon: Info });
    list.push({ id: "pricing", label: t("cardPreview.tabPricing"), icon: DollarSign });
    if (!isDon && hasRulings)
      list.push({ id: "rulings", label: t("cardPreview.tabRulings"), icon: Gavel });
    list.push({ id: "variants", label: t("cardPreview.tabVariants"), icon: Layers });
    return list;
  }, [isDon, hasRulings, t]);

  // Reset a la primera pestaña disponible y a la variante original cuando
  // cambia la carta mostrada (nueva apertura del diálogo).
  useEffect(() => {
    setSelectedVariantId(null);
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "pricing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoCard?.id]);

  if (!altCard || !infoCard) return null;

  const priceValue = getNumericPrice(displayedCard.marketPrice);
  const lowValue = getNumericPrice(displayedCard.lowPrice);
  const midValue = getNumericPrice(displayedCard.midPrice);
  const highValue = getNumericPrice(displayedCard.highPrice);
  const tcgUrl =
    displayedCard?.tcgUrl && displayedCard.tcgUrl !== ""
      ? displayedCard.tcgUrl
      : `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
          infoCard.name
        )}&Rarity=${encodeURIComponent(
          displayedCard.rarity ?? infoCard.rarity ?? ""
        )}&Color=${encodeURIComponent(
          infoCard.colors?.[0]?.color ?? ""
        )}&CardType=${encodeURIComponent(infoCard.category ?? "")}`;
  const isUsCard = (displayedCard?.region ?? infoCard?.region) === "US";
  const showQuantityBadge =
    currentQuantity > 0 && displayedCard.id === altCard.id;

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
        fullScreenMobile
        showHandle={false}
      >
        {/* Header - Use base card info */}
        <div
          className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-1"
          style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top))" }}
        >
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
                <span>{displayedCard.rarity ?? infoCard.rarity}</span>
                <span className="text-slate-300">•</span>
                <span>{infoCard.category}</span>
              </div>
              {/* Name */}
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {infoCard.name}
              </h2>
              {/* Types - from base card */}
              {infoCard.types && infoCard.types.length > 0 && (
                <p className="block text-xs text-slate-500 mt-0.5">
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
          ref={scrollRef}
          className="overflow-y-auto flex-1 pb-4 max-h-[calc(100dvh-76px)] md:max-h-[calc(92vh-100px)]"
          style={{
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
                    key={displayedCard.id}
                    className="relative w-60 sm:w-64 aspect-[2.5/3.5] rounded-xl overflow-hidden animate-in fade-in zoom-in-[0.98] duration-200"
                    style={{
                      boxShadow: isHovering
                        ? "0 30px 60px -15px rgba(0, 0, 0, 0.5), 0 15px 30px -10px rgba(0, 0, 0, 0.3)"
                        : "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 10px 25px -8px rgba(0, 0, 0, 0.2)",
                      transition: "box-shadow 0.3s ease",
                    }}
                  >
                    <img
                      src={getOptimizedImageUrl(displayedCard.src, "medium")}
                      alt={infoCard.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />

                    {/* Quantity Badge - Top Right */}
                    {showQuantityBadge && (
                      <div className="absolute top-0 right-0 bg-black text-white rounded-tr-xl rounded-bl-lg min-w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg z-20">
                        x{currentQuantity}
                      </div>
                    )}

                    {/* Price Badge - Bottom Left */}
                    {priceValue && (
                      <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-xl px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-20">
                        {formatCurrency(priceValue, displayedCard.priceCurrency)}
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

          {selectedVariantId != null && (
            <p className="block px-4 pb-1 text-center text-[11px] font-medium text-slate-400">
              {displayedCard.alias && displayedCard.alias !== "0"
                ? displayedCard.alias
                : displayedCard.alternateArt || t("cardPreview.tabVariants")}
            </p>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabId)}
            className="mt-1"
          >
            <div className="sticky top-0 z-[5] border-b border-slate-200 bg-white px-4">
              <TabsList className="relative flex h-auto w-full gap-0 rounded-none bg-transparent p-0">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-none bg-transparent px-1 py-2.5 text-[12px] font-semibold text-slate-400 shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                  >
                    <tab.icon className="h-[15px] w-[15px]" strokeWidth={2.25} />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
                <div
                  className="absolute bottom-0 left-0 h-[2.5px] rounded-full bg-slate-900 transition-transform duration-300 ease-out"
                  style={{
                    width: `${100 / tabs.length}%`,
                    transform: `translateX(${activeIndex * 100}%)`,
                  }}
                />
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
                      {formatCurrency(priceValue, displayedCard.priceCurrency)}
                    </p>
                    {displayedCard.priceUpdatedAt && (
                      <p className="mt-1 block text-[11px] text-emerald-700/60">
                        {t("cardPreview.priceLastUpdated", {
                          date: new Date(
                            displayedCard.priceUpdatedAt as unknown as string
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
                        currency={displayedCard.priceCurrency}
                      />
                      <PriceStat
                        label={t("cardPreview.priceMid")}
                        value={midValue}
                        currency={displayedCard.priceCurrency}
                        emphasize
                      />
                      <PriceStat
                        label={t("cardPreview.priceHigh")}
                        value={highValue}
                        currency={displayedCard.priceCurrency}
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {variants.map((variant, idx) => {
                    const isSelected = variant.id === displayedCard.id;
                    const vPrice = getNumericPrice(variant.marketPrice);
                    const label =
                      idx === 0
                        ? t("cardPreview.variantsBase")
                        : variant.alias && variant.alias !== "0"
                          ? variant.alias
                          : variant.alternateArt || t("cardPreview.tabVariants");
                    return (
                      <button
                        type="button"
                        key={variant.id}
                        onClick={() => selectVariant(variant)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`group flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-all ${
                          isSelected
                            ? "border-slate-900 shadow-md"
                            : "border-slate-150 hover:border-slate-300"
                        }`}
                      >
                        <div className="relative aspect-[2.5/3.5] w-full overflow-hidden bg-slate-100">
                          <img
                            src={getOptimizedImageUrl(variant.src, "small")}
                            alt={variant.name}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                          {isSelected && (
                            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="truncate text-[11px] font-semibold text-slate-700">
                            {label}
                          </p>
                          {vPrice ? (
                            <p className="text-[11px] font-bold text-emerald-600">
                              {formatCurrency(vPrice, variant.priceCurrency)}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-300">—</p>
                          )}
                        </div>
                      </button>
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
      {showLargeImage && displayedCard && (
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
                src={getOptimizedImageUrl(displayedCard.src, "large")}
                className="max-w-full max-h-[calc(100dvh-150px)] object-contain rounded-lg shadow-2xl"
                alt={infoCard.name}
              />
              <div className="text-white text-center">
                <span className={`${oswald.className} font-medium text-lg`}>
                  {infoCard.code}
                </span>
                {displayedCard.sets && displayedCard.sets.length > 0 && (
                  <p className="block text-white/70 text-sm mt-1">
                    {
                      (displayedCard.sets[0] as { set?: { title?: string } })
                        ?.set?.title
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
