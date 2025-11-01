import { create } from "zustand";

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
}

export const useCardStore = create<CardStore>()((set) => ({
  // Filtros colapsados o no
  isFiltersCollapsed: false,
  setIsFiltersCollapsed: (collapsed: boolean) =>
    set({ isFiltersCollapsed: collapsed }),
}));
