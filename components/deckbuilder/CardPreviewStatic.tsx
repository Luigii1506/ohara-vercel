import { Oswald } from "next/font/google";
import { getColors } from "@/helpers/functions";
import { rarityFormatter } from "@/helpers/formatters";
import { useState } from "react";

interface CardPreviewStaticProps {
  name: string;
  rarity: string;
  quantity: number;
  index: number;
  length: number;
  src: string;
  code: string;
  color: string;
  cost: string;
}

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function CardPreviewStatic({
  name,
  rarity,
  quantity,
  index,
  length,
  src,
  code,
  color,
  cost,
}: CardPreviewStaticProps) {
  const [showLargeImage, setShowLargeImage] = useState(false);

  return (
    <div
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
          <span className={`${oswald.className} `}>{code}</span>
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
        <div
          className="w-48 h-12 relative overflow-hidden rounded"
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

        <div className="flex items-center gap-4 justify-center flex-1">
          <span className="text-xl items-center justify-center text-center font-bold border border-[#000] text-[#000] rounded-full h-[40px] w-[40px] flex">
            {quantity}
          </span>
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
              Tap to close
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
