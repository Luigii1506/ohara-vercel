import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { CardWithCollectionData } from "@/types";

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
    retryDelay: (attemptIndex) =>
      Math.min(1000 * 2 ** attemptIndex, 10000),

    meta: {
      errorMessage: "Error al cargar cartas",
    },
  });
};

/**
 * Hook para refrescar cartas manualmente (con bypass de cache)
 */
export const useRefreshCards = () => {
  const queryClient = useQueryClient();

  return async () => {
    console.log("🔄 Refrescando cartas manualmente...");
    await queryClient.invalidateQueries({ queryKey: ["cards"] });
    await queryClient.refetchQueries({ queryKey: ["cards"] });
  };
};

/**
 * ✅ Hook para obtener estado de sincronización
 */
export const useCardsSyncStatus = () => {
  const queryClient = useQueryClient();
  const queryState = queryClient.getQueryState(["cards"]);
  const isFetching = useIsFetching({ queryKey: ["cards"] });

  return {
    isSyncing: isFetching > 0,
    isStale: queryState?.isInvalidated ?? false,
    lastUpdated: queryState?.dataUpdatedAt
      ? new Date(queryState.dataUpdatedAt)
      : null,
    error: queryState?.error,
  };
};
