"use client";

import React from "react";
import { CardWithCollectionData } from "@/types";
import { Star, Info, X } from "lucide-react";
import VerticalAlternatesIconInverted from "@/components/Icons/VerticalAlternatesIconInverted";
import { Oswald } from "next/font/google";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface DonModalProps {
  selectedCard: CardWithCollectionData | undefined;
  baseCard: CardWithCollectionData;
  alternatesCards?: CardWithCollectionData[];
  setSelectedCard: (card: CardWithCollectionData) => void;
  setIsOpen: (isOpen: boolean) => void;
}

const DonModal: React.FC<DonModalProps> = ({
  selectedCard,
  baseCard,
  alternatesCards = [],
  setSelectedCard,
  setIsOpen,
}) => {
  const activeCard = selectedCard ?? baseCard;
  const variants = React.useMemo(() => {
    const list: CardWithCollectionData[] = [baseCard];
    if (alternatesCards.length) {
      alternatesCards.forEach((card) => {
        if (!list.find((entry) => entry.id === card.id)) {
          list.push(card);
        }
      });
    }
    return list;
  }, [baseCard, alternatesCards]);

  const handleVariantClick = (card: CardWithCollectionData) => {
    setSelectedCard(card);
  };

  if (!activeCard) return null;

  const variantCount = variants.length;
  const primarySet = activeCard.sets?.[0]?.set;
  const setLabel = primarySet
    ? primarySet.code
      ? `${primarySet.code} · ${primarySet.title}`
      : primarySet.title
    : "Sin set";
  const headerCard = baseCard;

  return (
    <div className="w-full max-w-[950px] max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden transition-shadow duration-300 relative">
      <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row md:justify-between items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[96px]">
        <div className="flex flex-col gap-2 justify-center items-center">
          <div className="flex items-center gap-2 w-max">
            <div className="hidden md:flex">
              <VerticalAlternatesIconInverted color="#FFFFFF" size="42" />
            </div>
            <div className="flex items-center flex-col">
              <span className="font-bold text-2xl md:text-3xl text-white leading-[24px] md:leading-[35px] mb-1 md:mb-0">
                {variantCount}
              </span>
              <span className="text-md md:text-md text-white leading-[16px] md:leading-[16px]">
                {variantCount === 1 ? "variante" : "variantes"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center w-full px-1 text-center gap-2">
          <div className="flex items-center gap-3 md:gap-5 text-sm md:text-lg">
            <span className={`${oswald.className} font-[400]`}>
              {headerCard.setCode || "DON"}
            </span>
            <span>|</span>
            <span className="md:text-lg">{headerCard.category}</span>
          </div>
          <h1 className="text-md md:text-3xl font-bold text-center">
            {headerCard.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close"
        >
          <X className="h-[30px] w-[30px] md:h-[40px] md:w-[40px] text-white cursor-pointer" />
        </button>
      </div>

      <div className="p-3 md:p-6 overflow-y-auto overflow-x-hidden flex-1">
        <div className="flex flex-col md:flex-row gap-6 h-full">
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <img
              src={activeCard.src}
              alt={activeCard.name}
              className="object-contain w-full max-h-[60vh] rounded-lg"
            />
          </div>

          <div className="w-full md:w-1/2 flex flex-col gap-6">
            {variants.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Star className="h-4 w-4" />
                    <span>Variantes</span>
                  </div>
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {variants.map((variant) => {
                      const isBase = variant.id === baseCard.id;
                      const displayName = isBase
                        ? `${variant.name} (Base)`
                        : variant.alias || variant.name;
                      const displaySet =
                        variant.sets?.[0]?.set?.title || variant.setCode || "Sin set";

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleVariantClick(variant)}
                          className={`flex flex-col rounded-lg border p-3 text-left transition ${
                            variant.id === activeCard.id
                              ? "border-blue-500 bg-blue-50/70 shadow-sm"
                              : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/40"
                          }`}
                        >
                          <img
                            src={variant.src}
                            alt={variant.name}
                            className="w-full h-auto rounded-md shadow"
                          />
                          <div className="mt-2 space-y-1">
                            {displayName ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm font-semibold text-slate-900 line-clamp-1 cursor-help">
                                    {displayName}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{displayName}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {displaySet ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-slate-500 line-clamp-1 cursor-help">
                                    {displaySet}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{displaySet}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 ">
                  <Info className="h-4 w-4" />
                  <span>Detalles</span>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm text-slate-600">
                {activeCard.alias ? (
                  <p className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      Alias
                    </span>
                    <span className="text-base font-medium text-slate-900">
                      {activeCard.alias}
                    </span>
                  </p>
                ) : null}
                <p className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Set
                  </span>
                  <span className="text-base font-medium text-slate-900">
                    {setLabel}
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonModal;
