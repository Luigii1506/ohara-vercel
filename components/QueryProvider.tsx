"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { createIDBPersister } from '@/lib/idbPersister';
import { clearOldCache } from '@/lib/clearOldCache';

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  // ✅ Detectar cliente y limpiar cache antiguo
  useEffect(() => {
    setIsClient(true);
    clearOldCache(); // Migración a IndexedDB
  }, []);

  // ✅ OPTIMIZADO: Configuración para máximo rendimiento
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ⚡ Cache settings
            gcTime: 1000 * 60 * 60 * 24, // 24 horas - debe ser >= maxAge del persister
            staleTime: 1000 * 60 * 60, // 1 hora - datos considerados "fresh"

            // 🎯 Refetch behavior (optimizado para cache-first)
            refetchOnWindowFocus: false, // No refetch al volver a la pestaña
            refetchOnMount: false, // No refetch al montar componente
            refetchOnReconnect: true, // Solo refetch cuando se recupera conexión

            // 📡 Network mode (prioriza cache)
            networkMode: 'offlineFirst', // Funciona sin internet

            // 🔄 Retry strategy
            retry: 2,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 10000),
          },
          mutations: {
            retry: 1,
            networkMode: 'online',
          },
        },
      })
  );

  // ✅ IndexedDB persister (50MB-1GB vs 5-10MB localStorage)
  const [persister] = useState(() => {
    if (typeof window !== 'undefined') {
      return createIDBPersister('oharatcg-cache');
    }
    return undefined;
  });

  // 🔄 Durante SSR, usar QueryClientProvider normal
  if (!isClient || !persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-left"
          />
        )}
      </QueryClientProvider>
    );
  }

  // ✅ En el cliente, usar PersistQueryClientProvider
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        buster: 'v3', // ✅ ACTUALIZADO: Invalida cache anterior (v2 → v3)

        // ⚡ OPTIMIZADO: Persistir SOLO datos de cartas
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Solo persistir query principal de cards
            // NO imágenes, NO metadata extra
            return query.queryKey[0] === 'cards';
          },
        },
      }}
    >
      {children}

      {/* 🛠️ DevTools - Solo en desarrollo */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </PersistQueryClientProvider>
  );
}
