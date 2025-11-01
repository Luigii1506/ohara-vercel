# 🚀 TanStack Query Implementation Plan para Edit-Card

## 📊 Análisis del Problema Actual

### ❌ Issues Identificados en `/edit-card/`:

- **Manual State Management**: `useState` para cards, loading, error en cada component
- **Force Refresh Pattern**: `forceRefresh()` después de cada mutation
- **No Optimistic Updates**: UI se actualiza solo después de server response
- **Código Repetitivo**: Same patterns en múltiples places
- **No Background Updates**: Data se vuelve stale sin refresh manual

## ✅ Solución: Implementación Progresiva de TanStack Query

### 🎯 **Estrategia Híbrida Recomendada:**

- **Zustand** → UI state (modals, forms, preferences)
- **TanStack Query** → Server state (cards, sets, alternates, API data)

---

## 📦 Fase 1: Setup (30 minutos)

### 1.1 Install Dependencies

```bash
npm install @tanstack/react-query
```

### 1.2 QueryClient Setup

```typescript
// lib/react-query/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min fresh
      gcTime: 10 * 60 * 1000, // 10 min garbage collection time
      refetchOnWindowFocus: false, // No refetch on focus
      refetchOnMount: "always", // Always fetch on mount
      retry: 2, // Retry failed requests
    },
    mutations: {
      onError: (error: any) => {
        console.error("Mutation error:", error);
        // Toast notification here if needed
      },
    },
  },
});
```

### 1.3 Query Keys Centralized

```typescript
// lib/react-query/queryKeys.ts
export const queryKeys = {
  cards: {
    all: ["cards", "all"] as const,
    byId: (id: string) => ["cards", "byId", id] as const,
    alternates: (cardId: string) => ["cards", "alternates", cardId] as const,
  },
  sets: {
    all: ["sets", "all"] as const,
    dropdown: ["sets", "dropdown"] as const,
  },
} as const;
```

### 1.4 Provider Setup

```typescript
// app/layout.tsx (o donde sea apropiado)
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/react-query/queryClient";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          {/* DevTools solo en desarrollo */}
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## 📊 Fase 2: Queries Básicas (45 minutos)

### 2.1 useCardsQuery Hook

```typescript
// hooks/queries/useCardsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";
import type { CardWithCollectionData } from "@/types";

const fetchCards = async (): Promise<CardWithCollectionData[]> => {
  const response = await fetch(
    "/api/admin/cards?includeRelations=true&includeAlternates=true"
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch cards: ${response.status}`);
  }

  return response.json();
};

export const useCardsQuery = () => {
  return useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: fetchCards,
    staleTime: 2 * 60 * 1000, // Cards are fresh for 2 minutes
  });
};
```

### 2.2 useSetsQuery Hook

```typescript
// hooks/queries/useSetsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";

interface Set {
  id: string;
  title: string;
}

const fetchSets = async (): Promise<Set[]> => {
  const response = await fetch("/api/admin/sets");
  if (!response.ok) throw new Error("Failed to fetch sets");
  return response.json();
};

export const useSetsQuery = () => {
  return useQuery({
    queryKey: queryKeys.sets.all,
    queryFn: fetchSets,
    staleTime: 10 * 60 * 1000, // Sets are more stable, fresh for 10 minutes
  });
};

// Computed hook for dropdown format
export const useSetsDropdownQuery = () => {
  const { data: sets, ...rest } = useSetsQuery();

  const setsDropdown = React.useMemo(
    () => sets?.map((set) => ({ value: set.id, label: set.title })) || [],
    [sets]
  );

  return {
    ...rest,
    data: setsDropdown,
  };
};
```

---

## ⚡ Fase 3: Mutations con Optimistic Updates (1 hora)

### 3.1 Card Mutations Hook

```typescript
// hooks/queries/useCardMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";
import type { CardWithCollectionData } from "@/types";

// Update Card Mutation
export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedCard: CardWithCollectionData) => {
      const response = await fetch(`/api/admin/cards/${updatedCard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCard),
      });

      if (!response.ok) throw new Error("Failed to update card");
      return response.json();
    },

    // 🚀 OPTIMISTIC UPDATE - UI updates immediately
    onMutate: async (updatedCard) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.cards.all });

      // Snapshot previous value
      const previousCards = queryClient.getQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all
      );

      // Optimistically update
      queryClient.setQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all,
        (old) =>
          old?.map((card) => (card.id === updatedCard.id ? updatedCard : card))
      );

      return { previousCards };
    },

    // Rollback on error
    onError: (err, updatedCard, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(queryKeys.cards.all, context.previousCards);
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
};

// Create Card Mutation
export const useCreateCardMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCard: Partial<CardWithCollectionData>) => {
      const response = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      });

      if (!response.ok) throw new Error("Failed to create card");
      return response.json();
    },

    onSuccess: (createdCard) => {
      // Add to cache optimistically
      queryClient.setQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all,
        (old) => (old ? [...old, createdCard] : [createdCard])
      );
    },
  });
};

