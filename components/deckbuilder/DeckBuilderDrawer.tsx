"use client";

import {
  X,
  Users,
  Layers,
  Save,
  RotateCcw,
  Download,
  ChartColumnBigIcon,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { getColors } from "@/helpers/functions";
import { showWarningToast } from "@/lib/toastify";
import { Oswald } from "next/font/google";
import { DeckCard } from "@/types";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import MobileDeckStats from "./MobileDeckStats";
import CardWithBadges from "@/components/CardWithBadges";
import CardPreviewDialog from "./CardPreviewDialog";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { useI18n } from "@/components/i18n/I18nProvider";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface DeckBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deckBuilder: ReturnType<typeof useDeckBuilder>;
  deckName?: string;
  setDeckName?: (name: string) => void;
  onSave: () => void;
  onRestart: () => void;
  onProxies?: () => void;
  isShopMode?: boolean;
  shopSlug?: string;
  setShopSlug?: (slug: string) => void;
  shopUrl?: string;
  setShopUrl?: (url: string) => void;
  isPublished?: boolean;
  setIsPublished?: (value: boolean) => void;
  formatCurrency: (value: number, currency?: string | null) => string;
  getCardPriceValue: (card: any) => number | null;
}

const DeckBuilderDrawer: React.FC<DeckBuilderDrawerProps> = ({
  isOpen,
  onClose,
  deckBuilder,
  deckName,
  setDeckName,
  onSave,
  onRestart,
  onProxies,
  isShopMode = false,
  shopSlug,
  setShopSlug,
  shopUrl,
  setShopUrl,
  isPublished,
  setIsPublished,
  formatCurrency,
  getCardPriceValue,
}) => {
  const { t } = useI18n();
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<DeckCard | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Open card preview dialog
  const openCardPreview = (card: DeckCard) => {
    setPreviewCard(card);
    setIsPreviewOpen(true);
  };

  // Close card preview dialog
  const closeCardPreview = () => {
    setIsPreviewOpen(false);
    setPreviewCard(null);
  };

  const isShopView = Boolean(isShopMode);
  const showShopFields =
    isShopView && Boolean(setShopSlug) && Boolean(setShopUrl);
  const shopSlugValue = shopSlug ?? "";
  const shopUrlValue = shopUrl ?? "";
  const shopFieldsMissing =
    isShopView && (!shopSlugValue.trim() || !shopUrlValue.trim());

  const handleSlugInputChange = (value: string) => {
    if (!setShopSlug) return;
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setShopSlug(normalized);
  };

  const handleShopUrlChange = (value: string) => {
    if (!setShopUrl) return;
    setShopUrl(value);
  };

  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  // Calculate deck price
  const deckPrice = useMemo(() => {
    let total = 0;
    deckBuilder.deckCards.forEach((card) => {
      const priceValue = getCardPriceValue(card);
      if (priceValue !== null) {
        total += priceValue * card.quantity;
      }
    });
    // Add leader price if selected
    if (deckBuilder.selectedLeader) {
      const leaderPrice = getCardPriceValue(deckBuilder.selectedLeader);
      if (leaderPrice !== null) {
        total += leaderPrice;
      }
    }
    return total;
  }, [deckBuilder.deckCards, deckBuilder.selectedLeader, getCardPriceValue]);

  // Group cards by code
  const groupedCards = Object.values(
    deckBuilder.deckCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof deckBuilder.deckCards>)
  );

  // Sort cards
  groupedCards.sort((groupA, groupB) => {
    const cardA = groupA[0];
    const cardB = groupB[0];
    const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
    const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";
    if (isSpecialA !== isSpecialB) {
      return isSpecialA ? 1 : -1;
    }
    const costA = parseInt(cardA.cost ?? "0", 10);
    const costB = parseInt(cardB.cost ?? "0", 10);
    return costA - costB;
  });

  const removeCard = (cardId: number) => {
    deckBuilder.setDeckCards((prev) =>
      prev?.filter((card) => card.cardId !== cardId)
    );
  };

  return (
    <>
      <BaseDrawer isOpen={isOpen} onClose={onClose} maxHeight="92vh">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  {/* Leader Avatar */}
                  {deckBuilder.selectedLeader ? (
                    <>
                      <div
                        className="relative h-12 w-12 flex-shrink-0 rounded-full cursor-pointer"
                        onClick={() => setShowLargeImage(true)}
                      >
                        {deckBuilder.selectedLeader.colors.length === 2 ? (
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: `linear-gradient(to right, ${getColors(
                                deckBuilder.selectedLeader.colors[0].color
                              )} 0%, ${getColors(
                                deckBuilder.selectedLeader.colors[0].color
                              )} 40%, ${getColors(
                                deckBuilder.selectedLeader.colors[1].color
                              )} 60%, ${getColors(
                                deckBuilder.selectedLeader.colors[1].color
                              )} 100%)`,
                            }}
                          />
                        ) : deckBuilder.selectedLeader.colors.length > 0 ? (
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              backgroundColor: getColors(
                                deckBuilder.selectedLeader.colors[0].color
                              ),
                            }}
                          />
                        ) : null}
                        <div
                          className="absolute inset-1 rounded-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${deckBuilder.selectedLeader.src})`,
                            backgroundSize: "150%",
                            backgroundPosition: "-20px -2px",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold text-slate-900">
                          {deckBuilder.selectedLeader.name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {deckBuilder.selectedLeader.code}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-bold text-slate-700">
                          {t("deckbuilder.selectLeaderLabel")}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {t("deckbuilder.chooseLeaderLabel")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stats Bar */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {/* Total Cards */}
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {totalCards}
                  </span>
                  <span className="text-xs text-slate-500">/50</span>
                </div>

                {/* Remaining */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                    50 - totalCards === 0
                      ? "bg-emerald-100"
                      : 50 - totalCards <= 10
                      ? "bg-amber-100"
                      : "bg-slate-100"
                  }`}
                >
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      50 - totalCards === 0
                        ? "text-emerald-600"
                        : 50 - totalCards <= 10
                        ? "text-amber-600"
                        : "text-slate-600"
                    }`}
                  >
                    {50 - totalCards === 0
                      ? t("deckbuilder.completeLabel")
                      : t("deckbuilder.leftCount", {
                          count: 50 - totalCards,
                        })}
                  </span>
                </div>

                {/* Deck Price */}
                {deckPrice > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-100 px-2.5 py-1.5 rounded-lg">
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(deckPrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats Toggle Button */}
              <button
                type="button"
                className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  isStatsOpen
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setIsStatsOpen(!isStatsOpen)}
              >
                <ChartColumnBigIcon className="h-4 w-4" />
                <span className="text-xs font-semibold">
                  {t("deckbuilder.statsTitle")}
                </span>
              </button>
            </div>

            {/* Deck Name Input */}
            {deckName !== undefined && setDeckName && (
              <div className="mt-3 flex flex-col gap-2">
                <Input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder={t("deckbuilder.deckNamePlaceholder")}
                  className="w-full h-10 text-sm font-medium bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg"
                  maxLength={50}
                />
                {showShopFields && (
                  <>
                    <Input
                      type="text"
                      value={shopSlugValue}
                      onChange={(e) => handleSlugInputChange(e.target.value)}
                      placeholder={t("deckbuilder.shopSlugPlaceholder")}
                      className="w-full h-10 text-sm font-medium bg-white border border-gray-300 rounded-lg"
                      maxLength={60}
                    />
                    <Input
                      type="url"
                      value={shopUrlValue}
                      onChange={(e) => handleShopUrlChange(e.target.value)}
                      placeholder={t("deckbuilder.shopUrlPlaceholder")}
                      className="w-full h-10 text-sm font-medium bg-white border border-gray-300 rounded-lg"
                    />
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <Switch
                        checked={Boolean(isPublished)}
                        onCheckedChange={(checked) => setIsPublished?.(checked)}
                      />
                      <span className="text-xs font-medium text-gray-600">
                        {isPublished
                          ? t("deckbuilder.shopPublished")
                          : t("deckbuilder.shopUnpublished")}
                      </span>
                    </div>
                    {shopSlugValue && (
                      <p className="text-[11px] text-gray-500 text-center">
                        /shop/{shopSlugValue}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scrollable Content with View Transition */}
          <div
            className="overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: "calc(92vh - 350px)" }}
            ref={containerRef}
          >
            {/* Stats View */}
            {isStatsOpen && (
              <div className="bg-slate-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <MobileDeckStats deck={deckBuilder.deckCards} />
              </div>
            )}

            {/* Cards View */}
            {!isStatsOpen && (
              <div className="px-4 pb-4 animate-in fade-in duration-150">
                {deckBuilder.deckCards.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    {!deckBuilder.selectedLeader ? (
                      <Card className="max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg">
                        <CardContent className="p-6 text-center">
                          <div className="w-14 h-14 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <Users className="h-7 w-7 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
                            {t("deckbuilder.chooseLeaderTitle")}
                          </h3>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {t("deckbuilder.chooseLeaderBody")}
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="max-w-md mx-auto bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-lg">
                        <CardContent className="p-6 text-center">
                          <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Layers className="h-7 w-7 text-green-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
                            {t("deckbuilder.buildDeckTitle")}
                          </h3>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {t("deckbuilder.buildDeckBody")}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {groupedCards.flatMap((group) =>
                        group.map((card, cardIndex) => {
                          const totalQuantityByCode =
                            deckBuilder.deckCards
                              ?.filter(
                                (deckCard) => deckCard.code === card.code
                              )
                              .reduce(
                                (sum, deckCard) => sum + deckCard.quantity,
                                0
                              ) || 0;

                          const maxQty =
                            card.code === "OP08-072" || card.code === "OP01-075"
                              ? 50
                              : 4;

                          return (
                            <div
                              key={`${card.cardId}-${cardIndex}`}
                              ref={(el) => {
                                groupRefs.current[card.code] = el;
                              }}
                            >
                              <CardWithBadges
                                id={card.cardId}
                                src={card.src}
                                alt={card.name}
                                code={card.code}
                                price={getCardPriceValue(card)}
                                onClick={() => {
                                  if (totalQuantityByCode < maxQty) {
                                    deckBuilder.updateDeckCardQuantity(
                                      card.cardId,
                                      card.quantity + 1
                                    );
                                  } else {
                                    showWarningToast(
                                      t("deckbuilder.maxSameCode")
                                    );
                                  }
                                }}
                                onInfoClick={() => openCardPreview(card)}
                                onAdd={() => {
                                  if (totalQuantityByCode < maxQty) {
                                    deckBuilder.updateDeckCardQuantity(
                                      card.cardId,
                                      card.quantity + 1
                                    );
                                  } else {
                                    showWarningToast(
                                      t("deckbuilder.maxSameCode")
                                    );
                                  }
                                }}
                                onRemove={() => {
                                  const newQuantity = Math.max(
                                    0,
                                    card.quantity - 1
                                  );
                                  if (newQuantity === 0) {
                                    removeCard(card.cardId);
                                  } else {
                                    deckBuilder.updateDeckCardQuantity(
                                      card.cardId,
                                      newQuantity
                                    );
                                  }
                                }}
                                quantityInDeck={card.quantity}
                                maxQuantity={maxQty}
                                showControls
                                priority={cardIndex < 12}
                                size="small"
                                alwaysShowCode
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with action buttons */}
          {deckName !== undefined && setDeckName && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  className="flex-1 h-12 text-red-600 border-2 border-red-300 hover:bg-red-50 font-semibold rounded-xl"
                  onClick={() => {
                    onRestart();
                    onClose();
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  {t("deckbuilder.clearDeck")}
                </Button>

                {onProxies && (
                  <Button
                    onClick={onProxies}
                    disabled={totalCards === 0}
                    variant="outline"
                    size="lg"
                    type="button"
                    className="h-12 border-2 border-violet-300 text-violet-600 hover:bg-violet-50 font-semibold disabled:opacity-50 rounded-xl px-3"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  onClick={onSave}
                  disabled={
                    totalCards < 50 ||
                    deckBuilder.isSaving ||
                    !deckName?.trim() ||
                    shopFieldsMissing
                  }
                  size="lg"
                  className={`flex-1 h-12 font-semibold rounded-xl ${
                    totalCards < 50 ||
                    deckBuilder.isSaving ||
                    !deckName?.trim() ||
                    shopFieldsMissing
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  {deckBuilder.isSaving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {t("deckbuilder.saveDeck", { count: totalCards })}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
      </BaseDrawer>

      {/* Large Image Modal - Leader */}
      {showLargeImage && deckBuilder.selectedLeader && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-5"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-lg">
            <p className="mb-3 text-center text-white text-lg">
              {t("cardPreview.tapToClose")}
            </p>
            <img
              src={getOptimizedImageUrl(
                deckBuilder.selectedLeader.src ??
                  "/assets/images/backcard.webp",
                "large"
              )}
              className="max-w-full max-h-[75vh] mx-auto object-contain rounded-lg shadow-2xl"
              alt={deckBuilder.selectedLeader.name}
            />
            <p
              className={`${oswald.className} mt-3 text-center text-white font-medium`}
            >
              {deckBuilder.selectedLeader.code}
            </p>
          </div>
        </div>
      )}

      {/* Card Preview Dialog */}
      <CardPreviewDialog
        isOpen={isPreviewOpen}
        onClose={closeCardPreview}
        card={previewCard as any}
        onAddCard={() => {
          if (previewCard) {
            const totalQuantityByCode =
              deckBuilder.deckCards
                ?.filter((deckCard) => deckCard.code === previewCard.code)
                .reduce((sum, deckCard) => sum + deckCard.quantity, 0) || 0;
            const maxQty =
              previewCard.code === "OP08-072" || previewCard.code === "OP01-075"
                ? 50
                : 4;
            if (totalQuantityByCode < maxQty) {
              deckBuilder.updateDeckCardQuantity(
                previewCard.cardId,
                previewCard.quantity + 1
              );
              // Update preview card state
              setPreviewCard({
                ...previewCard,
                quantity: previewCard.quantity + 1,
              });
            } else {
              showWarningToast(
                t("deckbuilder.maxSameCode")
              );
            }
          }
        }}
        onRemoveCard={() => {
          if (previewCard && previewCard.quantity > 0) {
            const newQuantity = previewCard.quantity - 1;
            if (newQuantity === 0) {
              removeCard(previewCard.cardId);
              closeCardPreview();
            } else {
              deckBuilder.updateDeckCardQuantity(
                previewCard.cardId,
                newQuantity
              );
              setPreviewCard({ ...previewCard, quantity: newQuantity });
            }
          }
        }}
        currentQuantity={previewCard?.quantity || 0}
        maxQuantity={
          previewCard?.code === "OP08-072" || previewCard?.code === "OP01-075"
            ? 50
            : 4
        }
        canAdd={
          previewCard
            ? (deckBuilder.deckCards
                ?.filter((deckCard) => deckCard.code === previewCard.code)
                .reduce((sum, deckCard) => sum + deckCard.quantity, 0) || 0) <
              (previewCard.code === "OP08-072" ||
              previewCard.code === "OP01-075"
                ? 50
                : 4)
            : false
        }
        canRemove={(previewCard?.quantity || 0) > 0}
      />
    </>
  );
};

export default DeckBuilderDrawer;
