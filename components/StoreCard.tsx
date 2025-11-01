import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import React from "react";
import { CardWithCollectionData } from "@/types";
import { LazyLoadImage } from "react-lazy-load-image-component";
import Alternates from "@/public/assets/images/variantsICON_VERTICAL.svg";
import { Oswald } from "next/font/google";
import FruitIcon from "./Icons/Fruit";
import { rarityFormatter } from "@/helpers/formatters";
import CardDetails from "./CardDetails";
import { highlightText } from "@/helpers/functions";
import SpecialIcon from "./Icons/SpecialIcon";

interface StoreCard {
  card: CardWithCollectionData;
  searchTerm: string;
  viewSelected: "grid" | "list" | "alternate" | "text";
  selectedRarities: string[];
  selectedSets: string[];
  setSelectedCard: (card: CardWithCollectionData) => void;
  setBaseCard: (card: CardWithCollectionData) => void;
  setAlternatesCards: (cards: CardWithCollectionData[]) => void;
  setIsOpen: (isOpen: boolean) => void;
  onClick?: (card: CardWithCollectionData) => void; // Optional custom click handler
}

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const StoreCard: React.FC<StoreCard> = ({
  card,
  searchTerm,
  viewSelected,
  selectedRarities,
  selectedSets,
  setSelectedCard,
  setBaseCard,
  setAlternatesCards,
  setIsOpen,
  onClick, // Add the onClick parameter
}) => {
  // Función que retorna el src según selectedSets y preferredRarities
  const getCard = (): CardWithCollectionData => {
    // Si se enviaron selectedSets
    if (selectedSets.length > 0) {
      // Si la carta tiene algún set cuyo title esté en selectedSets, usar el src de la carta
      const cardHasSelectedSet = card.sets?.some((s) =>
        selectedSets.includes(s.set.title)
      );
      if (cardHasSelectedSet) {
        return card;
      }
      // Si no, buscar en las alternates aquella que tenga un set coincidente
      if (card.alternates && card.alternates.length > 0) {
        const altWithSet = card.alternates.find((alt) =>
          alt.sets.some((s) => selectedSets.includes(s.set.title))
        );
        if (altWithSet) {
          return altWithSet;
        }
      }
    }

    // Si se enviaron selectedRarities
    if (selectedRarities.length > 0) {
      // Si la rareza de la carta está en las preferidas, usar el src de la carta
      if (selectedRarities.includes(card?.rarity ?? "")) {
        return card;
      }
      // Si no, buscar en las alternates aquella que tenga alternateArt que coincida
      if (card.alternates && card.alternates.length > 0) {
        const altWithRarity = card.alternates.find((alt) =>
          selectedRarities.includes(alt.alternateArt ?? "")
        );
        if (altWithRarity) {
          return altWithRarity;
        }
      }
    }

    // Si no se cumple ninguna condición, retornar el src principal de la carta
    return card;
  };

  return (
    <div
      className="w-full mx-auto h-full"
      onClick={() => {
        console.log("🔄 StoreCard clicked, onClick provided:", typeof onClick);
        if (onClick && typeof onClick === "function") {
          onClick(getCard());
        } else {
          console.log("12");
          setSelectedCard(getCard());
          setBaseCard(card);
          setAlternatesCards(card.alternates);
          setIsOpen(true);
        }
      }}
    >
      <Card className="overflow-hidden h-full transition-shadow duration-300 hover:shadow-2xl">
        <CardContent className="p-[16px] h-full flex flex-col gap-4">
          <div className="flex items-center justify-between gap-[16px]">
            <div className="w-[45%] flex justify-center items-center">
              <img
                src={getCard().src}
                alt={card?.name}
                className="w-full"
                //effect="blur"
              />
            </div>
            <div className="h-full flex flex-col justify-between items-center w-[55%] relative">
              <div className="flex items-center justify-between flex-col mt-0 lg:mt-2 w-full">
                {card?.status === "Illegal" && (
                  <div className="bg-red-600 text-white text-xs font-bold  px-2 py-1 w-full text-center mb-1">
                    Banned Card
                  </div>
                )}
                <p
                  className="text-lg font-black break-words mb-1 lg:mb-2 text-center leading-tight line-clamp-2"
                  style={{
                    wordBreak: card?.name?.includes(" ")
                      ? "break-word"
                      : "break-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {highlightText(card?.name, searchTerm)}
                </p>

                <p
                  className={`${oswald.className} text-md text-black leading-[16px] mb-2 lg:mb-4 font-[400]`}
                >
                  {highlightText(card?.code, searchTerm)}
                </p>
                <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1 lg:mb-2">
                  <Badge
                    variant="secondary"
                    className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                  >
                    <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                      {card?.rarity ? rarityFormatter(card.rarity) : ""}
                    </span>
                  </Badge>
                </div>

                {card?.types.map((type) => (
                  <span
                    className="text-[13px] leading-[15px] font-[200] text-center line-clamp-1"
                    key={type.type}
                  >
                    {highlightText(type.type, searchTerm)}
                  </span>
                ))}
              </div>

              <div className="flex justify-center items-center w-full flex-row w-full">
                <div className="flex items-center gap-1">
                  <img
                    src={Alternates.src}
                    alt="eye"
                    className="w-[35px] h-[35px] mt-1"
                  />
                  <div className="flex items-center flex-col">
                    <span className="font-bold text-2xl text-black leading-[30px]">
                      {(card?.alternates.length ?? 0) + 1}
                    </span>
                    <span className="text-sm text-black leading-[13px]">
                      {card?.alternates.length === 0 ? "variant" : "variants"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {viewSelected === "text" && (
            <CardDetails card={card} searchTerm={searchTerm} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default StoreCard;
