import { QueryClient } from "@tanstack/query-core";
import { CardWithCollectionData } from "@/types";

/**
 * 🚀 Prefetch de datos para SSR/SSG
 *
 * Precarga datos críticos en servidor para faster initial load
 */

/**
 * Fetch cards para SSR
 */
export const fetchCardsSSR = async (): Promise<CardWithCollectionData[]> => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/admin/cards?includeRelations=true&includeAlternates=true`,
      {
        // Cachear en Vercel Edge
        next: {
          revalidate: 3600, // 1 hora
          tags: ["cards"],
        },
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch cards`);
    }

    return res.json();
  } catch (error) {
    console.error("SSR fetch failed:", error);
    return []; // Fallback a array vacío
  }
};

/**
 * Prefetch cards en servidor
 */
export const prefetchCardsSSR = async (queryClient: QueryClient) => {
  await queryClient.prefetchQuery({
    queryKey: ["cards"],
    queryFn: fetchCardsSSR,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
};

/**
 * 📦 Dehydrate state para initial props
 */
export const dehydrateCardsState = async (queryClient: QueryClient) => {
  await prefetchCardsSSR(queryClient);

  return {
    queries: queryClient
      .getQueryCache()
      .getAll()
      .map((query) => ({
        queryKey: query.queryKey,
        queryHash: query.queryHash,
        state: query.state,
      })),
  };
};

/**
 * ⚡ Prefetch crítico (solo primeras 50 cartas)
 * Para faster TTI (Time to Interactive)
 */
export const fetchCriticalCardsSSR = async (): Promise<
  CardWithCollectionData[]
> => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/admin/cards?includeRelations=true&includeAlternates=true`,
      {
        next: {
          revalidate: 3600,
          tags: ["cards-critical"],
        },
      }
    );

    if (!res.ok) throw new Error("Failed to fetch critical cards");
    return res.json();
  } catch (error) {
    console.error("Critical SSR fetch failed:", error);
    return [];
  }
};

/**
 * 🎯 Estrategia: Streaming SSR
 *
 * 1. Enviar HTML con skeleton
 * 2. Stream primeras 50 cartas (crítico)
 * 3. Hydrate client con datos completos
 */
export const streamingSSRStrategy = {
  // Fase 1: Critical data (blocking)
  critical: async (queryClient: QueryClient) => {
    await queryClient.prefetchQuery({
      queryKey: ["cards", "critical"],
      queryFn: fetchCriticalCardsSSR,
      staleTime: 1000 * 60 * 60,
    });
  },

  // Fase 2: Full data (non-blocking, background)
  full: async (queryClient: QueryClient) => {
    // No await - se carga en background
    queryClient.prefetchQuery({
      queryKey: ["cards"],
      queryFn: fetchCardsSSR,
      staleTime: 1000 * 60 * 60,
    });
  },
};

/**
 * 📊 Prefetch con priority
 */
export interface PrefetchPriority {
  high: string[][]; // Query keys de alta prioridad
  medium: string[][];
  low: string[][];
}

export const prefetchByPriority = async (
  queryClient: QueryClient,
  priority: PrefetchPriority
) => {
  // High priority (blocking)
  await Promise.all(
    priority.high.map((queryKey) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchCardsSSR,
      })
    )
  );

  // Medium priority (concurrent, non-blocking)
  Promise.all(
    priority.medium.map((queryKey) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchCardsSSR,
      })
    )
  );

  // Low priority (deferred)
  setTimeout(() => {
    priority.low.forEach((queryKey) => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchCardsSSR,
      });
    });
  }, 1000);
};
