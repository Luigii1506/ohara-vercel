import { useMemo } from "react";
import {
  useQuery,
  useQueryClient,
  useIsFetching,
  useInfiniteQuery,
} from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { CardWithCollectionData } from "@/types";
import type { CardsFilters, CardsPage } from "@/lib/cards/types";

const fetchCards = async (): Promise<CardWithCollectionData[]> => {
  const res = await fetch(
    "/api/admin/cards?includeRelations=true&includeAlternates=true",
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Error al obtener cartas");
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("Datos inválidos recibidos del servidor");
  }

  console.log(`✅ ${data.length} cartas cargadas desde servidor`);
  return data;
};

/**
 * ✅ OPTIMIZADO: Hook unificado para obtener todas las cartas
 *
 * Features:
 * - IndexedDB persistence (50MB-1GB capacity)
 * - Un solo cache compartido para toda la app
 * - Configuración flexible por uso (admin vs user)
 * - Offline-first support
 * - Background refetch automático
 *
 * @param options - Opciones de configuración
 * @param options.alwaysFresh - Si true, siempre refresca (para admin)
 */
export const useCards = (options?: { alwaysFresh?: boolean }) => {
  return useQuery({
    queryKey: ["cards"], // ✅ UN SOLO queryKey para toda la app
    queryFn: fetchCards,

    // 🎯 Estrategia adaptativa según contexto
    ...(options?.alwaysFresh
      ? {
          // Admin: Siempre datos frescos
          refetchOnMount: "always",
          staleTime: 0, // Siempre stale para refetch en background
        }
      : {
          // Users: Cache agresivo (usa config global)
          staleTime: 1000 * 60 * 60, // 1 hora - datos fresh
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        }),

    // Config compartida
    gcTime: 1000 * 60 * 60 * 24, // 24 horas - retención en memoria
    refetchOnReconnect: true, // Refetch cuando se recupera conexión
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),

    meta: {
      errorMessage: "Error al cargar cartas",
    },
  });
};

/**
 * Hook para refrescar cartas manualmente (con bypass de cache)
 */
export const useRefreshCards = (queryKey: QueryKey = ["cards"]) => {
  const queryClient = useQueryClient();

  return async () => {
    console.log("🔄 Refrescando cartas manualmente...");
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey });
  };
};

/**
 * ✅ Hook para obtener estado de sincronización
 */
export const useCardsSyncStatus = (queryKey: QueryKey = ["cards"]) => {
  const queryClient = useQueryClient();
  const queryState = queryClient.getQueryState(queryKey);
  const isFetching = useIsFetching({ queryKey });

  return {
    isSyncing: isFetching > 0,
    isStale: queryState?.isInvalidated ?? false,
    lastUpdated: queryState?.dataUpdatedAt
      ? new Date(queryState.dataUpdatedAt)
      : null,
    error: queryState?.error,
  };
};

type FetchCardsPageParams = {
  cursor: number | null;
  limit: number;
  filters: CardsFilters;
};

const normalizeList = (list?: string[]) =>
  list?.map((item) => item.trim()).filter(Boolean);

const buildQueryString = (
  params: FetchCardsPageParams | { filters: CardsFilters }
): string => {
  const searchParams = new URLSearchParams();

  const { filters } = params;

  if (filters.search) {
    searchParams.set("search", filters.search);
  }

  const entries: Array<[keyof CardsFilters, string]> = [
    ["sets", "sets"],
    ["setCodes", "codes"],
    ["colors", "colors"],
    ["rarities", "rarities"],
    ["categories", "categories"],
    ["costs", "costs"],
    ["power", "power"],
    ["attributes", "attributes"],
    ["types", "types"],
    ["effects", "effects"],
    ["altArts", "altArts"],
  ];

  entries.forEach(([filterKey, paramKey]) => {
    const filterValue = filters[filterKey];
    const value = normalizeList(
      Array.isArray(filterValue) ? filterValue : undefined
    );
    if (value && value.length) {
      searchParams.set(paramKey, value.join(","));
    }
  });

  if (filters.region) {
    searchParams.set("region", filters.region);
  }
  if (filters.counter) {
    searchParams.set("counter", filters.counter);
  }
  if (filters.trigger) {
    searchParams.set("trigger", filters.trigger);
  }
  if (filters.sortBy) {
    searchParams.set("sortBy", filters.sortBy);
  }

  if ("limit" in params) {
    searchParams.set("includeRelations", "true");
    searchParams.set("includeAlternates", "true");
    searchParams.set("includeCounts", "true");
    searchParams.set("limit", params.limit.toString());

    if (params.cursor) {
      searchParams.set("cursor", params.cursor.toString());
    }
  }

  return searchParams.toString();
};

type FetchAllCardsClientParams = {
  filters?: CardsFilters;
  includeRelations?: boolean;
  includeAlternates?: boolean;
  includeCounts?: boolean;
  limit?: number | null;
};

