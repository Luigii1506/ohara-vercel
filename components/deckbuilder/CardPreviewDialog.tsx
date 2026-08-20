"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  X,
  ZoomIn,
  Gavel,
  Info,
  DollarSign,
  Layers,
  Check,
  Loader2,
  Printer,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "react-toastify";
import { CardWithCollectionData } from "@/types";
import { Oswald } from "next/font/google";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import BaseDrawer from "@/components/ui/BaseDrawer";
import CardDetails from "@/components/CardDetails";
import TcgplayerLogo from "@/components/Icons/TcgplayerLogo";
import { usePrintQueueStore } from "@/store/printQueueStore";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MessageKey } from "@/components/i18n/messages";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PriceField } from "@/components/PriceFieldToggle";

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
  priceField?: PriceField;
}

const CardPreviewDialog: React.FC<CardPreviewDialogProps> = ({
  isOpen,
  onClose,
  card,
  baseCard,
  currentQuantity = 0,
  priceField = "marketPrice",
}) => {
  const { t } = useI18n();
  const addToPrintQueue = usePrintQueueStore((state) => state.addCard);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | number | null
  >(null);
  const [historyRange, setHistoryRange] = useState<
    "30" | "90" | "180" | "365"
  >("90");
  const [priceHistory, setPriceHistory] = useState<
    { date: string; price: number }[] | null
  >(null);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // Historial de precio (para la gráfica de la pestaña Pricing). Solo se
  // pide cuando esa pestaña está activa, y se vuelve a pedir si cambia la
  // variante mostrada o el rango seleccionado (1M/3M/6M/1Y).
  const displayedCardId = displayedCard?.id;
  useEffect(() => {
    if (activeTab !== "pricing" || displayedCardId == null) return;
    let cancelled = false;
    setPriceHistory(null);
    setHistoryLoading(true);
    fetch(`/api/market/cards/${displayedCardId}/history?days=${historyRange}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setPriceHistory(d?.history ?? []);
      })
      .catch(() => {
        if (!cancelled) setPriceHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, displayedCardId, historyRange]);

  if (!altCard || !infoCard) return null;

  const priceValue = getNumericPrice(
    priceField === "midPrice" ? displayedCard.midPrice : displayedCard.marketPrice
  );
  const lowValue = getNumericPrice(displayedCard.lowPrice);
  const midValue = getNumericPrice(displayedCard.midPrice);
  const highValue = getNumericPrice(displayedCard.highPrice);
  const selectedPriceLabel =
    priceField === "midPrice"
      ? t("cardPreview.priceMid")
      : t("cardPreview.priceMarket");
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

  const handleAddToPrintQueue = () => {
    addToPrintQueue(displayedCard);
    toast.success("Carta añadida a la cola de impresión");
  };

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
          onPointerDown={(e) => e.stopPropagation()}
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

          <div className="flex justify-center px-4 pb-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddToPrintQueue();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-purple-500"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </button>
          </div>

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
                      {selectedPriceLabel}
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

                  {priceField === "marketPrice" && (
                    <PriceHistoryCard
                      history={priceHistory}
                      loading={historyLoading}
                      range={historyRange}
                      onRangeChange={setHistoryRange}
                      currency={displayedCard.priceCurrency}
                      t={t}
                    />
                  )}

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
                    const vPrice = getNumericPrice(
                      priceField === "midPrice" ? variant.midPrice : variant.marketPrice
                    );
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

const HISTORY_RANGES: {
  key: "30" | "90" | "180" | "365";
  labelKey: MessageKey;
}[] = [
  { key: "30", labelKey: "cardPreview.chartRange1M" },
  { key: "90", labelKey: "cardPreview.chartRange3M" },
  { key: "180", labelKey: "cardPreview.chartRange6M" },
  { key: "365", labelKey: "cardPreview.chartRange1Y" },
];

const PriceHistoryCard: React.FC<{
  history: { date: string; price: number }[] | null;
  loading: boolean;
  range: "30" | "90" | "180" | "365";
  onRangeChange: (range: "30" | "90" | "180" | "365") => void;
  currency?: string | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}> = ({ history, loading, range, onRangeChange, currency, t }) => {
  const hasData = !!history && history.length >= 2;
  const first = hasData ? history![0].price : null;
  const last = hasData ? history![history!.length - 1].price : null;
  const changePct =
    first != null && last != null && first !== 0
      ? ((last - first) / first) * 100
      : null;
  const up = (changePct ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-slate-700">
            {t("cardPreview.chartTitle")}
          </p>
          {hasData && changePct != null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                up
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {up ? (
                <TrendingUp className="h-2.5 w-2.5" strokeWidth={3} />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" strokeWidth={3} />
              )}
              {up ? "+" : ""}
              {changePct.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRangeChange(r.key)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                range === r.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
        </div>
      ) : hasData ? (
        <PriceHistoryChart history={history!} currency={currency} t={t} />
      ) : (
        <div className="flex h-40 items-center justify-center text-center text-xs text-slate-400">
          {t("cardPreview.chartNoData")}
        </div>
      )}
    </div>
  );
};

const PriceHistoryChart: React.FC<{
  history: { date: string; price: number }[];
  currency?: string | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}> = ({ history, currency, t }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const w = 320;
  const h = 140;
  const padX = 3;
  const padTop = 18;
  const padBottom = 4;

  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const innerH = h - padTop - padBottom;
  const stepX = (w - padX * 2) / (history.length - 1);
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => padTop + innerH - ((v - min) / range) * innerH;

  const points = history.map((p, i) => ({ x: x(i), y: y(p.price) }));

  // Curva suave a través de los puntos medios (Q bezier), barato y prolijo.
  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    linePath += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  if (points.length > 1) {
    const lastPt = points[points.length - 1];
    const prevPt = points[points.length - 2];
    linePath += ` Q ${prevPt.x.toFixed(1)} ${prevPt.y.toFixed(1)} ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)}`;
  }

  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaPath = `${linePath} L ${lastPt.x.toFixed(1)} ${h} L ${firstPt.x.toFixed(1)} ${h} Z`;

  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? "#059669" : "#e11d48";
  const gradientId = `price-chart-fill-${up ? "up" : "down"}`;

  const updatePointer = (clientX: number, rect: DOMRect) => {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (history.length - 1)));
  };

  const hovered = hoverIndex != null ? history[hoverIndex] : null;
  const hoverX = hoverIndex != null ? points[hoverIndex].x : null;
  const hoverY = hoverIndex != null ? points[hoverIndex].y : null;
  const tooltipW = 74;
  const tooltipX = hoverX != null
    ? Math.min(Math.max(hoverX - tooltipW / 2, padX), w - padX - tooltipW)
    : 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full touch-none select-none"
        preserveAspectRatio="none"
        onMouseMove={(e) =>
          updatePointer(e.clientX, e.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={(e) =>
          updatePointer(
            e.touches[0].clientX,
            e.currentTarget.getBoundingClientRect()
          )
        }
        onTouchMove={(e) =>
          updatePointer(
            e.touches[0].clientX,
            e.currentTarget.getBoundingClientRect()
          )
        }
        onTouchEnd={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill={color} />
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={6}
          fill={color}
          opacity={0.18}
        />

        {hoverX != null && hoverY != null && (
          <>
            <line
              x1={hoverX}
              y1={padTop}
              x2={hoverX}
              y2={h}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoverX}
              cy={hoverY}
              r={4}
              fill="white"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <g transform={`translate(${tooltipX.toFixed(1)}, 0)`}>
              <rect
                x={0}
                y={0}
                width={tooltipW}
                height={15}
                rx={4}
                fill="#0f172a"
              />
              <text
                x={tooltipW / 2}
                y={10.5}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={700}
                fill="white"
              >
                {formatCurrency(hovered!.price, currency)}
              </text>
            </g>
          </>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between px-0.5 text-[10px] text-slate-400">
        <span>{history[0].date}</span>
        <span>
          {t("cardPreview.chartMin")} {formatCurrency(min, currency)} ·{" "}
          {t("cardPreview.chartMax")} {formatCurrency(max, currency)}
        </span>
        <span>{history[history.length - 1].date}</span>
      </div>
    </div>
  );
};

export default CardPreviewDialog;
