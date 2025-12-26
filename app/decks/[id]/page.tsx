"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Deck } from "@/types";
import DeckDetailView from "@/components/decks/DeckDetailView";

const MyDeck = () => {
  const { id } = useParams();
  const { data: session } = useSession();

  const [deckData, setDeckData] = useState<Deck | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch deck
  useEffect(() => {
    const fetchDeck = async () => {
      try {
        setIsLoading(true);
        const apiUrl = `/api/decks/${id}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Deck no encontrado");
        const data = await res.json();
        setDeckData(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchDeck();
  }, [id, session]);

  return (
    <DeckDetailView
      deck={deckData}
      isLoading={isLoading}
      isDrawer={false}
    />
  );
};

export default MyDeck;
