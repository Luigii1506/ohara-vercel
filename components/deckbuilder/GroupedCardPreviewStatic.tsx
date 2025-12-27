import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Oswald } from "next/font/google";
import { rarityFormatter } from "@/helpers/formatters";
import { getColors } from "@/helpers/functions";
import { useSwipeable } from "react-swipeable";
import CeroCostIcon from "@/components/Icons/CeroCostIcon";
import OneCostIcon from "@/components/Icons/OneCostIcon";
import TwoCostIcon from "@/components/Icons/TwoCostIcon";
import ThreeCostIcon from "@/components/Icons/ThreeCostIcon";
import FourCostIcon from "@/components/Icons/FourCostIcon";
import FiveCostIcon from "@/components/Icons/FiveCostIcon";
import SixCostIcon from "@/components/Icons/SixCostIcon";
import SevenCostIcon from "@/components/Icons/SevenCostIcon";
import EightCostIcon from "@/components/Icons/EightCostIcon";
import NineCostIcon from "@/components/Icons/NineCostIcon";
import TenCostIcon from "@/components/Icons/TenCostIcon";
import { DeckCard } from "@/types";
import { useI18n } from "@/components/i18n/I18nProvider";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface GroupedCardPreviewProps {
  group: DeckCard[]; // todas las variantes de una misma carta (mismo code)
  index: number;
  length: number;
}

export default function GroupedCardPreviewStatic({
  group,
  index,
  length,
}: GroupedCardPreviewProps) {
  const { t } = useI18n();
  // Suponemos que todas comparten datos comunes
  const { code, name, rarity, color, cost } = group[0];
  const [showLargeImage, setShowLargeImage] = useState<number | null>(null);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      // Si deseas eliminar el grupo completo, podrías llamar a onSwipeLeft con algún identificador común.
      // Aquí lo dejamos vacío o podrías implementar otra lógica.
    },
    delta: 50,
    trackTouch: true,
    trackMouse: false,
  });

  const getCostIcon = (cost: string, color: string) => {
    switch (cost) {
      case "0 Cost":
        return <CeroCostIcon size="17" color={color} />;
      case "1 Cost":
        return <OneCostIcon size="17" color={color} />;
      case "2 Cost":
        return <TwoCostIcon size="17" color={color} />;
      case "3 Cost":
        return <ThreeCostIcon size="17" color={color} />;
      case "4 Cost":
        return <FourCostIcon size="17" color={color} />;
      case "5 Cost":
        return <FiveCostIcon size="17" color={color} />;
      case "6 Cost":
        return <SixCostIcon size="17" color={color} />;
      case "7 Cost":
        return <SevenCostIcon size="17" color={color} />;
      case "8 Cost":
        return <EightCostIcon size="17" color={color} />;
      case "9 Cost":
        return <NineCostIcon size="17" color={color} />;
      case "10 Cost":
        return <TenCostIcon size="21" color={color} />;
      default:
        return null;
    }
  };

  return (
    <div
      {...handlers}
      className={`w-full max-w-md bg-white rounded-lg shadow-sm ${
        index === length - 1 ? "mb-0" : "mb-3"
      }`}
    >
      {/* Encabezado común */}
      <div
        className={`flex items-center justify-between 
          ${color === "Yellow" ? "text-black" : "text-white"}  
           rounded-t-md px-3 py-1`}
        style={{ backgroundColor: getColors(color) }}
      >
        <div className="flex items-center gap-5">
          <div>
            {" "}
            {getCostIcon(cost ?? "", color === "Yellow" ? "#000" : "#fff")}{" "}
          </div>
          <span className={`${oswald.className}`}>{code}</span>
          <span className="font-medium">{name}</span>
        </div>
        <span>{rarityFormatter(rarity)}</span>
      </div>

      {/* Listado de variantes */}
      {group.map((card, index) => (
        <div
          key={card.cardId}
          className="flex items-center justify-between p-3 gap-3 border-b last:border-b-0"
        >
          {/* Imagen de la variante */}
          <div
            className="w-2/3 h-12 relative overflow-hidden rounded cursor-pointer"
            onClick={() => setShowLargeImage(card.cardId)}
          >
            <img
              src={card.src}
              alt={name}
              height={48}
              className="object-cover [object-position:0_-40px]"
            />
            <div>
              <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 px-1 rounded text-white line-clamp-1 text-[13px]">
                {card?.set}
              </span>
            </div>
          </div>

          {/* Controles de cantidad para esta variante */}
          <div className="flex items-center gap-4 justify-center flex-1">
            <span className="text-4xl font-bold w-4 text-center mb-1">
              {card.quantity}
            </span>
          </div>
        </div>
      ))}

      {/* Overlay para imagen ampliada de la variante seleccionada */}
      {showLargeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(null)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              {t("cardPreview.tapToClose")}
            </div>

            {group
              .filter((card) => card.cardId === showLargeImage)
              .map((card) => (
                <div className="flex flex-col items-center gap-3 px-5 mb-3">
                  <img
                    key={card?.cardId}
                    src={card?.src}
                    className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                    alt=""
                  />
                  <div className="text-white text-lg font-[400] text-center px-5">
                    <span className={`${oswald.className} font-[500]`}>
                      {card?.code}
                    </span>
                    <br />
                    <span>{card?.set}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
