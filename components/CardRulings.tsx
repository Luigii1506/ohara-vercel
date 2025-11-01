import React from "react";
import { CardWithCollectionData } from "@/types";
import { highlightText, getColors } from "@/helpers/functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import SpecialIcon from "@/components/Icons/SpecialIcon";
import RangedIcons from "@/components/Icons/RangedIcons";
import WisdomIcons from "@/components/Icons/WisdomIcons";
import SlashIcon from "@/components/Icons/SlashIcon";
import StrikeIcon from "@/components/Icons/StrikeIcon";

interface CardRulingsProps {
  card: CardWithCollectionData | undefined;
  searchTerm: string;
  isModal?: boolean;
  isTextOnly?: boolean;
}

const CardRulings: React.FC<CardRulingsProps> = ({
  card,
  searchTerm,
  isModal,
  isTextOnly = true,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 max-h-auto md:max-h-[520px] overflow-auto">
      <div
        className={`border rounded-lg shadow p-4 overflow-auto flex-1 h-0 flex  gap-3 `}
      >
        <div
          className={` ${
            !isTextOnly || card?.counter ? "space-y-3 " : "space-y-0 "
          } pt-0`}
        >
          {card?.rulings && card?.rulings.length > 0 ? (
            card?.rulings.map((ruling, index) => (
              <div
                key={index}
                className={`${
                  index === (card?.rulings?.length ?? 0) - 1
                    ? "pb-2 md:pb-5"
                    : "pb-0"
                }`}
              >
                <h3 className="text-[13px] font-bold mb-2">
                  Q. &nbsp;&nbsp;&nbsp;&nbsp;
                  {/* {highlightText(ruling.question, searchTerm)} */}
                  {highlightText(ruling.question, searchTerm)}
                </h3>
                <div
                  className={`text-[13px] font-[200] ${
                    card?.rulings && index < card.rulings.length - 1
                      ? "mb-5"
                      : "mb-0"
                  } `}
                >
                  A. &nbsp;&nbsp;&nbsp;&nbsp;{" "}
                  {/* {highlightText(ruling.answer, searchTerm)} */}
                  {highlightText(ruling.answer, searchTerm)}
                </div>
                {card?.rulings && index < card.rulings.length - 1 && (
                  <Separator />
                )}
              </div>
            ))
          ) : (
            <div>
              <h3 className="text-sm font-bold">No rulings available</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoItem: React.FC<{
  title: string;
  value: string;
  searchTerm: string;
}> = ({ title, value, searchTerm }) => (
  <div>
    <h3 className="text-sm font-bold mb-1">{title}</h3>
    <div className="flex flex-row items-center justify-center gap-[1px]">
      <p className="text-[13px] font-[200]">
        {highlightText(value, searchTerm)}
      </p>
    </div>
  </div>
);

export default CardRulings;
