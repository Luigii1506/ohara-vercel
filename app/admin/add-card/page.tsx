"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Set, CardData } from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectGroup,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CardHolder from "@/components/Card";
import Image from "next/image";

const AddCard = () => {
  const [selectedCard, setSelectedCard] = useState<string | undefined>();
  const [selectedSet, setSelectedSet] = useState<string | undefined>();
  const [imageUrl, setImageUrl] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [relatedCards, setRelatedCards] = useState<CardData[]>([]);
  const [isValidUrl, setIsValidUrl] = useState(false);

  // Sets
  const [sets, setSets] = useState<Set[]>([]);

  const validateUrl = (url: string) => {
    const urlPattern = new RegExp(
      "^(https?:\\/\\/)?" + // Protocolo (opcional)
        "((([a-zA-Z0-9\\-]+\\.)+[a-zA-Z]{2,})|localhost)" + // Dominio
        "(\\:[0-9]{1,5})?" + // Puerto (opcional)
        "(\\/.*)?$", // Ruta (opcional)
      "i"
    );
    return urlPattern.test(url);
  };

  const handleUrlImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setImageUrl(value);

    // Validar si es una URL válida
    if (validateUrl(value)) {
      setIsValidUrl(true);
    } else {
      setIsValidUrl(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch("/api/admin/cards?includeRelations=true", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch sets");
      }

      const data = await res.json();
      setCards(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const selectedCardData = cards.find((card) => card.id == selectedCard);

      if (!selectedCardData) {
        throw new Error("Card not found");
      }

      // revisar
      if (selectedCardData) {
        // selectedCardData.conditions = selectedCardData.conditions?.map(
        //   (condition) => condition
        // );
        selectedCardData.types = selectedCardData.types?.map((type) => type);
        selectedCardData.colors = selectedCardData.colors?.map(
          (color) => color
        );
        selectedCardData.effects = selectedCardData.effects?.map(
          (effect) => effect
        );
        selectedCardData.src = imageUrl;
      }

      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify(selectedCardData),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("Card created", data);
        //router.push("/");
        await fetchCards();
      } else {
        console.log("Failed to create a card");
        throw new Error("Failed to create a card");
      }
    } catch (error) {
      console.log("el error", error);
    }
  };

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch("/api/sets", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await res.json();
        setSets(data.sets);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSets();
    fetchCards();
  }, []);

  const handleChangedCard = async (value: string) => {
    const match = value.match(/\)(\d+)/);
    const id = match ? match[1] : "";
    setSelectedCard(id);
  };

  useEffect(() => {
    if (selectedCard) {
      const getRelatedCards = async () => {
        try {
          const id = selectedCard;

          const res = await fetch(`/api/admin/alternates/${id}`, {
            cache: "no-store",
          });

          if (!res.ok) {
            throw new Error("Failed to fetch related cards");
          }

          const data = await res.json();
          setRelatedCards(data);
        } catch (error) {
          console.error(error);
        }
      };

      getRelatedCards();
    }
  }, [selectedCard]);

  return (
    <div
      className="p-5 bg-[#f2eede] w-full overflow-auto"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Agregar nueva Carta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-row w-full gap-5">
              <div className="space-y-2 w-1/2">
                <Label htmlFor="cardSelect">Selecciona una carta</Label>
                <Select onValueChange={handleChangedCard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una carta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem
                        key={card.id}
                        value={card?.name + " (" + card.code + ")" + card.id}
                      >
                        {card?.name + " (" + card.code + ")"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-1/2">
                <Label htmlFor="setSelect">Selecciona un set</Label>
                <Select value={selectedSet} onValueChange={setSelectedSet}>
                  <SelectTrigger id="setSelect">
                    <SelectValue placeholder="Selecciona un set" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      {
                        id: "1",
                        name: "Set 1",
                      },
                    ].map((set) => (
                      <SelectItem key={set?.id} value={set?.id}>
                        {set?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL de la imagen</Label>
              <Input
                id="imageUrl"
                type="text"
                value={imageUrl}
                onChange={handleUrlImg}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>

            <div className="flex justify-center items-center">
              <Button
                type="submit"
                disabled={!imageUrl || !selectedCard || !isValidUrl}
                className="p-5"
              >
                <span className="text-xl">Agregar carta</span>
              </Button>
            </div>
          </form>

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">
              Variaciones Existentes
            </h3>
            {
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full overflow-auto">
                {relatedCards.map((card) => (
                  <img
                    src={card.src}
                    alt={card.name}
                    className="object-cover w-full h-full"
                  />
                ))}
              </div>
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddCard;
