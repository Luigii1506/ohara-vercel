"use client";

import { useEffect } from "react";

/**
 * ⚠️ CRÍTICO: Componente para limpiar caches viejos del SW
 *
 * Este componente limpia SOLO los caches de navegación/páginas viejos,
 * pero MANTIENE los caches de imágenes que son útiles.
 *
 * El nuevo SW solo cachea imágenes (no páginas), así que limpiamos
 * los caches viejos de páginas que ya no se usan.
 */
export default function UnregisterSW() {
  useEffect(() => {
    if (typeof window !== "undefined" && "caches" in window) {
      const CACHE_CLEANUP_KEY = "ohara_cache_cleaned_v2";
      const wasAlreadyCleaned = localStorage.getItem(CACHE_CLEANUP_KEY);

      // Solo limpiar una vez por versión
      if (!wasAlreadyCleaned) {
        caches.keys().then((cacheNames) => {
          // Limpiar SOLO caches de páginas/navegación viejos
          const cachesToDelete = cacheNames.filter(
            (name) =>
              name.includes("pages-cache") || // Cache viejo de navegación
              name.includes("next-data") || // Cache viejo de data
              name.includes("document") || // Cache viejo de documentos
              name.includes("start-url") // Cache viejo de start URL
          );

          if (cachesToDelete.length > 0) {
            console.log(
              `🧹 [OHARA] Limpiando ${cachesToDelete.length} cache(s) viejo(s) de páginas...`
            );

            cachesToDelete.forEach((cacheName) => {
              caches.delete(cacheName).then(() => {
                console.log(`✅ [OHARA] Cache eliminado: ${cacheName}`);
              });
            });

            // Marcar como limpiado
            localStorage.setItem(CACHE_CLEANUP_KEY, "true");
          } else {
            console.log("✅ [OHARA] No hay caches viejos para limpiar");
            localStorage.setItem(CACHE_CLEANUP_KEY, "true");
          }
        });
      }
    }
  }, []);

  return null; // No renderiza nada
}
