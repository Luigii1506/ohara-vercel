"use client";

import { useEffect } from "react";

interface PWAMetrics {
  isInstalled: boolean;
  isStandalone: boolean;
  displayMode: string;
  deviceType: "mobile" | "tablet" | "desktop";
  platform: string;
}

// Helper functions
const getDisplayMode = () => {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia("(display-mode: standalone)").matches)
    return "standalone";
  if (window.matchMedia("(display-mode: fullscreen)").matches)
    return "fullscreen";
  if (window.matchMedia("(display-mode: minimal-ui)").matches)
    return "minimal-ui";
  return "browser";
};

const getDeviceType = (): "mobile" | "tablet" | "desktop" => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

export function usePWAAnalytics() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackPWAMetrics = () => {
      // Detectar si está instalado
      const isInstalled =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      const metrics: PWAMetrics = {
        isInstalled,
        isStandalone: isInstalled,
        displayMode: getDisplayMode(),
        deviceType: getDeviceType(),
        platform: navigator.platform,
      };

      // Enviar a analytics (Google Analytics, PostHog, etc.)
      if ((window as any).gtag) {
        (window as any).gtag("event", "pwa_metrics", {
          ...metrics,
          session_start: new Date().toISOString(),
        });
      }

      // Console log para debugging
      console.log("[PWA Analytics]", metrics);

      // Guardar en localStorage para tracking
      localStorage.setItem("pwa_metrics", JSON.stringify(metrics));

      // Track instalación
      if (isInstalled) {
        const firstInstall = !localStorage.getItem("pwa_installed");
        if (firstInstall) {
          localStorage.setItem("pwa_installed", Date.now().toString());

          if ((window as any).gtag) {
            (window as any).gtag("event", "pwa_installed", {
              timestamp: Date.now(),
              device_type: metrics.deviceType,
            });
          }

          console.log("[PWA] App installed!");
        }
      }
    };

    // Track métricas al cargar
    trackPWAMetrics();

    // Track cuando cambia el display mode
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = () => trackPWAMetrics();
    mediaQuery.addEventListener("change", handleChange);

    // Track engagement (tiempo de uso)
    let startTime = Date.now();

    const trackEngagement = () => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000); // segundos

      if ((window as any).gtag) {
        (window as any).gtag("event", "pwa_engagement", {
          time_spent: timeSpent,
          display_mode: getDisplayMode(),
        });
      }

      // Reset timer
      startTime = Date.now();
    };

    // Track engagement cada 5 minutos
    const engagementInterval = setInterval(trackEngagement, 5 * 60 * 1000);

    // Track al cerrar/salir
    const handleBeforeUnload = () => {
      trackEngagement();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Track visibilidad de página
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        trackEngagement();
      } else {
        startTime = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      clearInterval(engagementInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Función helper para trackear eventos personalizados
  const trackPWAEvent = (
    eventName: string,
    eventParams?: Record<string, any>
  ) => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", `pwa_${eventName}`, {
        ...eventParams,
        timestamp: Date.now(),
      });
    }

    console.log(`[PWA Event] ${eventName}`, eventParams);
  };

  return { trackPWAEvent };
}

// Hook para detectar si está instalado
export function useIsInstalled() {
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const checkInstalled = () => {
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(installed);
    };

    checkInstalled();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkInstalled);

    return () => mediaQuery.removeEventListener("change", checkInstalled);
  }, []);

  return isInstalled;
}

// Necesitamos importar React para useState
import React from "react";
