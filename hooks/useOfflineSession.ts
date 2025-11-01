"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  getSession,
  cacheSession,
  clearCachedSession,
  isOffline,
} from "@/lib/offline-session";

interface OfflineSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
  isOffline: boolean;
}

export function useOfflineSession() {
  const { data: onlineSession, status } = useSession();
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Detectar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => {
      console.log("[OfflineSession] Online");
      setOffline(false);
    };

    const handleOffline = () => {
      console.log("[OfflineSession] Offline");
      setOffline(true);
    };

    setOffline(isOffline());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cargar sesión (online o cacheada)
  useEffect(() => {
    async function loadSession() {
      setIsLoading(true);

      try {
        // Si estamos online y hay sesión, usarla
        if (status === "authenticated" && onlineSession) {
          await cacheSession(onlineSession);
          setSession({
            user: onlineSession.user as any,
            expires: onlineSession.expires,
            isOffline: false,
          });
          setIsLoading(false);
          return;
        }

        // Si estamos offline o la sesión está cargando, intentar usar caché
        if (status === "loading" || offline) {
          const cachedSession = await getSession(null);

          if (cachedSession) {
            setSession({
              user: cachedSession.user,
              expires: cachedSession.expires,
              isOffline: true,
            });
          } else {
            setSession(null);
          }
        }

        // Si no hay sesión online ni cacheada
        if (status === "unauthenticated" && !offline) {
          await clearCachedSession();
          setSession(null);
        }
      } catch (error) {
        console.error("[OfflineSession] Error loading session:", error);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [onlineSession, status, offline]);

  // Sincronizar sesión cuando volvemos online
  useEffect(() => {
    if (!offline && session?.isOffline) {
      // Trigger refresh de sesión online
      console.log("[OfflineSession] Back online, refreshing session");
      setSession((prev) =>
        prev ? { ...prev, isOffline: false } : null
      );
    }
  }, [offline, session?.isOffline]);

  return {
    session,
    isLoading,
    isOffline: offline || session?.isOffline || false,
    isAuthenticated: !!session,
  };
}

// Hook simplificado solo para verificar autenticación
export function useIsAuthenticated() {
  const { session, isLoading } = useOfflineSession();
  return {
    isAuthenticated: !!session,
    isLoading,
  };
}
