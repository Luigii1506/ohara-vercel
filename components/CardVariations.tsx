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
  isTouchable?: boolean;
}

const CardsVariations = ({
  alternatesCards,
  setSelectedCard,
  setBaseSelected,
  baseCard,
  baseSelected,
  indexSelected,
  setIndexSelected,
  isTouchable = true,
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
  }, [baseSelected, indexSelected]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`flex-1 h-0 flex gap-3 flex-col p-2 `} ref={containerRef}>
        <div
          ref={baseCardRef}
          className={`hover:bg-gray-200 border flex cursor-pointer flex-col gap-2 md:gap-3 ${
            baseSelected === true && "bg-gray-200"
          } p-2 rounded-lg `}
          onClick={() => {
            if (isTouchable) {
              baseCard && setSelectedCard(baseCard);
              setBaseSelected(true);
            }
          }}
        >
          <div className="m-auto">
            <img
              src={baseCard?.src}
              alt={baseCard?.name}
              className="w-[100px]"
            />
          </div>

          <p className="text-[12px] leading-[15px]  line-clamp-2 text-center">
            {baseCard?.sets[0].set?.title}
          </p>
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
              className={` hover:bg-gray-200 border flex cursor-pointer flex-col gap-2 md:gap-3 ${
                indexSelected === index && !baseSelected && "bg-gray-200"
              } p-2 rounded-lg `}
              onClick={() => {
                if (isTouchable) {
                  setSelectedCard(item);
                  setBaseSelected(false);
                  setIndexSelected(index);
                }
              }}
            >
              <div className="m-auto">
                <img src={item.src} alt={item.name} className="w-[100px]" />
              </div>

              <p className="text-[12px] leading-[15px]  line-clamp-2 text-center">
                {item.sets[0].set?.title}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};
export default CardsVariations;
