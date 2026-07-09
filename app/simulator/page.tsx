"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
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
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-3 py-4 lg:px-6">
      <div className="mx-auto w-full max-w-[1700px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">
          Laboratorio de Simulación
        </h1>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-white/50 lg:block">
            Arrastra cartas, ajusta vida/DON y guarda snapshots — sin restricciones.
          </p>
          <Link
            href="/simulator/replay"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
          >
            <Film className="h-3.5 w-3.5" /> Ver replays
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SimulatorBoard />
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <SimulatorControls
            cards={dataSource as CardWithCollectionData[]}
            isLoadingCards={isLoading || isFetching || !isFullyLoaded}
          />
        </div>
      </div>
      </div>
    </main>
  );
};

export default SimulatorPage;

