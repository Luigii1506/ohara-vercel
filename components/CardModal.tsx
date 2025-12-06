import { rarityFormatter } from "@/helpers/formatters";
import { ShoppingCart, X } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { CardWithCollectionData } from "@/types";
import CardsVariations from "@/components/CardVariations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardDetailSkeleton } from "./skeletons";
import CardDetails from "./CardDetails";
import { Oswald } from "next/font/google";
import VerticalAlternatesIconInverted from "@/components/Icons/VerticalAlternatesIconInverted";
import CardRulings from "./CardRulings";
import Link from "next/link";

import { useCartStore, CartItem } from "@/store/cartStore";
import { useTcgplayerPrice } from "@/hooks/useTcgplayerPrice";

interface CardModalProps {
  selectedCard: CardWithCollectionData | undefined;
  setIsOpen: (isOpen: boolean) => void;
  alternatesCards?: CardWithCollectionData[];
  setSelectedCard: (card: CardWithCollectionData) => void;
  baseCard: CardWithCollectionData;
  isCardFetching?: boolean;
  setShowLargeImage?: (value: boolean) => void;
  showLargeImage?: boolean;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
}

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const CardModal: React.FC<CardModalProps> = ({
  selectedCard,
  setIsOpen,
  alternatesCards,
  setSelectedCard,
  baseCard,
  isCardFetching = false,
  setShowLargeImage,
  showLargeImage,
  onNavigatePrevious,
  onNavigateNext,
}) => {
  const [baseSelected, setBaseSelected] = React.useState<boolean | undefined>(
    false
  );

  const addItem = useCartStore((state) => state.addItem);
  const { data: tcgPrice, isLoading: tcgPriceLoading } = useTcgplayerPrice(
    baseCard?.tcgplayerProductId
  );
  const resolvedPrice =
    tcgPrice?.marketPrice ??
    tcgPrice?.midPrice ??
    tcgPrice?.lowPrice ??
    tcgPrice?.directLowPrice;
  const formatPrice = (price?: number) => {
    if (typeof price !== "number") return null;
    return `$${price.toFixed(2)}`;
  };

  // Función de ejemplo para agregar un item
  const handleAddItem = () => {
    const newItem: CartItem = {
      id: selectedCard?.id ?? "",
      name: selectedCard?.name ?? "Card name",
      price: 250,
      quantity: 1,
      src: selectedCard?.src,
      rarity: baseCard?.rarity,
    };

    console.log("Agregando item al carrito:", selectedCard);
    addItem(newItem);
  };

  const [indexSelected, setIndexSelected] = React.useState(0);
  const [isTouchable, setIsTouchable] = React.useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const deltaX = touchStartX.current - touchEndX.current;
    const threshold = 80; // Puedes ajustar este umbral según necesites

    if (deltaX > threshold) {
      // Swipe hacia la izquierda: pasa a la siguiente imagen
      handleRightArrow();
    } else if (deltaX < -threshold) {
      // Swipe hacia la derecha: vuelve a la imagen anterior
      handleLeftArrow();
    }
  };

  useEffect(() => {
    if (selectedCard) {
      if (selectedCard.isFirstEdition) {
        setBaseSelected(true);
      } else {
        const index = alternatesCards?.findIndex(
          (item) => item.id === selectedCard.id
        );
        setIndexSelected(index ?? 0);
        setBaseSelected(false);
      }
    }
  }, [selectedCard, alternatesCards]);

  const handleLeftArrow = () => {
    if (indexSelected === 0) {
      setBaseSelected(true);
      setSelectedCard(baseCard);
    } else {
      setIndexSelected(indexSelected - 1);
      if (alternatesCards) {
        setSelectedCard(alternatesCards[indexSelected - 1]);
      }
    }
  };

  const handleRightArrow = () => {
    if (
      alternatesCards &&
      indexSelected === alternatesCards.length - 1 &&
      !baseSelected
    ) {
    } else {
      if (baseSelected) {
        if (alternatesCards && alternatesCards?.length > 0) {
          setBaseSelected(false);
          setIndexSelected(0);
          if (alternatesCards) {
            setSelectedCard(alternatesCards[0]);
          }
        }
      } else {
        setBaseSelected(false);
        setIndexSelected(indexSelected + 1);
        if (alternatesCards) {
          setSelectedCard(alternatesCards[indexSelected + 1]);
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape: Cerrar modal
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      // Flechas Arriba/Abajo: Navegar entre alternates de la misma carta
      if (event.key === "ArrowUp") {
        handleLeftArrow();
      } else if (event.key === "ArrowDown") {
        handleRightArrow();
      }
      // Flechas Izquierda/Derecha: Navegar entre cartas principales
      else if (event.key === "ArrowLeft") {
        onNavigatePrevious?.();
      } else if (event.key === "ArrowRight") {
        onNavigateNext?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [indexSelected, baseCard, alternatesCards, baseSelected, onNavigatePrevious, onNavigateNext, setIsOpen]);

  useEffect(() => {
    if (!showLargeImage) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImage]);

  return (
    <div className="w-full max-w-[950px] max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden transition-shadow duration-300 relative">
      <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row md:justify-between items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[96px]">
        {!isCardFetching && (
          <>
            <div className="flex flex-col gap-2 justify-center items-center">
              <div className="flex items-center gap-2 w-max">
                <div className="hidden md:flex">
                  <VerticalAlternatesIconInverted color="#FFFFFF" size="42" />
                </div>
                <div className="flex items-center flex-col">
                  <span className="font-bold text-2xl md:text-3xl text-white leading-[24px] md:leading-[35px] mb-1 md:mb-0">
                    {(alternatesCards?.length ?? 0) + 1}
                  </span>
                  <span className="text-md md:text-md text-white leading-[16px] md:leading-[16px]">
                    {alternatesCards?.length === 0 ? "variant" : "variants"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center items-center w-full px-1">
              <div className="flex items-center gap-3 md:gap-5">
                <span
                  className={`${oswald.className}  text-sm md:text-lg font-[400]`}
                >
                  {baseCard?.code}
                </span>
                <span>|</span>
                <span className="text-sm md:text-lg">
                  {rarityFormatter(baseCard?.rarity)}
                </span>
                <span>|</span>
                <span className="md:text-lg">{baseCard?.category}</span>
              </div>
              <h1 className="text-md md:text-3xl font-bold text-center">
                {baseCard?.name}
              </h1>
              {baseCard?.tcgplayerProductId ? (
                <p className="text-xs md:text-sm text-emerald-200 mt-1">
                  {tcgPriceLoading
                    ? "Actualizando precio..."
                    : formatPrice(resolvedPrice) ?? "Precio no disponible"}
                </p>
              ) : null}
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close">
              <X className="h-[30px] w-[30px] md:h-[60px] md:w-[60px] text-white cursor-pointer" />
            </button>
          </>
        )}
      </div>

      <div className="p-3 md:p-6 overflow-y-auto overflow-x-hidden flex-1">
        <div className="flex flex-col md:flex-row gap-4 bg-white rounded-b-lg h-full relative">
          {!isCardFetching ? (
            <>
              {/* Imagen principal - Desktop */}
              <div className="relative flex-col justify-center items-center w-full lg:w-[50%] hidden md:flex">
                <div className="flex-1 w-full flex justify-center items-center flex-col gap-2">
                  <div className="px-3 cursor-pointer max-w-full">
                    <img
                      src={selectedCard?.src ?? ""}
                      alt={baseCard?.name}
                      className="object-contain w-full h-auto max-h-[60vh]"
                      onClick={() =>
                        setShowLargeImage && setShowLargeImage(true)
                      }
                    />
                  </div>

                  <div className="flex justify-center items-center flex-col gap-2 mt-2">
                    <div className="flex justify-center items-center flex-col gap-0">
                      <div className="text-center text-[16px] leading-[22px] px-2 line-clamp-1 font-[500]">
                        {selectedCard?.sets[0].set?.title}
                      </div>
                      <div className="text-center text-[14px] leading-[18px] font-[400]">
                        {selectedCard?.alias?.replace(/^\d+\s*/, "")}
                      </div>
                    </div>

                    <Link
                      href={
                        selectedCard?.tcgUrl && selectedCard.tcgUrl !== ""
                          ? selectedCard.tcgUrl
                          : `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
                              baseCard.name
                            )}&Rarity=${encodeURIComponent(
                              baseCard.rarity ?? ""
                            )}&Color=${encodeURIComponent(
                              baseCard.colors?.[0].color ?? ""
                            )}&CardType=${encodeURIComponent(
                              baseCard.category ?? ""
                            )}`
                      }
                      target="_blank"
                      className="underline text-blue-500 font-bold text-[13px]"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      View on tcg player.com
                    </Link>
                  </div>
                </div>
              </div>

              {/* Imagen principal - Mobile */}
              <div className="flex md:hidden w-full border rounded-lg relative p-3">
                <div className="relative flex flex-col justify-center items-center w-full gap-2">
                  <div
                    className="relative w-full cursor-pointer"
                    style={{
                      backgroundImage: `url(${selectedCard?.src})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      minHeight: "300px",
                    }}
                    onClick={() => {
                      if (isTouchable) {
                        setShowLargeImage && setShowLargeImage(true);
                      }
                    }}
                  ></div>
                  <div className="text-center text-[15px] leading-[17px]">
                    {selectedCard?.sets[0].set?.title}
                  </div>
                  <div className="text-center text-[13px] leading-[15px]">
                    {selectedCard?.alias?.replace(/^\d+\s*/, "")}
                  </div>

                  <Link
                    href={
                      selectedCard?.tcgUrl && selectedCard.tcgUrl !== ""
                        ? selectedCard.tcgUrl
                        : `https://www.tcgplayer.com/search/one-piece-card-game/product?productLineName=one-piece-card-game&page=1&view=grid&q=${encodeURIComponent(
                            baseCard.name
                          )}&Rarity=${encodeURIComponent(
                            baseCard.rarity ?? ""
                          )}&Color=${encodeURIComponent(
                            baseCard.colors?.[0].color ?? ""
                          )}&CardType=${encodeURIComponent(
                            baseCard.category ?? ""
                          )}`
                    }
                    target="_blank"
                    className="underline text-blue-500 font-bold text-[13px]"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    View on tcg player.com
                  </Link>
                </div>
              </div>

              {/* Tabs con Variants, Details y Rulings */}
              <Tabs
                defaultValue="variants"
                className="w-full md:h-full overflow-y-auto overflow-x-hidden pb-5 lg:w-[50%] overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <TabsList className="sticky top-0 z-10 grid w-full grid-cols-3 h-auto bg-gradient-to-b from-gray-50 to-white border-b-2 border-gray-200 p-1 rounded-t-lg shadow-sm">
                  <TabsTrigger
                    value="variants"
                    className="py-2.5 px-3 text-xs md:text-sm font-semibold rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-gray-100/50 relative data-[state=active]:border data-[state=active]:border-blue-200"
                  >
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="hidden sm:inline">Variants</span>
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        {(alternatesCards?.length ?? 0) + 1}
                      </span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="text"
                    className="py-2.5 px-3 text-xs md:text-sm font-semibold rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-gray-100/50 relative data-[state=active]:border data-[state=active]:border-blue-200"
                  >
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline">Details</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="rulings"
                    className="py-2.5 px-3 text-xs md:text-sm font-semibold rounded-md transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-gray-100/50 relative data-[state=active]:border data-[state=active]:border-blue-200"
                  >
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <span className="hidden sm:inline">Rulings</span>
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        {baseCard.rulings?.length ?? 0}
                      </span>
                    </span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="variants" className="overflow-y-auto p-2 max-h-[calc(96vh-280px)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-min">
                    {/* Base Card */}
                    <div
                      className={`cursor-pointer border-2 rounded-lg p-2 transition-all hover:shadow-lg ${
                        baseSelected ? "border-blue-500 shadow-md" : "border-gray-200"
                      }`}
                      onClick={() => {
                        setBaseSelected(true);
                        setSelectedCard(baseCard);
                      }}
                    >
                      <img
                        src={baseCard?.src ?? ""}
                        alt={baseCard?.name}
                        className="w-full h-auto rounded"
                      />
                      <div className="text-center text-xs mt-2 font-semibold">
                        Base
                      </div>
                      <div className="text-center text-xs text-gray-600 line-clamp-1">
                        {baseCard?.sets[0]?.set?.title}
                      </div>
                    </div>

                    {/* Alternate Cards */}
                    {alternatesCards?.map((alt, index) => (
                      <div
                        key={alt.id}
                        className={`cursor-pointer border-2 rounded-lg p-2 transition-all hover:shadow-lg ${
                          !baseSelected && indexSelected === index
                            ? "border-blue-500 shadow-md"
                            : "border-gray-200"
                        }`}
                        onClick={() => {
                          setBaseSelected(false);
                          setIndexSelected(index);
                          setSelectedCard(alt);
                        }}
                      >
                        <img
                          src={alt?.src ?? ""}
                          alt={alt?.name}
                          className="w-full h-auto rounded"
                        />
                        <div className="text-center text-xs mt-2 font-semibold">
                          {alt?.alternateArt || `Variant ${index + 1}`}
                        </div>
                        <div className="text-center text-xs text-gray-600 line-clamp-1">
                          {alt?.sets[0]?.set?.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="text" className="overflow-y-auto p-2 max-h-[calc(96vh-280px)]">
                  <div className="">
                    <CardDetails
                      card={baseCard}
                      searchTerm=""
                      isModal={true}
                      isTextOnly={false}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="rulings" className="overflow-y-auto p-2 max-h-[calc(96vh-280px)]">
                  <CardRulings
                    card={baseCard}
                    searchTerm=""
                    isModal={true}
                    isTextOnly={false}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="p-6">
              <CardDetailSkeleton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardModal;
