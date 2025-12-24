/**
 * Custom hook para detección de viewport responsive
 * Maneja SSR correctamente y previene hydration mismatch
 */

import { useState, useEffect } from "react";

/**
 * Hook para detectar si el viewport coincide con un media query
 * @param query - Media query string (ej: "(min-width: 768px)")
 * @param defaultValue - Valor por defecto durante SSR
 * @returns boolean indicando si el media query coincide
 */
export function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(defaultValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const mediaQuery = window.matchMedia(query);

    // Actualizar al valor real del cliente
    setMatches(mediaQuery.matches);

    // Escuchar cambios (resize, rotation)
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
    // Legacy API (Safari < 14)
    else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  // Durante SSR o antes de montar, usar defaultValue
  if (!mounted) {
    return defaultValue;
  }

  return matches;
}

/**
 * Hook específico para detectar desktop (>= 768px)
 * Mobile-first: por defecto asume mobile durante SSR
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)", false);
}

/**
 * Hook para detectar diferentes breakpoints
 */
export function useBreakpoint() {
  const isSm = useMediaQuery("(min-width: 640px)", false);
  const isMd = useMediaQuery("(min-width: 768px)", false);
  const isLg = useMediaQuery("(min-width: 1024px)", false);
  const isXl = useMediaQuery("(min-width: 1280px)", false);
  const is2Xl = useMediaQuery("(min-width: 1536px)", false);

  return {
    isMobile: !isMd,
    isTablet: isMd && !isLg,
    isDesktop: isMd,
    isLargeDesktop: isXl,
    breakpoint: is2Xl ? "2xl" : isXl ? "xl" : isLg ? "lg" : isMd ? "md" : isSm ? "sm" : "xs",
  };
}
