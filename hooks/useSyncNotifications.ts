import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

/**
 * 🔔 Hook para notificaciones de sincronización
 *
 * Muestra toasts cuando:
 * - Se sincronizan datos en background
 * - Hay errores de sync
 * - Se recupera conexión
 */
export const useSyncNotifications = (options?: {
  enableSuccessToasts?: boolean;
  enableErrorToasts?: boolean;
  enableBackgroundSync?: boolean;
}) => {
  const queryClient = useQueryClient();
  const lastSyncRef = useRef<number>(Date.now());

  const {
    enableSuccessToasts = false, // Por defecto NO mostrar (evitar spam)
    enableErrorToasts = true,
    enableBackgroundSync = true,
  } = options || {};

  useEffect(() => {
    // Monitorear eventos de sincronización
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        const query = event.query;
        const queryKey = query.queryKey;

        // Solo notificar para query de cards
        if (queryKey[0] === "cards") {
          const now = Date.now();
          const timeSinceLastSync = now - lastSyncRef.current;

          // Evitar spam: solo si pasaron >30 segundos desde último sync
          if (
            enableBackgroundSync &&
            timeSinceLastSync > 30000 &&
            query.state.fetchStatus === "idle"
          ) {
            // Background sync completado
            if (enableSuccessToasts) {
              toast.success("Datos actualizados", {
                position: "bottom-right",
                autoClose: 2000,
                hideProgressBar: true,
              });
            }
            lastSyncRef.current = now;
          }
        }
      }

      // Errores de sync
      if (event.type === "updated" && event.action.type === "error") {
        const query = event.query;
        const error = query.state.error as Error;

        if (enableErrorToasts && query.queryKey[0] === "cards") {
          const isNetworkError =
            error?.message?.includes("fetch") ||
            error?.message?.includes("Network");

          if (!isNetworkError) {
            // Solo mostrar si NO es error de red (esos se manejan con OfflineIndicator)
            toast.error("Error al sincronizar datos", {
              position: "bottom-right",
              autoClose: 4000,
            });
          }
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient, enableSuccessToasts, enableErrorToasts, enableBackgroundSync]);

  /**
   * Mostrar toast de sync manual
   */
  const showSyncToast = () => {
    toast.info("Sincronizando...", {
      position: "bottom-right",
      autoClose: 2000,
    });
  };

  /**
   * Mostrar toast de sync completado
   */
  const showSyncCompleteToast = (message = "Sincronización completada") => {
    toast.success(message, {
      position: "bottom-right",
      autoClose: 2000,
    });
  };

  /**
   * Mostrar toast de sync fallido
   */
  const showSyncErrorToast = (error?: string) => {
    toast.error(error || "Error al sincronizar", {
      position: "bottom-right",
      autoClose: 4000,
    });
  };

  return {
    showSyncToast,
    showSyncCompleteToast,
    showSyncErrorToast,
  };
};

/**
 * 🎯 Hook para toast de mutation events
 */
export const useMutationNotifications = () => {
  const showCreateSuccess = (name: string) => {
    toast.success(`${name} creado exitosamente`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const showUpdateSuccess = (name: string) => {
    toast.success(`${name} actualizado`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const showDeleteSuccess = (name: string) => {
    toast.success(`${name} eliminado`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const showMutationError = (action: string, error?: string) => {
    toast.error(error || `Error al ${action}`, {
      position: "top-right",
      autoClose: 5000,
    });
  };

  const showOptimisticUpdate = (message: string) => {
    toast.info(message, {
      position: "bottom-right",
      autoClose: 2000,
      hideProgressBar: true,
    });
  };

  return {
    showCreateSuccess,
    showUpdateSuccess,
    showDeleteSuccess,
    showMutationError,
    showOptimisticUpdate,
  };
};

/**
 * 📊 Toast para cache events (dev only)
 */
export const useCacheEventToasts = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "added") {
        console.log("🆕 Query added:", event.query.queryKey);
      }

      if (event.type === "removed") {
        console.log("🗑️ Query removed:", event.query.queryKey);
      }
    });

    return () => unsubscribe();
  }, [queryClient]);
};
