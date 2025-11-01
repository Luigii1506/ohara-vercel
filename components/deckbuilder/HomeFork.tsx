// app/deckbuilder/[uniqueUrl]/fork/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useCards } from "@/hooks/useCards";

const ForkDeckBuilder = () => {
  const { data: cards = [], isLoading } = useCards();
  const router = useRouter();
  const params = useParams();
  const uniqueUrl = Array.isArray(params.uniqueUrl)
    ? params.uniqueUrl[0]
    : params.uniqueUrl;

  const deckBuilder = useDeckBuilder(uniqueUrl);

  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  const handleForkSave = async () => {
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

    const deckName = "Fork de Deck";
    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/decks/${uniqueUrl}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName, cards: payloadCards }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error al forkar deck:", errorData.error);
        deckBuilder.setIsSaving(false);
        return;
      }
      const newDeck = await response.json();
      deckBuilder.setIsSaving(false);
      router.push(`/deckbuilder/${newDeck.uniqueUrl}`);
    } catch (error) {
      console.error("Error al forkar deck:", error);
      deckBuilder.setIsSaving(false);
    }
  };

  const handleRestart = () => {
    deckBuilder.setSelectedLeader(null);
    deckBuilder.setDeckCards([]);
  };

  // ✅ TanStack Query maneja el fetch automáticamente
  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleForkSave}
      onRestart={handleRestart}
      initialCards={cards as CardWithCollectionData[]}
      isFork={true}
    />
  );
};

export default ForkDeckBuilder;
