import { create } from "zustand";
import { CardWithCollectionData } from "@/types";

/**
 * ✅ OPTIMIZADO: Solo UI state, sin persist
 *
 * Los datos de cartas ahora se manejan con TanStack Query (IndexedDB)
 * Este store solo maneja estado de UI que no necesita persistir
 */
interface CardStore {
  // UI State - No necesita persistir (se resetea en cada sesión)
  isFiltersCollapsed: boolean;
  setIsFiltersCollapsed: (collapsed: boolean) => void;

  // Dataset cache para filtros locales
  allCards: CardWithCollectionData[];
  setAllCards: (cards: CardWithCollectionData[]) => void;
  isFullyLoaded: boolean;
  setIsFullyLoaded: (value: boolean) => void;
  resetCards: () => void;
}

export const useCardStore = create<CardStore>()((set) => ({
  // Filtros colapsados o no
  isFiltersCollapsed: false,
  setIsFiltersCollapsed: (collapsed: boolean) =>
    set({ isFiltersCollapsed: collapsed }),
  allCards: [],
  setAllCards: (cards) => set({ allCards: cards }),
  isFullyLoaded: false,
  setIsFullyLoaded: (value) => set({ isFullyLoaded: value }),
  resetCards: () => set({ allCards: [], isFullyLoaded: false }),
}));
