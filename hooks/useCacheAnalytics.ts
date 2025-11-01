"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number; // 0-100%
  totalQueries: number;
  cacheSize: number; // bytes
  queryCount: number;
}

/**
 * 📊 Hook para Analytics de Cache
 *
 * Monitorea performance de TanStack Query cache
 * - Cache hit rate
 * - Tamaño del cache
 * - Número de queries
 */
export const useCacheAnalytics = () => {
  const queryClient = useQueryClient();
  const statsRef = useRef({
    hits: 0,
    misses: 0,
  });

  const [stats, setStats] = useState<CacheStats>({
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    cacheSize: 0,
    queryCount: 0,
  });

  useEffect(() => {
    // Función para calcular estadísticas
    const calculateStats = () => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();

      // Calcular tamaño aproximado del cache
      let cacheSize = 0;
      queries.forEach((query) => {
        if (query.state.data) {
          try {
            const dataStr = JSON.stringify(query.state.data);
            cacheSize += new Blob([dataStr]).size;
          } catch (e) {
            // Ignorar errores de serialización
          }
        }
      });

      const totalQueries = statsRef.current.hits + statsRef.current.misses;
      const hitRate =
        totalQueries > 0
          ? (statsRef.current.hits / totalQueries) * 100
          : 0;

      setStats({
        hits: statsRef.current.hits,
        misses: statsRef.current.misses,
        hitRate: Math.round(hitRate * 100) / 100, // 2 decimales
        totalQueries,
        cacheSize,
        queryCount: queries.length,
      });
    };

    // Monitorear eventos de cache
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "observerResultsUpdated") {
        const query = event.query;

        // Detectar cache hit vs miss
        if (query.state.status === "success") {
          const isFetching = query.state.fetchStatus === "fetching";

          if (isFetching) {
            // Fue un fetch real (cache miss)
            statsRef.current.misses++;
          } else {
            // Usó datos cacheados (cache hit)
            statsRef.current.hits++;
          }

          calculateStats();
        }
      }
    });

    // Actualizar stats cada 5 segundos
    const interval = setInterval(calculateStats, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queryClient]);

  /**
   * Reset estadísticas
   */
  const resetStats = () => {
    statsRef.current = { hits: 0, misses: 0 };
    setStats({
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalQueries: 0,
      cacheSize: 0,
      queryCount: 0,
    });
  };

  /**
   * Get tamaño formateado
   */
  const getFormattedCacheSize = () => {
    const kb = stats.cacheSize / 1024;
    const mb = kb / 1024;

    if (mb > 1) {
      return `${mb.toFixed(2)} MB`;
    }
    return `${kb.toFixed(2)} KB`;
  };

  /**
   * Get estado de salud del cache
   */
  const getCacheHealth = (): "excellent" | "good" | "fair" | "poor" => {
    if (stats.hitRate >= 80) return "excellent";
    if (stats.hitRate >= 60) return "good";
    if (stats.hitRate >= 40) return "fair";
    return "poor";
  };

  /**
   * Log stats a console (dev only)
   */
  const logStats = () => {
    if (process.env.NODE_ENV === "development") {
      console.table({
        "Cache Hits": stats.hits,
        "Cache Misses": stats.misses,
        "Hit Rate": `${stats.hitRate}%`,
        "Total Queries": stats.totalQueries,
        "Cache Size": getFormattedCacheSize(),
        "Query Count": stats.queryCount,
        Health: getCacheHealth(),
      });
    }
  };

  return {
    stats,
    resetStats,
    getFormattedCacheSize,
    getCacheHealth,
    logStats,
  };
};
