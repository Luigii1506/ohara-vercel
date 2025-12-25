"use client";

import React, { useEffect, useMemo, useRef } from "react";
import SimulatorBoard from "@/components/simulator/SimulatorBoard";
import SimulatorControls from "@/components/simulator/SimulatorControls";
import { useCardStore } from "@/store/cardStore";
import { useAllCards } from "@/hooks/useCards";
import { CardWithCollectionData } from "@/types";
import type { CardsFilters } from "@/lib/cards/types";

const SimulatorPage = () => {
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  const filters = useMemo<CardsFilters>(() => ({}), []);

  const {
    data: allCardsData,
    isLoading,
    isFetching,
  } = useAllCards(filters, {
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

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

    if (!isFetching) {
      setIsFullyLoaded(true);
    }
  }, [allCardsData, isFetching, setAllCards, setIsFullyLoaded]);

  const dataSource =
    cachedCards.length > 0 ? cachedCards : allCardsData ?? ([] as CardWithCollectionData[]);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 lg:px-8">
      <div className="mb-6 space-y-1">
        <p className="text-sm uppercase tracking-wide text-emerald-300">Ohara Lab</p>
        <h1 className="text-3xl font-bold text-white">Laboratorio de Simulación</h1>
        <p className="text-sm text-white/70">
          Arrastra cartas, guarda snapshots y reproduce partidas sin restricciones.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SimulatorBoard />
        <SimulatorControls
          cards={dataSource as CardWithCollectionData[]}
          isLoadingCards={isLoading || isFetching || !isFullyLoaded}
        />
      </div>
    </main>
  );
};

export default SimulatorPage;

