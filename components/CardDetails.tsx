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

interface CardInfoProps {
  card: CardWithCollectionData | undefined;
  searchTerm: string;
  isModal?: boolean;
  isTextOnly?: boolean;
}

const CardDetails: React.FC<CardInfoProps> = ({
  card,
  searchTerm,
  isModal,
  isTextOnly = true,
}) => {
  return (
    <Card className="w-full max-w-2xl mx-auto border rounded-lg shadow  py-4 h-full">
      <CardContent className="h-full flex justify-between flex-col relative pb-1 px-4 md:px-6">
        <div
          className={` flex flex-col-reverse md:flex-col ${
            !isTextOnly || card?.counter ? "gap-3" : "gap-0 "
          } pt-0`}
        >
          {isModal && (
            <>
              <div>
                <h3 className="text-sm font-bold mb-2">Family type</h3>
                <div className="text-[13px] font-[200]">
                  {card?.types?.map((type, index) => (
                    <p key={index} className="text-justify">
                      - {highlightText(type.type, searchTerm)}
                    </p>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          <div className="flex items-center justify-between">
            {!isTextOnly && (
              <>
                <InfoItem
                  title="Cost"
                  value={card?.cost?.replace("Cost", "") || "-"}
                  searchTerm={searchTerm}
                />
                <InfoItem
                  title="Power"
                  value={card?.power?.replace("Power", "") || "-"}
                  searchTerm={searchTerm}
                />
              </>
            )}

            {card?.counter && (
              <InfoItem
                title="Counter"
                value={card?.counter?.replace("Counter", "") || "-"}
                searchTerm={searchTerm}
              />
            )}
          </div>

          {card?.counter && isTextOnly && (card.texts?.length ?? 0) > 0 && (
            <Separator />
          )}

          {!isTextOnly && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold mb-2">Colors</h3>
                  <div className="flex flex-wrap gap-2">
                    {card?.colors.map((color, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <div
                          style={{ backgroundColor: getColors(color.color) }}
                          className="w-3 h-3 rounded-full"
                        />
                        <span>{highlightText(color.color, searchTerm)}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2 text-right">
                    Attribute
                  </h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {card?.attribute ? (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <div>
                          {card?.attribute === "Special" && (
                            <SpecialIcon size="16" color="#b63d88" />
                          )}
                          {card?.attribute === "Ranged" && (
                            <RangedIcons size="16" color="#d43f42" />
                          )}
                          {card?.attribute === "Wisdom" && (
                            <WisdomIcons size="16" color="#05a576" />
                          )}
                          {card?.attribute === "Slash" && (
                            <SlashIcon size="16" color="#0080a5" />
                          )}
                          {card?.attribute === "Strike" && (
                            <StrikeIcon size="16" color="#deaa08" />
                          )}
                        </div>
                        <span>
                          {highlightText(card?.attribute, searchTerm)}
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-center">-</span>
                    )}
                  </div>
                </div>
              </div>

              {(card?.texts?.length ?? 0) > 0 && <Separator />}
            </>
          )}

          {(card?.texts?.length ?? 0) > 0 && (
            <div className="relative">
              <h3 className="text-sm font-semibold mb-2">Effect</h3>
              <div className="space-y-1 text-[13px] text-black font-[200]">
                {card?.texts?.map((text, index) => (
                  <p key={index} className="text-justify whitespace-pre-line">
                    {highlightText(
                      text.text.replace(/\\n/g, "\n"), // Reemplaza literal "\n" por un salto de línea real
                      searchTerm,
                      card?.conditions
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {card?.triggerCard && (
          <div className="mt-10">
            <div className="relative">
              <div
                className="bg-[#fae92e] w-fit px-2 absolute top-[-18px] left-0 z-50 text-[13px] leading-[16px] py-1 font-bold pr-[18px]"
                style={{
                  clipPath: "polygon(0 0, 100% 0%, 80% 100%, 0% 100%)",
                }}
              >
                Trigger
              </div>
              <div className="relative bg-black w-full text-white  flex flex-row justify-start items-start">
                <p className="text-[13px] leading-[16px] font-[200]  px-2 py-3 text-white">
                  <span>
                    {highlightText(
                      card?.triggerCard,
                      searchTerm,
                      card?.conditions
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

export default CardDetails;
