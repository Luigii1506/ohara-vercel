import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import { Oswald } from "next/font/google";
import { rarityFormatter } from "@/helpers/formatters";
import { getColors } from "@/helpers/functions";
import { useSwipeable } from "react-swipeable";
import { useI18n } from "@/components/i18n/I18nProvider";

interface CardPreviewProps {
  id: string;
  name: string;
  rarity: string;
  quantity: number;
  onQuantityChange: (newQuantity: number) => void;
  index: number;
  length: number;
  src: string;
  code: string;
  color: string;
  cost: string;
  onSwipeLeft?: () => void;
}

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function CardPreview({
  id,
  name,
  rarity,
  quantity,
  onQuantityChange,
  index,
  length,
  src,
  code,
  color,
  cost,
  onSwipeLeft,
}: CardPreviewProps) {
  const { t } = useI18n();
  const [showLargeImage, setShowLargeImage] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      onSwipeLeft && onSwipeLeft();
    },
    delta: 50, // Mínimo de píxeles para considerar el gesto
    trackTouch: true,
    trackMouse: false,
  });

  return (
    <div
      {...handlers}
      className={`w-full max-w-md bg-white rounded-lg shadow-sm ${
        index === length - 1 ? "mb-0" : "mb-3"
      }`}
    >
      <div
        className={`flex items-center justify-between 
          ${color === "Yellow" ? "text-black" : "text-white"}  
           rounded-t-md px-3 py-1`}
        style={{ backgroundColor: getColors(color) }}
      >
        <div className="flex items-center gap-5">
          <span className={`${oswald.className}`}>{code}</span>
          <span className="font-medium">{name}</span>
        </div>
        <span>{rarityFormatter(rarity)}</span>
      </div>

      <div className="flex items-center justify-between p-3 gap-3">
        <div
          className="rounded-full w-8 h-8 flex items-center justify-center"
          style={{ backgroundColor: getColors(color) }}
        >
          <span
            className={`
            text-sm font-bold ${
              color === "Yellow" ? "text-black" : "text-white"
            }
            `}
          >
            {cost.replace("Cost", "")}
          </span>
        </div>
        {/* Contenedor clickeable para mostrar la imagen en grande */}
        <div
          className="w-48 h-12 relative overflow-hidden rounded cursor-pointer"
          onClick={() => setShowLargeImage(true)}
        >
          <img
            src={src}
            alt={name}
            width={192}
            height={48}
            className="object-cover [object-position:0_-40px]"
          />
        </div>

        <div className="flex items-center gap-4 justify-between flex-1">
          <button
            onClick={() => quantity > 0 && onQuantityChange(quantity - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-2xl font-bold w-4 text-center">{quantity}</span>
          <button
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overlay para imagen ampliada */}
      {showLargeImage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              {t("cardPreview.tapToClose")}
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={src}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt=""
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>{code}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
