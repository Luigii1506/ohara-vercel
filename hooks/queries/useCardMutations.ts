import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";
import type { CardWithCollectionData } from "@/types";
import { toast } from "react-toastify";

// API functions
const updateCard = async (
  card: CardWithCollectionData
): Promise<CardWithCollectionData> => {
  const response = await fetch(`/api/admin/cards/${card.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update card: ${response.status} - ${errorText}`);
  }

  return response.json();
};

const createCard = async (
  card: Partial<CardWithCollectionData>
): Promise<CardWithCollectionData> => {
  const response = await fetch("/api/admin/cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create card: ${response.status} - ${errorText}`);
  }

  return response.json();
};

const deleteCard = async (cardId: string): Promise<string> => {
  const response = await fetch(`/api/admin/cards/${cardId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete card: ${response.status} - ${errorText}`);
  }

  return cardId;
};

/**
 * ✅ OPTIMIZADO: Update Card Mutation con Optimistic Updates
 * Usa cache unificado ['cards']
 */
export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();
  const CARDS_KEY = queryKeys.cards.all;

  return useMutation({
    mutationFn: updateCard,

    // 🚀 OPTIMISTIC UPDATE
    onMutate: async (updatedCard) => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY });

      const previousCards = queryClient.getQueryData<CardWithCollectionData[]>(
        CARDS_KEY
      );

      queryClient.setQueryData<CardWithCollectionData[]>(
        CARDS_KEY,
        (old = []) =>
          old.map((card) =>
            card.id === updatedCard.id ? { ...card, ...updatedCard } : card
          )
      );

      return { previousCards, updatedCard };
    },

    onError: (err, updatedCard, context) => {
      console.error("Update card failed:", err);

      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_KEY, context.previousCards);
      }

      toast.error(
        `Failed to update ${updatedCard.name || "card"}: ${err.message}`
      );
    },

    onSettled: (data, error, updatedCard) => {
      queryClient.invalidateQueries({ queryKey: CARDS_KEY });

      if (!error) {
        toast.success(`${updatedCard.name || "Card"} updated successfully!`);
      }
    },
  });
};

/**
 * ✅ OPTIMIZADO: Create Card Mutation
 */
export const useCreateCardMutation = () => {
  const queryClient = useQueryClient();
  const CARDS_KEY = queryKeys.cards.all;

  return useMutation({
    mutationFn: createCard,

    onSuccess: (createdCard) => {
      queryClient.setQueryData<CardWithCollectionData[]>(
        CARDS_KEY,
        (old) => (old ? [...old, createdCard] : [createdCard])
      );

      toast.success(`${createdCard.name || "New card"} created successfully!`);
    },

    onError: (err) => {
      console.error("Create card failed:", err);
      toast.error(`Failed to create card: ${err.message}`);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_KEY });
    },
  });
};

/**
 * ✅ OPTIMIZADO: Delete Card Mutation
 */
export const useDeleteCardMutation = () => {
  const queryClient = useQueryClient();
  const CARDS_KEY = queryKeys.cards.all;

  return useMutation({
    mutationFn: deleteCard,

    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY });

      const previousCards = queryClient.getQueryData<CardWithCollectionData[]>(
        CARDS_KEY
      );

      const cardToDelete = previousCards?.find((card) => card.id === cardId);
      const cardName = cardToDelete?.name || "Card";

      queryClient.setQueryData<CardWithCollectionData[]>(
        CARDS_KEY,
        (old) => old?.filter((card) => card.id !== cardId)
      );

      return { previousCards, cardName };
    },

    onError: (err, cardId, context) => {
      console.error("Delete card failed:", err);

      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_KEY, context.previousCards);
      }

      toast.error(`Failed to delete card: ${err.message}`);
    },

    onSuccess: (cardId, originalCardId, context) => {
      toast.success(`${context?.cardName || "Card"} deleted successfully!`);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CARDS_KEY });
    },
  });
};
