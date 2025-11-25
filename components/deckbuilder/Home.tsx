"use client";

import { useRouter } from "next/navigation";
import DeckBuilderLayout from "@/components/deckbuilder/DeckBuilderLayout";
import { useDeckBuilder } from "@/hooks/useDeckBuilder";
import { CardWithCollectionData } from "@/types";
import { useAllCards } from "@/hooks/useCards";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";

const DeckBuilder = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const deckBuilder = useDeckBuilder(); // sin URL, deck nuevo
  const [deckName, setDeckNameState] = useState(deckBuilder.deckName ?? "");
  const [isDeckNameManual, setIsDeckNameManual] = useState(false);

  // ✅ Obtener todas las cartas usando el mismo sistema que card-list
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  // Filtros vacíos para traer TODAS las cartas
  const fullQueryFilters = useMemo<CardsFilters>(() => ({}), []);

  const {
    data: allCardsData,
    isLoading: isLoadingAllCards,
    isFetching: isFetchingAllCards,
  } = useAllCards(fullQueryFilters, {
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  // ✅ Guardar en Zustand cuando lleguen las cartas
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

  useEffect(() => {
    if (!allCardsData) return;

    if (!allCardsData.length) {
      if (allCardsSignatureRef.current !== "empty") {
        allCardsSignatureRef.current = "empty";
        setAllCards([]);
      }
      return;
    }

    const firstCard = allCardsData[0];
    const lastCard = allCardsData[allCardsData.length - 1];

    const normalizeTimestamp = (value: Date | string | undefined) => {
      if (!value) return "";
      if (value instanceof Date) return value.getTime().toString();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? String(value) : parsed.toString();
    };

    const signature = [
      allCardsData.length,
      firstCard?.id ?? "",
      lastCard?.id ?? "",
      normalizeTimestamp(firstCard?.updatedAt),
      normalizeTimestamp(lastCard?.updatedAt),
    ].join("-");

    if (allCardsSignatureRef.current !== signature) {
      allCardsSignatureRef.current = signature;
      setAllCards(allCardsData);
    }

    if (!isFetchingAllCards) {
      setIsFullyLoaded(true);
    }
  }, [allCardsData, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  // ✅ Usar cachedCards si existen, sino allCardsData
  const dataSource = cachedCards.length > 0 ? cachedCards : allCardsData ?? [];
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
      deckName.trim() ||
      deckBuilder.selectedLeader?.name ||
      "Mi Deck";

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

  // ✅ TanStack Query maneja el fetch automáticamente

  return (
    <DeckBuilderLayout
      deckBuilder={deckBuilder}
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={dataSource as CardWithCollectionData[]}
      deckName={deckName}
      setDeckName={handleDeckNameChange}
    />
  );
};

export default DeckBuilder;
