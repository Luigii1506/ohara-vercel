import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Función para precargar imagen y guardarla en cache del navegador
const preloadImage = async (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
};

// Hook para precargar una imagen individual
export const useImagePreload = (src: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ['image', src],
    queryFn: () => preloadImage(src!),
    enabled: enabled && !!src,
    staleTime: Infinity, // Las imágenes nunca se vuelven stale
    gcTime: 1000 * 60 * 60 * 24, // 24 horas en cache
    retry: 2,
    retryDelay: 1000,
  });
};

// Hook para precargar múltiples imágenes en batch
export const useBatchImagePreload = (urls: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!urls.length) return;

    // ⚡ Precargar primeras 30 imágenes INMEDIATAMENTE (priority)
    const priorityUrls = urls.slice(0, 30);

    priorityUrls.forEach((url) => {
      queryClient.prefetchQuery({
        queryKey: ['image', url],
        queryFn: () => preloadImage(url),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24, // 24 horas
      });
    });

    // ⚡ Batch 2: Siguientes 20 en requestAnimationFrame
    if (urls.length > 30) {
      requestAnimationFrame(() => {
        const secondBatch = urls.slice(30, 50);
        secondBatch.forEach((url) => {
          queryClient.prefetchQuery({
            queryKey: ['image', url],
            queryFn: () => preloadImage(url),
            staleTime: Infinity,
            gcTime: 1000 * 60 * 60 * 24,
          });
        });
      });
    }

    // ⚡ Batch 3: Resto en idle callback
    if (urls.length > 50 && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const restUrls = urls.slice(50, 100);
        restUrls.forEach((url) => {
          queryClient.prefetchQuery({
            queryKey: ['image', url],
            queryFn: () => preloadImage(url),
            staleTime: Infinity,
            gcTime: 1000 * 60 * 60 * 24,
          });
        });
      });
    }
  }, [urls, queryClient]);
};

// Hook para verificar si una imagen está en cache
export const useIsImageCached = (src: string | undefined) => {
  const queryClient = useQueryClient();

  if (!src) return false;

  const cachedData = queryClient.getQueryData(['image', src]);
  return !!cachedData;
};