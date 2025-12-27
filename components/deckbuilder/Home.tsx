"use client";

import { useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";
import { serializeFiltersForKey } from "@/hooks/useCards";

interface DeckBuilderProps {
  initialData?: CardsPage;
}

const DeckBuilder = ({ initialData }: DeckBuilderProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const deckBuilder = useDeckBuilder();
  const [deckName, setDeckNameState] = useState(deckBuilder.deckName ?? "");
  const [isDeckNameManual, setIsDeckNameManual] = useState(false);

  // Calcular filtros iniciales basados en si hay leader seleccionado
  const initialFilters = useMemo<CardsFilters>(() => {
    if (!deckBuilder.selectedLeader) {
      return { categories: ["Leader"] };
    }
    return {};
  }, [deckBuilder.selectedLeader]);

  // Calcular initialQueryData para TanStack Query
  const initialQueryData = useMemo(() => {
    if (!initialData) return undefined;

    // Solo usar initialData si los filtros coinciden (Leaders iniciales)
    const initialFiltersSignature = serializeFiltersForKey({
      categories: ["Leader"],
    });
    const currentFiltersSignature = serializeFiltersForKey(initialFilters);

    if (initialFiltersSignature !== currentFiltersSignature) {
      return undefined;
    }

    return {
      pages: [initialData],
      pageParams: [null],
    };
  }, [initialData, initialFilters]);

  // Auto-set deck name based on leader
  useEffect(() => {
    if (!deckBuilder.selectedLeader) {
      if (!isDeckNameManual) {
        setDeckNameState("");
      }
      return;
    }
    if (isDeckNameManual) return;
    const leaderName = deckBuilder.selectedLeader.name ?? "";
    if (leaderName) {
      setDeckNameState(leaderName);
    }
  }, [deckBuilder.selectedLeader, isDeckNameManual]);

  const totalCards = deckBuilder.deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  const handleDeckNameChange = (value: string) => {
    if (!isDeckNameManual) {
      setIsDeckNameManual(true);
    }
    setDeckNameState(value);
  };

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

    const baseName =
      deckName.trim() || deckBuilder.selectedLeader?.name || "Mi Deck";

    deckBuilder.setIsSaving(true);
    try {
      const response = await fetch("/api/admin/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: baseName,
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
    setIsDeckNameManual(false);
    setDeckNameState("");
  };

  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={initialData?.items as CardWithCollectionData[] ?? []}
      useServerCards={true}
      deckName={deckName}
      setDeckName={handleDeckNameChange}
      initialQueryData={initialQueryData}
    />
  );
};

export default DeckBuilder;
