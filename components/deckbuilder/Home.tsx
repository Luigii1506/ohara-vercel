"use client";

import { useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useCards } from "@/hooks/useCards";
import { useState } from "react";
import { useSession } from "next-auth/react";

const DeckBuilder = () => {
  const router = useRouter();
  const [deckName, setDeckName] = useState("");

  const { data: cards = [], isLoading } = useCards();

  const { data: session } = useSession();

  const deckBuilder = useDeckBuilder(); // sin URL, deck nuevo
  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  const handleSave = async () => {
    if (deckBuilder.isSaving) return;
    if (!deckBuilder.selectedLeader) {
      console.error("No se ha seleccionado un Leader.");
      return;
    }
    if (totalCards !== 50) {
      console.error("El deck debe tener 50 cartas (excluyendo al Leader).");
      return;
    }

    const payloadCards = [
      { cardId: deckBuilder.selectedLeader.id, quantity: 1 },
      ...deckBuilder.deckCards.map((card) => ({
        cardId: card.cardId,
        quantity: card.quantity,
      })),
    ];

    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch("/api/admin/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName.trim(),
          cards: payloadCards,
          userId: session ? session.user.id : null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error creando deck:", errorData.error);
        deckBuilder.setIsSaving(false);
        return;
      }
      const newDeck = await response.json();
      deckBuilder.setIsSaving(false);
      if (session) {
        router.push(`/decks/${newDeck.id}`);
      } else {
        router.push(`/deckbuilder/${newDeck.uniqueUrl}`);
      }
    } catch (error) {
      console.error("Error en la creación del deck:", error);
      deckBuilder.setIsSaving(false);
    }
  };

  const handleRestart = () => {
    deckBuilder.setSelectedLeader(undefined);
    deckBuilder.setDeckCards([]);
  };

  // ✅ TanStack Query maneja el fetch automáticamente

  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={cards as CardWithCollectionData[]}
      deckName={deckName}
      setDeckName={setDeckName}
    />
  );
};

export default DeckBuilder;
