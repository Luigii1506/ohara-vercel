"use client";

import { ChevronDown, Eye, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getColors } from "@/helpers/functions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Deck, DeckCard as DeckCardType } from "@/types";

interface DeckCardProps {
  leaderCode: string;
  leaderCard: DeckCardType | undefined;
  decks: Deck[];
  selectedDeckUrl: string | null;
  onSelectDeck: (deck: Deck) => void;
  mode?: "user" | "shop" | "shop-admin";
}

const DeckCard: React.FC<DeckCardProps> = ({
  leaderCode,
  leaderCard,
  decks,
  selectedDeckUrl,
  onSelectDeck,
  mode = "user",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    // Solo expandir/contraer, no seleccionar automáticamente
    // El usuario debe elegir el deck que quiere ver
  };

  const handleDeckClick = (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectDeck(deck);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header - Collapsible Trigger */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 sm:p-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Leader Avatar */}
          {leaderCard && (
            <div className="relative h-12 w-12 flex-shrink-0 rounded-full sm:h-14 sm:w-14">
              {leaderCard.card?.colors && leaderCard.card.colors.length === 2 ? (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${getColors(
                      leaderCard.card.colors[0].color
                    )} 0%, ${getColors(
                      leaderCard.card.colors[0].color
                    )} 40%, ${getColors(
                      leaderCard.card.colors[1].color
                    )} 60%, ${getColors(
                      leaderCard.card.colors[1].color
                    )} 100%)`,
                  }}
                />
              ) : leaderCard.card?.colors && leaderCard.card.colors.length > 0 ? (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: getColors(leaderCard.card.colors[0].color),
                  }}
                />
              ) : null}
              <div
                className="absolute inset-1 rounded-full bg-cover bg-center"
                style={{
                  backgroundImage: `url(${leaderCard.card?.src})`,
                  backgroundSize: "150%",
                  backgroundPosition: "-20px -2px",
                }}
              />
            </div>
          )}

          {/* Leader Info */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
              {leaderCard?.card?.name || "Unknown Leader"}
            </h3>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0.5 sm:text-xs"
              >
                {leaderCard?.card?.code || leaderCode}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 sm:text-xs"
              >
                {decks.length} deck{decks.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          "grid overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0">
          <div className="border-t border-slate-100 bg-slate-50/50 p-2 sm:p-3">
            <div className="space-y-2">
              {decks.map((deck) => {
                const totalCards = deck.deckCards.reduce(
                  (sum, deckCard) => sum + deckCard.quantity,
                  0
                );
                const isComplete = totalCards === 51; // 50 + 1 leader
                const isSelected = selectedDeckUrl === deck.uniqueUrl;

                return (
                  <button
                    key={deck.uniqueUrl}
                    onClick={(e) => handleDeckClick(deck, e)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.98] sm:p-4",
                      isSelected
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                          {deck.name}
                        </h4>
                        {/* Status indicator */}
                        <div
                          className={cn(
                            "h-2 w-2 flex-shrink-0 rounded-full",
                            isComplete ? "bg-emerald-500" : "bg-amber-400"
                          )}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {totalCards} cartas
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckCard;