// Delete Card Mutation
export const useDeleteCardMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      const response = await fetch(`/api/admin/cards/${cardId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete card");
      return cardId;
    },

    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cards.all });

      const previousCards = queryClient.getQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all
      );

      // Remove optimistically
      queryClient.setQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all,
        (old) => old?.filter((card) => card.id !== cardId)
      );

      return { previousCards };
    },

    onError: (err, cardId, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(queryKeys.cards.all, context.previousCards);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
};
```

---

## 🔄 Fase 4: Migración del Edit-Card Component

### 4.1 ANTES (Estado Actual)

```typescript
// ❌ Código actual con muchos problemas
const EditCard = () => {
  const { forceRefresh } = useCardStore();

  const [cards, setCards] = useState<CardWithCollectionData[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [setsDropdown, setSetsDropdown] = useState<
    { value: string; label: string }[]
  >([]);
  const [globalLoading, setGlobalLoading] = useState({
    type: "none" as
      | "none"
      | "reordering"
      | "deleting"
      | "refreshing"
      | "saving",
    message: "",
    affectedIds: [] as string[],
  });

  // Manual fetching
  useEffect(() => {
    fetchCardsData();
    fetchSetsData();
  }, []);

  const fetchCardsData = async () => {
    setGlobalLoading({ type: "refreshing", message: "Cargando cartas..." });
    try {
      const response = await fetch(
        "/api/admin/cards?includeRelations=true&includeAlternates=true"
      );
      const data = await response.json();
      setCards(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setGlobalLoading({ type: "none", message: "" });
    }
  };

  const handleUpdateCard = async (updatedCard: CardWithCollectionData) => {
    setGlobalLoading({ type: "saving", message: "Guardando..." });
    try {
      await updateCard(updatedCard);
      await forceRefresh(); // Full refresh!
    } finally {
      setGlobalLoading({ type: "none", message: "" });
    }
  };
};
```

### 4.2 DESPUÉS (Con TanStack Query)

```typescript
// ✅ Código limpio y performante
const EditCard = () => {
  // 🚀 Automatic loading, error, and data states
  const {
    data: cards = [],
    isLoading: cardsLoading,
    error: cardsError,
  } = useCardsQuery();

  const { data: setsDropdown = [], isLoading: setsLoading } =
    useSetsDropdownQuery();

  // 🚀 Mutations with optimistic updates
  const updateCardMutation = useUpdateCardMutation();
  const createCardMutation = useCreateCardMutation();
  const deleteCardMutation = useDeleteCardMutation();

  // 🚀 Simple, optimistic handlers
  const handleUpdateCard = (updatedCard: CardWithCollectionData) => {
    // UI updates instantly, syncs in background
    updateCardMutation.mutate(updatedCard);
  };

  const handleCreateCard = (newCard: Partial<CardWithCollectionData>) => {
    createCardMutation.mutate(newCard);
  };

  const handleDeleteCard = (cardId: string) => {
    deleteCardMutation.mutate(cardId);
  };

  // 🚀 Simplified loading states
  const isLoading = cardsLoading || setsLoading;
  const isMutating =
    updateCardMutation.isLoading ||
    createCardMutation.isLoading ||
    deleteCardMutation.isLoading;

  if (isLoading) return <LoadingSkeleton />;
  if (cardsError) return <ErrorBoundary error={cardsError} />;

  return (
    <div>
      {/* Your existing UI */}
      {isMutating && <BackgroundSyncIndicator />}
    </div>
  );
};
```

---

## 🎯 Ventajas Inmediatas

### ⚡ Performance Benefits

- **Sub-second UI updates** con optimistic updates
- **Background sync** invisible al usuario
- **Smart caching** evita requests duplicados
- **Automatic retry** en failures

### 🧹 Code Quality Benefits

- **80% less boilerplate** code
- **Type-safe** queries y mutations
- **Centralized** error handling
- **DevTools** para debugging

### 👥 UX Benefits

- **Instant feedback** en todas las acciones
- **Professional feel** como apps modernas
- **Error recovery** automático
- **Background updates** sin interrupciones

---

## 📈 ROI Analysis

### ⏱️ Time Investment

- **Setup**: 30 minutos
- **Basic Queries**: 45 minutos
- **Mutations**: 1 hora
- **Polish**: 30 minutos
- **Total**: ~2.5 horas

### 🎯 Benefits Achieved

- **Development Speed**: 2x faster para future features
- **User Experience**: 10x better perceived performance
- **Maintainability**: Dramatically cleaner codebase
- **Bug Reduction**: Less manual state management = less bugs

---

## 🚀 Recommendation

**✅ SÍ, definitivamente implementa TanStack Query**

Es perfecto para tu caso porque:

1. **Admin panel** con muchas mutations = ideal use case
2. **Ya tienes Zustand** = perfect hybrid approach
3. **Performance issues** identificados = TanStack Query solves them all
4. **Low risk** = gradual migration, no breaking changes

**Start con edit-card**, expand gradually. El ROI es inmediato y dramático.
