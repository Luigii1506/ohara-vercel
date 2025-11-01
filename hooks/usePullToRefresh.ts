import { useCallback, useRef, useState } from "react";

/**
 * 📱 Hook para Pull-to-Refresh en móviles
 *
 * Detecta gestos de pull-down y ejecuta callback de refresh
 *
 * @param onRefresh - Función async a ejecutar al hacer pull
 * @param threshold - Distancia mínima para trigger (default: 80px)
 */
export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  threshold = 80
) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const container = containerRef.current;
      if (!container || container.scrollTop > 0 || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        // Pull down detectado
        setIsPulling(true);
        // Efecto de resistencia (disminuye velocidad al jalar)
        const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(resistedDistance);

        // Prevenir scroll default si está jalando hacia abajo
        if (distance > 10) {
          e.preventDefault();
        }
      }
    },
    [threshold, isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold); // Mantener en threshold mientras refresca

      try {
        await onRefresh();
      } catch (error) {
        console.error("Pull-to-refresh error:", error);
      } finally {
        // Animación de reset
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 300);
      }
    } else {
      // No alcanzó threshold, reset
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  const bindContainer = {
    ref: containerRef,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  const pullProgress = Math.min((pullDistance / threshold) * 100, 100);
  const shouldTrigger = pullDistance >= threshold;

  return {
    bindContainer,
    isPulling,
    pullDistance,
    isRefreshing,
    pullProgress, // 0-100%
    shouldTrigger, // true si alcanzó threshold
  };
};
