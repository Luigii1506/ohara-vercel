/**
 * Centralized Query Keys for type-safe caching
 * This ensures consistent cache keys across the app
 */
export const queryKeys = {
  // Cards queries
  cards: {
    all: ["cards"] as const,
    lists: () => [...queryKeys.cards.all, "list"] as const,
    list: (filters: string) =>
      [...queryKeys.cards.lists(), { filters }] as const,
    details: () => [...queryKeys.cards.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.cards.details(), id] as const,
    // For admin cards with relations and alternates
    adminFull: ["cards", "admin", "full"] as const,
  },

  // Sets queries
  sets: {
    all: ["sets"] as const,
    dropdown: ["sets", "dropdown"] as const,
  },

  // Alternates queries
  alternates: {
    all: ["alternates"] as const,
    byCard: (cardId: string) => [...queryKeys.alternates.all, cardId] as const,
  },
} as const;
