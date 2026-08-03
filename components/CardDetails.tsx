import React, { useEffect, useState } from "react";
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
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t } = useI18n();
  // Use texts if available, otherwise fallback to effects
  const hasTexts = (card?.texts?.length ?? 0) > 0;
  const hasEffects = (card?.effects?.length ?? 0) > 0;
  const hasEffectContent = hasTexts || hasEffects;

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
                <h3 className="text-sm font-bold mb-2">
                  {t("cardDetails.familyType")}
                </h3>
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
                  title={t("cardDetails.cost")}
                  value={card?.cost?.replace("Cost", "") || "-"}
                  searchTerm={searchTerm}
                />
                <InfoItem
                  title={t("cardDetails.power")}
                  value={card?.power?.replace("Power", "") || "-"}
                  searchTerm={searchTerm}
                />
              </>
            )}

            {card?.counter && (
              <InfoItem
                title={t("cardDetails.counter")}
                value={card?.counter?.replace("Counter", "") || "-"}
                searchTerm={searchTerm}
              />
            )}
          </div>

          {card?.counter && isTextOnly && hasEffectContent && (
            <Separator />
          )}

          {!isTextOnly && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold mb-2">
                    {t("cardDetails.colors")}
                  </h3>
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
                    {t("cardDetails.attribute")}
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

              {hasEffectContent && <Separator />}
            </>
          )}

          {hasEffectContent && (
            <div className="relative">
              <h3 className="text-sm font-semibold mb-2">
                {t("cardDetails.effect")}
              </h3>
              <div className="space-y-1 text-[13px] text-black font-[200]">
                {/* Prefer texts, fallback to effects */}
                {hasTexts
                  ? card?.texts?.map((text, index) => (
                      <p key={index} className="text-justify whitespace-pre-line">
                        {highlightText(
                          text.text.replace(/\\n/g, "\n"),
                          searchTerm,
                          card?.conditions
                        )}
                      </p>
                    ))
                  : card?.effects?.map((effect, index) => (
                      <p key={index} className="text-justify whitespace-pre-line">
                        {highlightText(
                          effect.effect.replace(/\\n/g, "\n"),
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
                {t("cardDetails.trigger")}
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

        {/* Aviso de TCGplayer: pre-errata / no legal / reprint (solo versiones
            especiales). */}
        {card?.disclaimer && (
          <div className="mt-6 flex gap-2 items-start rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <span aria-hidden className="text-base leading-none mt-0.5">
              ⚠️
            </span>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wide mb-0.5">
                Aviso
              </h4>
              <p className="text-[12px] leading-relaxed">{card.disclaimer}</p>
            </div>
          </div>
        )}

        {/* ¿De qué booster/producto sale? */}
        {card?.id && <CardOrigins cardId={card.id} />}
      </CardContent>
    </Card>
  );
};

type OriginProduct = {
  id: number;
  name: string;
  productType: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  marketPrice: number | string | null;
  tcgUrl: string | null;
};

/** "Disponible en": los productos sellados del set de la carta. */
const CardOrigins: React.FC<{ cardId: string | number }> = ({ cardId }) => {
  const [products, setProducts] = useState<OriginProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cards/${cardId}/products`)
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => {
        if (!cancelled) setProducts(d.products ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  if (products.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-bold mb-2">Disponible en</h4>
      <div className="flex flex-col gap-1.5">
        {products.slice(0, 6).map((p) => {
          const price =
            p.marketPrice != null
              ? `$${Number(p.marketPrice).toLocaleString()}`
              : null;
          const inner = (
            <div className="flex items-center gap-2.5">
              {(p.thumbnailUrl || p.imageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnailUrl || p.imageUrl || ""}
                  alt=""
                  className="w-9 h-9 object-contain rounded bg-white shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-gray-500 capitalize">
                  {p.productType.replace(/_/g, " ").toLowerCase()}
                </p>
              </div>
              {price && (
                <span className="text-[12px] font-semibold text-emerald-600 shrink-0">
                  {price}
                </span>
              )}
            </div>
          );
          return p.tcgUrl ? (
            <a
              key={p.id}
              href={p.tcgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg p-1.5 hover:bg-gray-50 transition-colors"
            >
              {inner}
            </a>
          ) : (
            <div key={p.id} className="p-1.5">
              {inner}
            </div>
          );
        })}
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

export default CardDetails;
