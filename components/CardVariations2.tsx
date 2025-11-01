import { CardWithCollectionData } from "@/types";
import Link from "next/link";
import React, { useEffect, useRef } from "react";
import Alternates from "@/public/assets/images/variantsICON_VERTICAL.svg";

interface CardModalProps {
  alternatesCards?: CardWithCollectionData[] | null;
  setSelectedCard: (card: CardWithCollectionData) => void;
  setBaseSelected: (isBase: boolean) => void;
  baseCard: CardWithCollectionData;
  baseSelected: boolean | undefined;
  indexSelected: number;
  setIndexSelected: (index: number) => void;
  isHorizontal?: boolean;
}

const CardsVariations = ({
  alternatesCards,
  setSelectedCard,
  setBaseSelected,
  baseCard,
  baseSelected,
  indexSelected,
  setIndexSelected,
  isHorizontal = false,
}: CardModalProps) => {
  // Array de referencias para cada tarjeta
  const baseCardRef = useRef<HTMLDivElement | null>(null);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      let targetElement: HTMLDivElement | null = null;

      if (baseSelected && baseCardRef.current) {
        targetElement = baseCardRef.current;
      } else if (
        !baseSelected &&
        indexSelected !== null &&
        itemRefs.current[indexSelected]
      ) {
        targetElement = itemRefs.current[indexSelected];
      }

      if (targetElement) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const extraOffset = 16; // Espacio adicional en píxeles (ajusta este valor según necesidad)

        if (isHorizontal) {
          // Calcula el offset horizontal relativo al contenedor
          const offset =
            targetRect.left -
            containerRect.left +
            containerRef.current.scrollLeft -
            extraOffset;

          containerRef.current.scrollTo({
            left: offset,
            behavior: "smooth",
          });
        } else {
          // Scroll vertical (como ya tenías)
          const offset =
            targetRect.top -
            containerRect.top +
            containerRef.current.scrollTop -
            extraOffset;

          containerRef.current.scrollTo({
            top: offset,
            behavior: "smooth",
          });
        }
      }
    }
  }, [baseSelected, indexSelected, isHorizontal]);

  return (
    <div className="flex flex-col flex-1 min-h-0 max-h-auto md:max-h-[520px] overflow-auto">
      <div
        className={`border rounded-lg shadow p-4 overflow-auto flex-1 h-0 flex  gap-3 ${
          isHorizontal ? "flex-row" : " flex-col"
        }`}
        ref={containerRef}
      >
        <div
          ref={baseCardRef}
          className={`hover:bg-gray-200 border flex cursor-pointer flex-row gap-3 ${
            baseSelected === true && "bg-gray-200"
          } p-2 rounded-lg ${isHorizontal && "min-w-[240px]"}`}
          onClick={() => {
            baseCard && setSelectedCard(baseCard);
            setBaseSelected(true);
          }}
        >
          <img src={baseCard?.src} alt={baseCard?.name} className="w-[100px]" />

          <div className="flex flex-col gap-1 justify-center items-start">
            <p className="text-black font-bold text-xl">Base</p>
            {baseCard?.alias !== "0" || "" ? (
              <p className="text-sm">{baseCard?.alias}</p>
            ) : (
              <p className="text-sm">{baseCard?.sets[0].set?.title}</p>
            )}
            <Link
              href={`https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
                baseCard.name
              )}&Rarity=${encodeURIComponent(
                baseCard.rarity ?? ""
              )}&Color=${encodeURIComponent(
                baseCard.colors?.[0].color ?? ""
              )}&CardType=${encodeURIComponent(baseCard.category ?? "")}`}
              target="_blank"
              className="underline text-blue-500 font-bold text-[13px] md:text-md"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              View on tcg plager.com
            </Link>
          </div>
        </div>

        {alternatesCards &&
          alternatesCards.length > 0 &&
          alternatesCards.map((item, index) => (
            <div
              // Asigna la referencia a cada elemento
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              key={index}
              className={`hover:bg-gray-200 border flex cursor-pointer flex-row gap-3 ${
                indexSelected === index && !baseSelected && "bg-gray-200"
              } p-2 rounded-lg ${isHorizontal && "min-w-[240px] "}`}
              onClick={() => {
                setSelectedCard(item);
                setBaseSelected(false);
                setIndexSelected(index);
              }}
            >
              <img src={item.src} alt={item.name} className="w-[100px]" />

              <div className="flex flex-col gap-1 justify-center items-start">
                <p className="text-black font-bold text-xl">Alias</p>
                {item.alias !== "0" || "" ? (
                  <p className="text-sm">{item.alias}</p>
                ) : (
                  <p className="text-[13px] md:text-sm line-clamp-3">
                    {item.sets[0].set?.title}
                  </p>
                )}
                <Link
                  href={`https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
                    baseCard.name
                  )}&Rarity=${encodeURIComponent(
                    baseCard.rarity ?? ""
                  )}&Color=${encodeURIComponent(
                    baseCard.colors?.[0].color ?? ""
                  )}&CardType=${encodeURIComponent(baseCard.category ?? "")}`}
                  target="_blank"
                  className="underline text-blue-500 font-bold text-[13px] md:text-md"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  View on tcg plager.com
                </Link>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
export default CardsVariations;
