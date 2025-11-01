import { useInvalidateCards } from "./useInvalidateCards";

/**
 * ✅ SIMPLIFICADO: Hook para sincronización de cache unificado
 *
 * Re-exporta funciones de useInvalidateCards con nombres legacy
 * para compatibilidad con código existente
 *
 * Ejemplo:
 * ```typescript
 * const { refresh, optimisticUpdate } = useHybridCardSync();
 *
 * const handleAddCard = async (newCard) => {
 *   optimisticUpdate.addCard(newCard); // ⚡ UI instantáneo
 *   await addCard(newCard);            // 📡 Sync servidor
 *   refresh();                         // 🔄 Revalidar
 * };
 * ```
 */
export const useHybridCardSync = () => {
  const {
    invalidateCards,
    forceRefetch,
    addCardToCache,
    updateCardInCache,
    removeCardFromCache,
  } = useInvalidateCards();

  return {
    /**
     * 🔄 Refresh - Invalida cache (trigger background refetch)
     */
    refresh: invalidateCards,

    /**
     * ⚡ Force Refresh - Refetch inmediato (espera respuesta)
     */
    forceRefresh: forceRefetch,

    /**
     * ✨ Optimistic Updates - UI instantáneo
     */
    optimisticUpdate: {
      addCard: addCardToCache,
      updateCard: updateCardInCache,
      removeCard: removeCardFromCache,
    },

    // Legacy aliases (deprecar gradualmente)
    syncForceRefresh: invalidateCards,
    immediateSync: forceRefetch,
  };
};
