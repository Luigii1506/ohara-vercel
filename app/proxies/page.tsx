"use client";

import ProxiesBuilder from "@/components/proxies/ProxiesBuilder";
import { CardWithCollectionData } from "@/types";
import { useAllCards } from "@/hooks/useCards";
import { useState, useEffect, useMemo, useRef } from "react";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";

const ProxiesPage = () => {
  // ✅ Obtener todas las cartas usando el mismo sistema que card-list y deckbuilder
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

  const handleSave = async () => {};

  const handleRestart = () => {};

  return (
    <ProxiesBuilder
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={dataSource as CardWithCollectionData[]}
    />
  );
};

export default ProxiesPage;
