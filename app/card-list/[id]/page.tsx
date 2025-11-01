"use client";

import React, { useEffect, useState, Fragment, useRef } from "react";
import { CardWithCollectionData, CardWithQuantity } from "@/types";
import Card from "@/components/Card";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useUser } from "@/app/context/UserContext";
import { CardDetailSkeleton } from "@/components/skeletons";
import { rarityFormatter } from "../../../helpers/formatters";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import Image from "next/image";
import SearchFilters from "@/components/home/SearchFilters";
import Breadcrumb from "@/components/Breadcrumbs";

const CardList = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  const [cards, setCards] = useState<CardWithCollectionData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardWithCollectionData>();
  const [relatedCards, setRelatedCards] = useState<CardWithQuantity[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const { userId } = useUser();
  const [cardQuantity, setCardQuantity] = useState<number>(0);
  const [sortedCards, setSortedCards] = useState<CardWithCollectionData[]>([]);
  const [isClosable, setIsClosable] = useState(true);
  let [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<number[]>();
  const [lastUpdatedIndex, setLastUpdatedIndex] = useState<number | null>(null);
  const [isCardFetching, setIsCardFetching] = useState(false);
  const [isBigModal, setIsBigModal] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardsWithVariations, setCardsWithVariations] = useState<
    CardWithCollectionData[]
  >([]);
  const [search, setSearch] = useState("");
  const [initialCards, setInitialCards] = useState<CardWithCollectionData[]>(
    []
  );
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedColor, setSelectedColor] = useState("");

  const addToCollection = async (
    index: number | null,
    newValue: number,
    _id: string | null,
    code: string | null
  ) => {
    let cardId;
    let codeCard;
    if (index !== null) {
      cardId = relatedCards[index]._id;
      codeCard = relatedCards[index].code;
    } else {
      cardId = _id;
      codeCard = code;
    }
    const quantity = newValue;
    try {
      const res = await fetch(`/api/collection/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: cardId,
          quantity: quantity,
          setCode: id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        //setSortedCards(data);
        const responseId = data?.card?.cardId;
        const updatedCards = cardsWithVariations.map((card) => {
          if (card._id === responseId) {
            return {
              ...card,
              isInCollection: quantity > 0,
            };
          }
          return card;
        });
        setCardsWithVariations(updatedCards);
      } else {
        console.error("Error al guardar la carta:", data.message);
      }
    } catch (error) {
      console.error("Error de conexión:", error);
    } finally {
      setIsClosable(true);
    }
  };
  const cleanData = () => {
    setSelectedCard(undefined);
    setCardQuantity(0);
    setRelatedCards([]);
    setValues([]);
    setLastUpdatedIndex(null);
  };

  const updateValue = (index: number, newValue: number) => {
    const updatedValues = [...(values || [])];
    updatedValues[index] = newValue;
    setValues(updatedValues);
    setLastUpdatedIndex(index);
  };

  const fetchCard = async (cardId: string) => {
    setIsCardFetching(true);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}?userId=${userId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch cards");
      }
      const data = await res.json();
      setCardQuantity(data.card.quantity);
      setRelatedCards(data.relatedCards);
      setValues(
        data.relatedCards.map((card: CardWithQuantity) => card.quantity)
      );
      return data;
    } catch (error) {
      console.log("prr", error);
      console.error(error);
    } finally {
      setIsCardFetching(false);
    }
  };

  const updateCards = (id: string, cardQuantity: number) => {
    if (userId === null) return;
    const codeCard = selectedCard?.code;
    const cardId = id;
    const quantity = cardQuantity;

    const updatedCards = cards.map((card) => {
      if (card.code === codeCard) {
        const cardInCollection = card.totalInCollection.find(
          (cardInCollection) => cardInCollection.id === cardId
        );

        let updatedTotalInCollection;

        if (quantity === 0 && cardInCollection) {
          updatedTotalInCollection = card.totalInCollection.filter(
            (cardInCollection) => cardInCollection.id !== cardId
          );
        } else if (quantity > 0 && !cardInCollection) {
          updatedTotalInCollection = [
            ...card.totalInCollection,
            { id: cardId, quantity: quantity },
          ];
        } else {
          updatedTotalInCollection = card.totalInCollection;
        }

        return {
          ...card,
          totalInCollection: updatedTotalInCollection,
        };
      }
      return card;
    });

    setCards(updatedCards as CardWithCollectionData[]);
  };

  const handleCardClick = async (card: CardWithCollectionData) => {
    setCurrentCode(card.code);
    if (selectedCardId === card._id) {
      setSelectedCardId(null);
      setCardsWithVariations(initialCards);
      setCurrentCode(null);
      return;
    }
    // Si no está expandida, la expandimos y obtenemos las variaciones
    setSelectedCardId(card._id);
    //setRelatedCardReady(false);
    const variations = await fetchCard(card._id);
    const newCardsArray: CardWithCollectionData[] = [];
    (initialCards ?? []).forEach((item, index) => {
      newCardsArray.push(item);
      if (item._id === card._id && variations.relatedCards) {
        const firstCard = variations.card;
        firstCard.isSelectable = true;
        firstCard.isInCollection = card.totalInCollection?.some(
          (c: { id: string }) => c.id === firstCard._id
        );
        newCardsArray.push(firstCard);
        const updatedVariations = variations.relatedCards.map(
          (relatedCard: CardWithCollectionData) => ({
            ...relatedCard,
            isSelectable: true,
            attribute: firstCard.attribute,
            category: firstCard.category,
            code: firstCard.code,
            colors: firstCard.colors,
            conditions: firstCard.conditions,
            cost: firstCard.cost,
            counter: firstCard.counter,
            effects: firstCard.effects,
            life: firstCard.life,
            power: firstCard.power,
            rarity: firstCard.rarity,
            setCode: firstCard.setCode,
            status: firstCard.status,
            texts: firstCard.texts,
            trigger: firstCard.trigger,
            types: firstCard.types,
            //set: null,
            set: firstCard.set,
            isInCollection: card.totalInCollection?.some(
              (c: { id: string }) => c.id === relatedCard._id
            ),
          })
        );
        newCardsArray.push(...updatedVariations);
      }
    });
    setCardsWithVariations(newCardsArray); // Actualizamos el grid
    // setRelatedCardReady(true);
  };

  const filterCard = cardsWithVariations.filter((card) => {
    const codePart = card.code.split("-")[1] ?? ""; // Extrae la parte después del guion en el código
    return (
      card.name.toLowerCase().includes(search.toLowerCase()) ||
      codePart.toLowerCase() === search.toLowerCase() ||
      (card.cost ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  useEffect(() => {
    if (id === "" && userId !== null) return;
    const fetchCards = async () => {
      try {
        const res = await fetch(`/api/admin/cards?setCode=${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }
        const cards = await res.json();
        setCards(cards);
        setIsDataReady(true);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCards();
  }, [id, userId]);

  useEffect(() => {
    if (
      lastUpdatedIndex !== null &&
      selectedCard &&
      values &&
      relatedCards.length > 0 &&
      userId !== null
    ) {
      updateCards(relatedCards[lastUpdatedIndex]._id, values[lastUpdatedIndex]);
      const debounceTimeout = setTimeout(() => {
        if (values && lastUpdatedIndex !== null) {
          addToCollection(
            lastUpdatedIndex,
            values[lastUpdatedIndex],
            null,
            null
          );
        }
      }, 700);

      return () => clearTimeout(debounceTimeout);
    }
  }, [values, lastUpdatedIndex]);

  useEffect(() => {
    if (!selectedCard || userId !== null) return;
    updateCards(selectedCard._id, cardQuantity);
    const debounceTimeout = setTimeout(() => {
      addToCollection(
        null,
        cardQuantity,
        selectedCard._id ? selectedCard._id : null,
        selectedCard.code ? selectedCard.code : null
      );
    }, 700);

    return () => clearTimeout(debounceTimeout);
  }, [cardQuantity]);

  useEffect(() => {
    if (cards) {
      const sortedCards = cards.sort((a, b) => {
        const lastThreeDigitsA = a.code?.slice(-3);
        const lastThreeDigitsB = b.code?.slice(-3);
        return lastThreeDigitsA?.localeCompare(lastThreeDigitsB);
      });
      setInitialCards(sortedCards);
      setCardsWithVariations(sortedCards);
    }
  }, [cards]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current) return;

      const clickedElement = event.target as HTMLElement;
      const currentIndex = clickedElement.dataset.index;

      if (!currentIndex) {
        setSelectedCardId(null);
        setCardsWithVariations(initialCards);
        setCurrentCode(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [cardsWithVariations]);

  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <CardDetailSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 pt-8 md:py-8 sm:px-[50px] md:px-[100px] overflow-y-scroll flex-1">
      <Breadcrumb />
      {/* Page Title */}
      <h1
        className={
          "title text-lg md:text-3xl mb-8 md:mb-14 text-[#938156] text-left"
        }
      >
        CARD LIST
      </h1>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setIsOpen(false);
          }}
          ref={modalRef}
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel className="w-full max-w-4xl space-y-4 border  shadow-xl transform transition-all rounded-lg">
                {isCardFetching ? (
                  <div
                    // className={`
                    //   ${isBigModal ? "h-[773px]" : "h-[375px]"}
                    //   flex justify-center items-center flex-1`}
                    className={`h-[773px] flex justify-center items-center flex-1`}
                  >
                    <div className="p-6 w-full bg-white rounded-lg">
                      <CardDetailSkeleton />
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[950px] mx-auto">
                    <div className="relative bg-black text-white p-4 flex items-center justify-between flex-col">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-medium">
                          {selectedCard?.code}
                        </span>
                        <span className="text-lg">
                          {rarityFormatter(selectedCard?.rarity)}
                        </span>
                        <span className="text-lg">
                          {selectedCard?.category}
                        </span>
                      </div>
                      <h1 className="text-3xl font-bold">
                        {selectedCard?.name}
                      </h1>

                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute w-[35px] h-[35px] lg:w-[40px] lg:h-[40px] top-2 right-2 m-auto
                 flex justify-center items-center rounded-full
                 bg-white/90 hover:bg-white
                 border-0 shadow-sm
                 transition-all duration-200 ease-in-out"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close"
                      >
                        <X className="h-5 w-5 text-gray-900" />
                      </Button>
                    </div>

                    <div
                      className="flex gap-6 p-6 bg-white  flex-col lg:flex-row overflow-auto"
                      style={{
                        maxHeight: "calc(100dvh - 150px)",
                      }}
                    >
                      <div
                        className={`relative flex justify-center items-center`}
                      >
                        {/* <Card src={selectedCard?.src} mobileheight="h-full" /> */}

                        <div className="w-[455px] rounded-lg">
                          <Zoom
                            zoomMargin={0} // Sin margen para aprovechar el espacio
                          >
                            <Image
                              src={selectedCard?.src ?? ""}
                              alt="check"
                              width={484}
                              height={484}
                              className="object-contain"
                            />
                          </Zoom>
                        </div>
                      </div>

                      <div className="space-y-6 flex flex-1 flex-col">
                        <div className="grid grid-cols-2 gap-4">
                          {selectedCard && selectedCard.cost && (
                            <div>
                              <h3 className="text-xl font-bold">Cost</h3>
                              <p className="text-lg">{selectedCard.cost}</p>
                            </div>
                          )}

                          {selectedCard && selectedCard.life && (
                            <div>
                              <h3 className="text-xl font-bold">Life</h3>
                              <p className="text-lg">{selectedCard.life}</p>
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                              Attribute
                            </h3>
                            <span className="inline-block bg-blue-500 text-white px-2 py-1 text-sm rounded">
                              Slash
                            </span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">Power</h3>
                            <p className="text-lg">
                              {selectedCard?.power?.replace("Power", "")}
                            </p>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">Counter</h3>
                            <p className="text-lg">-</p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold">Color</h3>
                          <p className="text-lg">Red</p>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold">Type</h3>
                          <p className="text-lg">
                            The Four Emperors/Red-Haired Pirates
                          </p>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold">Effect</h3>
                          <div className="space-y-2">
                            <p className="text-lg">
                              Give all of your opponent's Characters -1000
                              power.
                            </p>
                            <p className="text-lg bg-amber-50 p-2 rounded">
                              [Rush] (This card can attack on the turn in which
                              it is played.)
                            </p>
                          </div>
                        </div>

                        <div className="bg-gray-100 p-4 rounded-lg">
                          <h3 className="text-xl font-bold mb-2">
                            Card Set(s)
                          </h3>
                          <p className="text-lg">
                            -EMPERORS IN THE NEW WORLD- [OP-09]
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {/*Search bar */}
      <div className="mb-4 px-4 w-full flex justify-center">
        {/* <SearchFilters
          search={search}
          setSearch={setSearch}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        /> */}
      </div>

      {/* Cards container */}
      <div className="flex flex-col gap-8 md:flex-row md:flex-wrap md:gap-8 md:justify-center w-full">
        {filterCard?.map((card, index) => (
          <div key={card._id}>
            <div className="flex flex-col justify-center">
              <div
                ref={(ref) => {
                  containerRefs.current[index] = ref;
                }}
                onClick={() => {
                  if (card.isSelectable) {
                    setIsOpen(true);
                    setSelectedCard(card);
                  } else {
                    handleCardClick(card);
                  }
                }}
                className={`
                  ${
                    currentCode
                      ? currentCode == card.code
                        ? ""
                        : "grayscale"
                      : ""
                  }`}
              >
                <Card
                  src={card.src}
                  code={card.code}
                  rarity={card.rarity}
                  mobileheight="h-mobile-2-card-height"
                  isLabelShown={true}
                  isUnpacked={selectedCardId === card._id}
                  totalInCollection={card.totalInCollection}
                  totalQuantity={card.totalQuantity}
                  isSelectable={card.isSelectable}
                  cardId={card._id}
                  isInCollection={card.isInCollection}
                  index={index}
                  addToCollection={addToCollection}
                  setName={card.set}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardList;
