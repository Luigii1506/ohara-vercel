import Link from "next/link";
import React, { useEffect, useState } from "react";
import { CardData } from "@/types";
import Card from "./Card";

interface CardListProps {
  selectedSet: string;
  userId: string;
  fetchMyCollection: () => void;
}

const CardList: React.FC<CardListProps> = ({
  selectedSet,
  userId,
  fetchMyCollection,
}) => {
  const [cards, setCards] = useState<CardData[]>([]);

  const sortedCards = cards.sort((a, b) => {
    const lastThreeDigitsA = a.code.slice(-3);
    const lastThreeDigitsB = b.code.slice(-3);
    return lastThreeDigitsA.localeCompare(lastThreeDigitsB);
  });

  const handleSaveCardToCollection = async (card: CardData) => {
    try {
      const res = await fetch(`/api/collection/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cardId: card._id, quantity: 1 }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("Carta guardada con éxito:", data);
        fetchMyCollection();
      } else {
        console.error("Error al guardar la carta:", data.message);
      }
    } catch (error) {
      console.error("Error de conexión:", error);
    }
  };

  useEffect(() => {
    if (selectedSet === "") return;
    const fetchCards = async () => {
      try {
        const setIds = [selectedSet]; // Suponiendo que tienes estos IDs
        const queryParams = new URLSearchParams(
          setIds.map((id) => ["setIds[]", id])
        );

        const res = await fetch(`/api/admin/cards?${queryParams.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }
        const cards = await res.json();
        setCards(cards);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCards();
  }, [selectedSet]);

  return (
    <div className="flex flex-col justify-center items-center w-full gap-[50px]">
      {sortedCards.map((card) => (
        <div key={card._id} className="flex flex-row w-full gap-5">
          <div
            onClick={() => {
              //handleSaveCardToCollection(card);
            }}
            className="cursor-pointer"
          >
            <Card src={card.src} />
          </div>
          <div className="flex-1 ">
            <div className="flex justify-start items-center gap-3">
              <div className="text-xl font-bold">{card.name}</div>
              <div>({card.code})</div>
            </div>
            <div className="flex justify-start items-center gap-3">
              <div className="text-lg">{card.category}</div>
              <div className="flex">
                <span>•&nbsp;</span>
                {card.colors.map((color, index) => (
                  <span key={color.color}>
                    {color.color}
                    {index < card.colors.length - 1 && "/"}
                  </span>
                ))}
              </div>
              <div className="flex">
                <span>•&nbsp;</span>
                {card.category === "Leader" ? (
                  <span>{card.life}</span>
                ) : (
                  <span>{card.cost}</span>
                )}
              </div>
            </div>
            {card.category !== "Event" && (
              <div className="flex justify-start items-center gap-3">
                <div className="">{card.power}</div>
                <div className="">
                  <span>•&nbsp;</span>
                  {card.attribute}
                </div>
                {card.counter && (
                  <div className="">
                    <span>•&nbsp;</span>
                    {card.counter}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-start items-start gap-3 flex-col">
              {card.texts?.map((text) => (
                <div key={text.text}>{text.text}</div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardList;
