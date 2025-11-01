import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Check from "@/public/assets/images/check_icon.png";
import Cross from "@/public/assets/images/cross_icon.png";
import { rarityFormatter } from "@/helpers/formatters";
interface CardProps {
  type?: string;
  src?: string;
  code?: string;
  rarity?: string;
  mobileheight?: string;
  isLabelShown?: boolean;
  isUnpacked?: boolean;
  totalInCollection?: {
    id: string;
    quantity: number;
  }[];
  totalQuantity?: number;
  isSelectable?: boolean;
  cardId?: string;
  isInCollection?: boolean;
  index?: number;
  addToCollection?: (
    index: number | null,
    newValue: number,
    _id: string | null,
    code: string | null
  ) => void;
  setName?: string | [{ title: string; _id: string }];
}
type StyleObject = { [key: string]: string };

const Card: React.FC<CardProps> = ({
  type,
  src,
  code,
  rarity,
  mobileheight,
  isLabelShown,
  isUnpacked,
  totalInCollection,
  totalQuantity,
  isSelectable,
  cardId,
  isInCollection,
  index,
  addToCollection,
  setName,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [style, setStyle] = useState({});

  const parseStyle = (styleString: string): StyleObject => {
    return styleString.split(";").reduce<StyleObject>((styles, style) => {
      const [property, value] = style.split(":").map((part) => part.trim());
      if (property && value) {
        const camelCaseProperty = property.replace(
          /-([a-z])/g,
          (match, letter) => letter.toUpperCase()
        );
        styles[camelCaseProperty] = value;
      }
      return styles;
    }, {});
  };

  return (
    <section className="w-full">
      <style ref={styleRef}></style>
      <div
        ref={cardRef}
        data-index={`${index}`}
      >
        <img src={src} alt={"Card"} className={"drop-shadow-md"}/>
        {isLabelShown && (
          <div
            className="z-50 flex flex-row w-[81%] lg:w-[78%] bg-black absolute top-0 bottom-0 left-0 right-0 m-auto h-[65px] lg:h-[65px] rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="w-[25%] flex justify-center items-center">
              {isSelectable ? (
                <Image
                  src={isInCollection ? Check : Cross}
                  alt="check"
                  width={484}
                  height={484}
                  className="object-contain p-[3px] lg:p-[10px]"
                />
              ) : (
                <div className="bg-white w-[35px] h-[35px] rounded-full flex justify-center items-center text-black">
                  {totalInCollection?.length}/{totalQuantity}
                </div>
              )}
            </div>
            <div className="px-[2px] w-[50%] flex justify-center items-center flex-col">
              <p className="text-white text-center font-bold text-xl leading-[20px]">
                {code?.split("-")[1]}
              </p>
              <p className="text-white text-center text-[10px] leading-[12px]">
                {Array.isArray(setName) && setName.length > 0
                  ? setName[0].title
                  : typeof setName === "string"
                  ? setName
                  : ""}
              </p>
            </div>
            <div className="w-[25%] flex flex-col justify-center items-center">
              <div className="bg-white  w-[25px] lg:w-[30px] rounded-lg flex justify-center items-center">
                <span className=" text-black text-[12px]">
                  {rarityFormatter(rarity)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Card;
