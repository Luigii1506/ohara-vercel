"use client";

import { useEffect, useCallback } from "react";

declare global {
  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

export function useBadge() {
  const isSupported =
    typeof navigator !== "undefined" &&
    "setAppBadge" in navigator &&
    "clearAppBadge" in navigator;

  const setBadge = useCallback(
    async (count?: number) => {
      if (!isSupported) {
        console.log("[Badge] Not supported");
        return;
      }

      try {
        if (count !== undefined && count > 0) {
          await navigator.setAppBadge!(count);
          console.log(`[Badge] Set to ${count}`);
        } else {
          await navigator.setAppBadge!();
          console.log("[Badge] Set (no count)");
        }

        // Track analytics
        if ((window as any).gtag) {
          (window as any).gtag("event", "badge_set", {
            count: count || 0,
          });
        }
      } catch (error) {
        console.error("[Badge] Error setting badge:", error);
      }
    },
    [isSupported]
  );

  const clearBadge = useCallback(async () => {
    if (!isSupported) {
      console.log("[Badge] Not supported");
      return;
    }

    try {
      await navigator.clearAppBadge!();
      console.log("[Badge] Cleared");

      // Track analytics
      if ((window as any).gtag) {
        (window as any).gtag("event", "badge_cleared");
      }
    } catch (error) {
      console.error("[Badge] Error clearing badge:", error);
    }
  }, [isSupported]);

  // Auto-clear badge cuando la app está en focus
  useEffect(() => {
    if (!isSupported) return;

    const handleFocus = () => {
      // Opcional: Auto-limpiar badge cuando el usuario abre la app
      // clearBadge();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isSupported, clearBadge]);

  return { setBadge, clearBadge, isSupported };
}

// Hook para trackear notificaciones no leídas
export function useUnreadBadge() {
  const { setBadge, clearBadge } = useBadge();

  const updateUnreadCount = useCallback(
    async (count: number) => {
      if (count > 0) {
        await setBadge(count);
      } else {
        await clearBadge();
      }
    },
    [setBadge, clearBadge]
  );

  return { updateUnreadCount };
}
