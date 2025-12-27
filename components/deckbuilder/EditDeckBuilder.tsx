// app/deckbuilder/[uniqueUrl]/fork/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useI18n } from "@/components/i18n/I18nProvider";

const EditDeckBuilder = () => {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const deckBuilder = useDeckBuilder(id);

  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );
  const handleEdit = async () => {
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
      const response = await fetch(`/api/decks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payloadCards,
          name: deckBuilder.deckName.trim() || t("deckbuilder.defaultDeckName"),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error al actualizar deck:", errorData.error);
        deckBuilder.setIsSaving(false);
        return;
      }
      const updatedDeck = await response.json();
      deckBuilder.setIsSaving(false);
      router.push(`/decks/${updatedDeck.id}`);
    } catch (error) {
      console.error("Error al actualizar deck:", error);
      deckBuilder.setIsSaving(false);
    }
  };

  const handleRestart = () => {
    deckBuilder.setSelectedLeader(null);
    deckBuilder.setDeckCards([]);
    deckBuilder.setDeckName(t("deckbuilder.defaultDeckName"));
  };

  // ✅ TanStack Query maneja el fetch automáticamente
  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleEdit}
      onRestart={handleRestart}
      initialCards={[] as CardWithCollectionData[]}
      useServerCards
      deckName={deckBuilder.deckName}
      setDeckName={deckBuilder.setDeckName}
    />
  );
};

export default EditDeckBuilder;
