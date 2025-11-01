# 🚀 EMPEZAR AHORA: Código Práctico para TanStack Query

## 📦 Paso 1: Install & Basic Setup (15 minutos)

### 1.1 Install TanStack Query

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 1.2 Create Query Client

```typescript
// lib/react-query/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min fresh (good for edit-card)
      gcTime: 5 * 60 * 1000, // 5 min garbage collection time
      refetchOnWindowFocus: false, // No refetch on focus (admin app)
      retry: 1, // Single retry
    },
    mutations: {
      retry: 1,
      onError: (error: any) => {
        console.error("Mutation failed:", error);
        // Add toast here if you want global error handling
      },
    },
  },
});
```

### 1.3 Query Keys (Type-Safe)

```typescript
// lib/react-query/queryKeys.ts
export const queryKeys = {
  // Cards queries
  cards: {
    all: ["cards"] as const,
    lists: () => [...queryKeys.cards.all, "list"] as const,
    list: (filters: string) =>
      [...queryKeys.cards.lists(), { filters }] as const,
    details: () => [...queryKeys.cards.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.cards.details(), id] as const,
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
```

---

## 🔌 Paso 2: Provider Setup (5 minutos)

### 2.1 Update Layout or App Root

```typescript
// app/layout.tsx (si usas App Router) O app/page.tsx/app/_app.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
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

          {/* 🛠️ DevTools - Solo en desarrollo */}
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

## 📊 Paso 3: First Query Hook - Cards (20 minutos)

### 3.1 Create useCardsQuery Hook

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
    throw new Error(`HTTP ${response.status}: Failed to fetch cards`);
  }

  return response.json();
};

export const useCardsQuery = () => {
  return useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: fetchCards,

    // Cards in edit-card change frequently, so shorter stale time
    staleTime: 1 * 60 * 1000, // 1 minute

    // Keep in cache longer for better UX
    gcTime: 5 * 60 * 1000, // 5 min garbage collection time
  });
};

// 🎯 Hook with search/filter support (for future)
export const useCardsSearchQuery = (search?: string) => {
  return useQuery({
    queryKey: [...queryKeys.cards.all, { search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("includeRelations", "true");
      params.append("includeAlternates", "true");
      if (search) params.append("search", search);

      const response = await fetch(`/api/admin/cards?${params}`);
      if (!response.ok) throw new Error("Failed to fetch cards");
      return response.json();
    },
    enabled: true, // Always enabled, but can be controlled
    staleTime: 30 * 1000, // Search results stale quickly (30 sec)
  });
};
```

### 3.2 Replace in Edit-Card Page

```typescript
// app/admin/edit-card/page.tsx - QUICK WIN UPDATE

// ❌ Remove these old patterns:
// const [cards, setCards] = useState<CardWithCollectionData[]>([]);
// const [loading, setLoading] = useState(true);
// const { forceRefresh } = useCardStore(); // Keep if used elsewhere

// ✅ Add this import and hook:
import { useCardsQuery } from '@/hooks/queries/useCardsQuery';

const EditCard = () => {
  // 🚀 Replace all the manual card fetching with this:
  const {
    data: cards = [],
    isLoading: cardsLoading,
    error: cardsError,
    refetch: refetchCards // For manual refetch if needed
  } = useCardsQuery();

  // Keep other state as-is for now (sets, alternates, etc.)
  const [sets, setSets] = useState<Set[]>([]);
  const [setsDropdown, setSetsDropdown] = useState<{value: string; label: string}[]>([]);

  // Remove the fetchCardsData function completely
  // Remove the useEffect that calls fetchCardsData

  // Update loading logic
  const isLoading = cardsLoading || /* other loading states */;

  // Add error handling
  if (cardsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Cards</h3>
          <p className="text-gray-600 mb-4">{cardsError.message}</p>
          <button
            onClick={() => refetchCards()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Rest of component stays the same
  return (
    // Your existing JSX
  );
};
```

---

## ⚡ Paso 4: First Mutation - Update Card (25 minutos)

### 4.1 Create Update Card Mutation

