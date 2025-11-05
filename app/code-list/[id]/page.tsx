"use client";

import React, { useEffect, useState, Fragment, useRef } from "react";
import { CardWithCollectionData, CardWithQuantity } from "@/types";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useUser } from "@/app/context/UserContext";
import { CardDetailSkeleton } from "@/components/skeletons";
import "react-medium-image-zoom/dist/styles.css";
import SearchFilters from "@/components/home/SearchFilters";
import Breadcrumb from "@/components/Breadcrumbs";
import CardModal from "@/components/CardModal";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";

const CardList = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  const [cards, setCards] = useState<CardWithCollectionData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardWithCollectionData>();
  const [isDataReady, setIsDataReady] = useState(false);
  const { userId } = useUser();
  let [isOpen, setIsOpen] = useState(false);
  const [isCardFetching, setIsCardFetching] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [cardsWithVariations, setCardsWithVariations] = useState<
    CardWithCollectionData[]
  >([]);
  const [search, setSearch] = useState("");

  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedColor, setSelectedColor] = useState("");

  // const fetchCard = async (cardId: string) => {
  //   setIsCardFetching(true);
  //   try {
  //     const res = await fetch(`/api/cards/${cardId}?userId=${userId}`, {
  //       cache: "no-store",
  //     });

  //     if (!res.ok) {
  //       throw new Error("Failed to fetch cards");
  //     }
  //     const data = await res.json();
  //     return data;
  //   } catch (error) {
  //     console.log("prr", error);
  //     console.error(error);
  //   } finally {
  //     setIsCardFetching(false);
  //   }
  // };

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
        const res = await fetch(
          `/api/admin/cards?setCode=${id}&includeRelations=true`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }
        const data = await res.json();
        setCards(data);
        setIsDataReady(true);
      } catch (error) {
        setIsDataReady(true);

        console.error(error);
      }
    };

    fetchCards();
  }, [id, userId]);

  useEffect(() => {
    if (cards) {
      const sortedCards = cards.sort((a, b) => {
        const lastThreeDigitsA = a.code?.slice(-3);
        const lastThreeDigitsB = b.code?.slice(-3);
        return lastThreeDigitsA?.localeCompare(lastThreeDigitsB);
      });
      console.log("sortedCards", sortedCards);
      setCardsWithVariations(sortedCards);
    }
  }, [cards]);

  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <CardDetailSkeleton />
      </div>
    );
  }

  return (
    <div className="bg-[#f2eede] p-4 pt-8 md:py-16 md:px-[200px] overflow-y-scroll flex-1">
      <Breadcrumb />
      <h2 className="title text-lg md:text-3xl mb-8  text-[#938156] text-left">
        CARD LIST ({id})
      </h2>

      <div className="mb-[4rem] px-4 w-full flex justify-center border-b border-[#938156]">
        {/* <SearchFilters
          search={search}
          setSearch={setSearch}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        /> */}
      </div>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setIsOpen(false);
          }}
          ref={modalRef}
        >
          <div className="fixed inset-0 flex w-screen items-center justify-center bg-[rgba(0,0,0,0.4)]">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel className="w-full max-w-4xl space-y-4 border bg-[#ffffff]  shadow-xl transform transition-all rounded-lg">
                {/* <CardModal
                  selectedCard={selectedCard}
                  setIsOpen={setIsOpen}
                  alternatesCards={[]}
                  setSelectedCard={setSelectedCard}
                /> */}
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-5 justify-items-center">
        {filterCard?.map((card, index) => (
          <div key={card._id}>
            <div className="flex justify-center items-center flex-col w-full">
              <div
                ref={(ref) => {
                  containerRefs.current[index] = ref;
                }}
                onClick={() => {
                  setIsOpen(true);
                  setSelectedCard(card);
                }}
                className={`cursor-pointer w-full`}
              >
                <LazyLoadImage
                  src={card.src}
                  alt="check"
                  className="w-full"
                  effect="blur" // Efecto de desenfoque mientras se carga
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