const buildFullQueryString = (params: FetchAllCardsClientParams): string => {
  const searchParams = new URLSearchParams();
  const filters = params.filters ?? {};

  if (params.includeRelations === false) {
    searchParams.set("includeRelations", "false");
  } else {
    searchParams.set("includeRelations", "true");
  }

  if (params.includeAlternates === false) {
    searchParams.set("includeAlternates", "false");
  } else {
    searchParams.set("includeAlternates", "true");
  }

  if (params.includeCounts) {
    searchParams.set("includeCounts", "true");
  }

  if (params.limit && Number.isFinite(params.limit)) {
    searchParams.set("limit", Math.max(1, params.limit).toString());
  }

  if (filters.search) {
    searchParams.set("search", filters.search);
  }

  const entries: Array<[keyof CardsFilters, string]> = [
    ["sets", "sets"],
    ["setCodes", "codes"],
    ["colors", "colors"],
    ["rarities", "rarities"],
    ["categories", "categories"],
    ["costs", "costs"],
    ["power", "power"],
    ["attributes", "attributes"],
    ["types", "types"],
    ["effects", "effects"],
    ["altArts", "altArts"],
  ];

  entries.forEach(([filterKey, paramKey]) => {
    const filterValue = filters[filterKey];
    const value = normalizeList(
      Array.isArray(filterValue) ? filterValue : undefined
    );
    if (value && value.length) {
      searchParams.set(paramKey, value.join(","));
    }
  });

  if (filters.region) {
    searchParams.set("region", filters.region);
  }
  if (filters.counter) {
    searchParams.set("counter", filters.counter);
  }
  if (filters.trigger) {
    searchParams.set("trigger", filters.trigger);
  }
  if (filters.sortBy) {
    searchParams.set("sortBy", filters.sortBy);
  }

  return searchParams.toString();
};

const fetchCardsPage = async (
  params: FetchCardsPageParams
): Promise<CardsPage> => {
  const queryString = buildQueryString(params);
  const url = `/api/cards?${queryString}`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("[fetchCardsPage] Error response:", errorText);
    throw new Error("Error al obtener cartas");
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    const cards = data as CardWithCollectionData[];
    const lastCard = cards.length ? cards[cards.length - 1] : null;
    const lastId = lastCard
      ? typeof lastCard.id === "number"
        ? lastCard.id
        : null
      : null;
    return {
      items: cards,
      nextCursor: lastId,
      hasMore: false,
      totalCount: cards.length,
    };
  }

  return {
    items: (data.items ?? []) as CardWithCollectionData[],
    nextCursor: typeof data.nextCursor === "number" ? data.nextCursor : null,
    hasMore: Boolean(data.hasMore),
    totalCount:
      typeof data.totalCount === "number"
        ? data.totalCount
        : (data.items ?? []).length || 0,
  };
};

const fetchCardsCount = async (filters: CardsFilters): Promise<number> => {
  const queryString = buildQueryString({ filters });
  const url = queryString ? `/api/cards/count?${queryString}` : "/api/cards/count";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Error al contar cartas");
  }
  const data = await res.json();
  return typeof data.total === "number" ? data.total : 0;
};

export const serializeFiltersForKey = (filters: CardsFilters) => {
  const sortedEntries: Record<string, unknown> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      sortedEntries[key] = [...value].sort();
    } else if (value !== undefined && value !== "") {
      sortedEntries[key] = value;
    }
  });

  return JSON.stringify(sortedEntries);
};

type PaginatedOptions = {
  limit?: number;
  initialData?: {
    pages: CardsPage[];
    pageParams: (number | null)[];
  };
  enabled?: boolean;
};

export const usePaginatedCards = (
  filters: CardsFilters,
  options?: PaginatedOptions
) => {
  const limit = options?.limit ?? 60;
  const serializedFilters = serializeFiltersForKey(filters);
  const enabled = options?.enabled ?? true;

  const queryKey: QueryKey = ["cards-paginated", serializedFilters, limit];

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
    queryFn: ({ pageParam }) => {
      return fetchCardsPage({
        cursor: pageParam,
        limit,
        filters,
      });
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    initialData: options?.initialData,
    enabled,
  });

  const cards: CardWithCollectionData[] = [];
  const seen = new Set<number | string>();

  query.data?.pages.forEach((page) => {
    page.items?.forEach((card) => {
      const uniqueKey = (card as any).id ?? (card as any).uuid;
      if (uniqueKey === undefined) {
        cards.push(card);
        return;
      }
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);
      cards.push(card);
    });
  });
  const totalCount = query.data?.pages?.[0]?.totalCount ?? null;

  return {
    ...query,
    cards,
    totalFetched: cards.length,
    totalCount,
    queryKey,
  };
};

export const useCardsCount = (filters: CardsFilters) => {
  const serializedFilters = serializeFiltersForKey(filters);
  return useQuery({
    queryKey: ["cards-count", serializedFilters],
    queryFn: () => fetchCardsCount(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};

type UseAllCardsOptions = FetchAllCardsClientParams & {
  enabled?: boolean;
  initialData?: CardWithCollectionData[];
};

const fetchAllCards = async (
  params: FetchAllCardsClientParams
): Promise<CardWithCollectionData[]> => {
  const queryString = buildFullQueryString(params);

  const url = queryString
    ? `/api/cards/full?${queryString}`
    : `/api/cards/full`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al obtener cartas");
  }

  const data = await res.json();

  if (Array.isArray(data)) {
    return data as CardWithCollectionData[];
  }

  return (data.items ?? []) as CardWithCollectionData[];
};

export const useAllCards = (
  filters: CardsFilters,
  options?: UseAllCardsOptions
) => {
  const includeRelations = options?.includeRelations ?? true;
  const includeAlternates = options?.includeAlternates ?? true;
  const includeCounts = options?.includeCounts ?? true;
  const limit = options?.limit ?? null;

  const serializedFilters = serializeFiltersForKey(filters);

  const queryKey: QueryKey = [
    "cards-full",
    serializedFilters,
    includeRelations,
    includeAlternates,
    includeCounts,
    limit,
  ];

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchAllCards({
        filters,
        includeRelations,
        includeAlternates,
        includeCounts,
        limit,
      }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    initialData: options?.initialData,
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });

  return {
    ...query,
    queryKey,
  };
};