```typescript
// hooks/queries/useCardMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/queryKeys";
import type { CardWithCollectionData } from "@/types";
import { toast } from "react-toastify"; // if you have toast

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
    throw new Error(`Failed to update card: ${response.status}`);
  }

  return response.json();
};

export const useUpdateCardMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCard,

    // 🚀 OPTIMISTIC UPDATE - This is where the magic happens
    onMutate: async (updatedCard) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.cards.all });

      // Snapshot the previous value
      const previousCards = queryClient.getQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all
      );

      // Optimistically update to the new value
      queryClient.setQueryData<CardWithCollectionData[]>(
        queryKeys.cards.all,
        (old = []) =>
          old.map((card) =>
            card.id === updatedCard.id ? { ...card, ...updatedCard } : card
          )
      );

      // Return a context object with the snapshotted value
      return { previousCards, updatedCard };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, updatedCard, context) => {
      console.error("Update card failed:", err);

      if (context?.previousCards) {
        queryClient.setQueryData(queryKeys.cards.all, context.previousCards);
      }

      // Show user-friendly error
      toast?.error?.(`Failed to update ${updatedCard.name}: ${err.message}`);
    },

    // Always refetch after error or success to ensure we have up-to-date data
    onSettled: (data, error, updatedCard) => {
      // Invalidate queries to trigger a refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });

      if (!error) {
        toast?.success?.(`${updatedCard.name} updated successfully!`);
      }
    },
  });
};
```

### 4.2 Use Mutation in Edit-Card

```typescript
// app/admin/edit-card/page.tsx - Add mutation usage

import { useUpdateCardMutation } from "@/hooks/queries/useCardMutations";

const EditCard = () => {
  const {
    data: cards = [],
    isLoading: cardsLoading,
    error: cardsError,
  } = useCardsQuery();

  // 🚀 Add this mutation hook
  const updateCardMutation = useUpdateCardMutation();

  // ✅ Replace any existing card update logic with this:
  const handleUpdateCard = (updatedCard: CardWithCollectionData) => {
    // This will trigger optimistic update immediately!
    updateCardMutation.mutate(updatedCard);
  };

  // Optional: Show mutation loading state
  const isSaving = updateCardMutation.isLoading;

  return (
    <div>
      {/* Add saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg">
          💾 Saving changes...
        </div>
      )}

      {/* Your existing UI - just call handleUpdateCard wherever you update cards */}
    </div>
  );
};
```

---

## 🎯 Testing Your Implementation (10 minutos)

### Test Checklist:

1. **Open edit-card page** → Should load cards from cache after first load
2. **Update a card** → Should see instant UI update (optimistic)
3. **Open React Query DevTools** → Should see queries and their states
4. **Refresh page** → Should load from cache, then background refetch
5. **Test network failure** → Should show error and retry option

---

## 📈 Immediate Benefits You'll See:

### ⚡ Performance

- **First load**: Same speed (but now cached)
- **Second load**: Instant from cache
- **Updates**: Sub-100ms UI updates (optimistic)
- **Background sync**: Invisible to user

### 🧹 Code Quality

- **~50 lines removed** from edit-card page (loading states, manual fetching)
- **Type-safe** queries with full TypeScript support
- **Centralized** API logic
- **Error handling** built-in

### 🛠️ Developer Experience

- **DevTools** show you exactly what's happening
- **Hot reload** works perfectly with cached data
- **Debugging** is much easier
- **Future features** will be 2x faster to build

---

## 🚀 Next Steps (After This Works):

1. **Add Sets Query** (15 min)
2. **Add Create/Delete Mutations** (30 min)
3. **Add Alternates Queries** (20 min)
4. **Polish Loading States** (15 min)

**Total time for complete transformation: ~2.5 hours**

---

## 💡 Pro Tips:

### 🎯 Start Simple

- Don't optimize prematurely
- Get basic queries working first
- Add optimistic updates after basic flow works

### 🔍 Use DevTools

- Install React Query DevTools
- Watch queries in real-time
- Understand caching behavior

### 📊 Monitor Performance

- Check Network tab - should see fewer requests
- User experience should feel instant
- Background updates should be invisible

**¿Ready to start? La transformación de UX va a ser dramática! 🚀**
