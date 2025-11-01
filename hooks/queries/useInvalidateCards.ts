import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";

/**
 * ✅ OPTIMIZADO: Hook para invalidar cache unificado de cartas
 *
 * Usa UN SOLO queryKey ['cards'] para toda la app
 * Simplifica invalidaciones y optimistic updates
 *
 * Ejemplo:
 * ```typescript
 * const { invalidateCards, updateCardInCache } = useInvalidateCards();
 *
 * const handleUpdate = async (card) => {
 *   updateCardInCache(card); // ⚡ UI instantáneo
 *   await updateCard(card);  // 📡 Sync con servidor
 *   invalidateCards();       // 🔄 Revalidar
 * };
 * ```
 */
export const useInvalidateCards = () => {
  const queryClient = useQueryClient();

  // ✅ UN SOLO queryKey para toda la app
  const CARDS_KEY = queryKeys.cards.all;

  return {
    /**
     * Invalida cache de cartas
     * Trigger background refetch en todos los componentes
     */
    invalidateCards: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_KEY });
      console.log("🔄 Cards cache invalidated - all pages will refetch");
    },

    /**
     * Invalida cards + sets (para cambios grandes)
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.sets.all });
      console.log("🔄 All cache invalidated");
    },

    /**
     * Fuerza refetch inmediato (sin esperar)
     */
    forceRefetch: async () => {
      await queryClient.refetchQueries({ queryKey: CARDS_KEY });
      console.log("⚡ Force refetch completed");
    },

    /**
     * ⚡ Optimistic Update: Actualiza carta en cache
     */
    updateCardInCache: (updatedCard: any) => {
      queryClient.setQueryData(CARDS_KEY, (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.map((card) =>
          card.id === updatedCard.id ? { ...card, ...updatedCard } : card
        );
      });
      console.log("✨ Card updated optimistically");
    },

    /**
     * ⚡ Optimistic Update: Agrega carta al cache
     */
    addCardToCache: (newCard: any) => {
      queryClient.setQueryData(CARDS_KEY, (oldData: any[]) => {
        if (!oldData) return [newCard];
        return [newCard, ...oldData];
      });
      console.log("➕ Card added optimistically");
    },

    /**
     * ⚡ Optimistic Update: Elimina carta del cache
     */
    removeCardFromCache: (cardId: string) => {
      queryClient.setQueryData(CARDS_KEY, (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.filter((card) => card.id !== cardId);
      });
      console.log("🗑️ Card removed optimistically");
    },
  };
};
