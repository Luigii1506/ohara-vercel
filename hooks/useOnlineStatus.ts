"use client";

import { useEffect, useState } from "react";

/**
 * Hook para detectar estado online/offline
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Inicializar con el estado actual
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log("✅ Conexión restaurada");
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.warn("⚠️ Sin conexión a internet");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};
