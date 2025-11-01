import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import type { CardWithCollectionData } from "@/types";

/**
 * 🚀 Hook optimizado para prefetch de cartas
 *
 * Precarga datos de carta individual cuando el usuario hace hover
 * Usa debounce inteligente para evitar prefetch excesivo
 */
export const usePrefetchCard = () => {
  const queryClient = useQueryClient();
  const prefetchTimeout = useRef<NodeJS.Timeout>();
  const prefetchedCards = useRef(new Set<string>());

  /**
   * Prefetch carta individual (para modal)
   */
  const prefetchCard = useCallback(
    (cardId: string) => {
      // Si ya fue prefetched, skip
      if (prefetchedCards.current.has(cardId)) return;

      // Cancelar prefetch anterior si existe
      if (prefetchTimeout.current) {
        clearTimeout(prefetchTimeout.current);
      }

      // Debounce de 150ms (usuario debe mantener hover)
      prefetchTimeout.current = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: ["cards", "detail", cardId],
          queryFn: async () => {
            const res = await fetch(`/api/cards/${cardId}`);
            if (!res.ok) throw new Error("Failed to fetch card");
            return res.json();
          },
          staleTime: 1000 * 60 * 5, // 5 minutos
        });

        prefetchedCards.current.add(cardId);
      }, 150);
    },
    [queryClient]
  );

  /**
   * Prefetch imágenes (CDN/KeyCDN)
   */
  const prefetchImage = useCallback((imageSrc: string, priority = false) => {
    if (!imageSrc) return;

    // Verificar si ya está en cache del navegador
    const img = new Image();

    if (priority) {
      // Alta prioridad: cargar inmediatamente
      img.loading = "eager";
    } else {
      // Baja prioridad: lazy load
      img.loading = "lazy";
    }

    img.src = imageSrc;
    // La imagen se cacheará en browser cache automáticamente
  }, []);

  /**
   * Prefetch relacionados (alternates)
   */
  const prefetchRelatedCards = useCallback(
    (card: CardWithCollectionData) => {
      if (!card.alternates?.length) return;

      // Prefetch solo primeras 3 alternativas (evitar sobrecarga)
      card.alternates.slice(0, 3).forEach((alt) => {
        if (alt.src) {
          prefetchImage(alt.src, false);
        }
      });
    },
    [prefetchImage]
  );

  /**
   * Cleanup al desmontar
   */
  const cleanup = useCallback(() => {
    if (prefetchTimeout.current) {
      clearTimeout(prefetchTimeout.current);
    }
  }, []);

  return {
    prefetchCard,
    prefetchImage,
    prefetchRelatedCards,
    cleanup,
  };
};

/**
 * 🎯 Hook para prefetch inteligente en listas
 *
 * Prefetch cartas visibles + siguientes N cartas
 */
export const usePrefetchVisibleCards = (cards: CardWithCollectionData[]) => {
  const { prefetchImage } = usePrefetchCard();

  const prefetchVisible = useCallback(
    (startIndex: number, count = 20) => {
      const endIndex = Math.min(startIndex + count, cards.length);

      // Prefetch en chunks para no bloquear
      const chunk = cards.slice(startIndex, endIndex);

      // Usar requestIdleCallback si está disponible
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          chunk.forEach((card) => {
            prefetchImage(card.src, false);
          });
        });
      } else {
        // Fallback: setTimeout
        setTimeout(() => {
          chunk.forEach((card) => {
            prefetchImage(card.src, false);
          });
        }, 100);
      }
    },
    [cards, prefetchImage]
  );

  return { prefetchVisible };
};
