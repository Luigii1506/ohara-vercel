"use client";

import { X, Layers, RotateCcw, Printer, Minus, Plus, Eye } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Oswald } from "next/font/google";
import { DeckCard, CardWithCollectionData } from "@/types";
import { getOptimizedImageUrl } from "@/lib/imageOptimization";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ProxyCardPreviewDrawer from "./ProxyCardPreviewDrawer";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface ProxiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  proxies: DeckCard[];
  setProxies: React.Dispatch<React.SetStateAction<DeckCard[]>>;
  onGeneratePDF: () => void;
  allCards?: CardWithCollectionData[];
}

const ProxiesDrawer: React.FC<ProxiesDrawerProps> = ({
  isOpen,
  onClose,
  proxies,
  setProxies,
  onGeneratePDF,
  allCards = [],
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [selectedFullCard, setSelectedFullCard] =
    useState<CardWithCollectionData | null>(null);
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalCards = proxies.reduce((total, card) => total + card.quantity, 0);

  const handleQuantityChange = (cardId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setProxies((prev) => prev.filter((p) => p.cardId !== cardId));
      if (selectedCard && selectedCard.cardId === cardId) {
        setIsCardPreviewOpen(false);
      }
    } else {
      setProxies((prev) =>
        prev.map((p) =>
          p.cardId === cardId ? { ...p, quantity: newQuantity } : p
        )
      );
      if (selectedCard && selectedCard.cardId === cardId) {
        setSelectedCard((prev) =>
          prev ? { ...prev, quantity: newQuantity } : null
        );
      }
    }
  };

  const removeCard = (cardId: number) => {
    setProxies((prev) => prev.filter((card) => card.cardId !== cardId));
  };

  const openCardPreview = (card: DeckCard) => {
    setSelectedCard(card);
    // Find the full card data from allCards or alternates
    const foundCard = allCards.find(
      (c) =>
        Number(c.id) === card.cardId ||
        c.alternates?.some((alt) => Number(alt.id) === card.cardId)
    );
    if (foundCard) {
      if (Number(foundCard.id) === card.cardId) {
        setSelectedFullCard(foundCard);
      } else {
        const altCard = foundCard.alternates?.find(
          (alt) => Number(alt.id) === card.cardId
        );
        setSelectedFullCard(altCard || foundCard);
      }
    } else {
      setSelectedFullCard(null);
    }
    setIsCardPreviewOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 flex items-end ${
          isAnimating ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`w-full max-h-[92vh] overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out ${
            isAnimating ? "translate-y-0" : "translate-y-full"
          }`}
        >
          {/* Handle for mobile */}
          <div className="flex justify-center py-3">
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 flex-shrink-0">
                    <Layers className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-slate-900">
                      Proxy Builder
                    </h2>
                    <p className="text-xs text-slate-500">
                      {totalCards} {totalCards === 1 ? "card" : "cards"}{" "}
                      selected
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stats Bar */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* Total Cards */}
                <div className="flex items-center gap-1.5 bg-purple-100 px-2.5 py-1.5 rounded-lg">
                  <Layers className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-bold text-purple-700">
                    {totalCards}
                  </span>
                  <span className="text-xs text-purple-500">proxies</span>
                </div>

                {/* Pages estimate */}
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                  <span className="text-sm font-bold text-slate-700">
                    {Math.ceil(totalCards / 9)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {Math.ceil(totalCards / 9) === 1 ? "page" : "pages"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div
            className="overflow-y-auto overflow-x-hidden px-4 pb-4"
            style={{ maxHeight: "calc(92vh - 250px)" }}
            ref={containerRef}
          >
            {proxies.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="max-w-sm mx-auto text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center">
                    <Layers className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    No Proxies Yet
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Click on cards to add them to your proxy list for printing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {proxies.map((proxy, index) => (
                  <div
                    key={`${proxy.cardId}-${index}`}
                    onClick={() => openCardPreview(proxy)}
                    className="cursor-pointer"
                  >
                    <div className="rounded-xl shadow-sm bg-white border border-slate-100 p-1.5 relative transition-all hover:shadow-md active:scale-[0.98]">
                      <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                        <img
                          src={getOptimizedImageUrl(proxy.src, "small")}
                          alt={proxy.name}
                          className="w-full h-full object-cover"
                          loading={index < 12 ? "eager" : "lazy"}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCardPreview(proxy);
                          }}
                          className="absolute top-0 right-0 bg-white/90 backdrop-blur-sm text-gray-600 rounded-tr-lg rounded-bl-lg p-1.5 z-10 border-l border-b border-gray-200 hover:bg-white hover:text-gray-900 active:scale-95 transition-all"
                          aria-label="View card details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="mt-1.5 text-center">
                              <span
                                className={`${oswald.className} text-[10px] font-medium text-slate-700`}
                              >
                                {proxy.code}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{proxy.set}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider> */}

                      {/* Quantity Control Bar - CardWithBadges style */}
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-2 py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(
                                proxy.cardId,
                                proxy.quantity - 1
                              );
                            }}
                            className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <div className="flex items-center justify-center">
                            <span className="text-white font-bold text-base">
                              {proxy.quantity}
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(
                                proxy.cardId,
                                proxy.quantity + 1
                              );
                            }}
                            className="h-7 w-7 rounded-md bg-white/15 text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with action buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                type="button"
                className="flex-1 h-12 text-red-600 border-2 border-red-300 hover:bg-red-50 font-semibold rounded-xl"
                onClick={() => setProxies([])}
                disabled={proxies.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Clear
              </Button>

              <Button
                onClick={() => {
                  handleClose();
                  setTimeout(onGeneratePDF, 350);
                }}
                disabled={proxies.length === 0}
                size="lg"
                className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Generate PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Card Preview Drawer */}
      <ProxyCardPreviewDrawer
        isOpen={isCardPreviewOpen}
        onClose={() => setIsCardPreviewOpen(false)}
        card={selectedCard}
        fullCard={selectedFullCard}
        onQuantityChange={handleQuantityChange}
        onRemove={removeCard}
      />
    </>
  );
};

export default ProxiesDrawer;
