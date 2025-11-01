"use client";

import { useEffect, useState, useCallback } from "react";

interface SyncStatus {
  isSupported: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSync: Date | null;
}

interface PendingRequest {
  id: number;
  url: string;
  method: string;
  type: string;
  timestamp: number;
}

export function useBackgroundSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isSupported: false,
    pendingCount: 0,
    isSyncing: false,
    lastSync: null,
  });

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Verificar soporte
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkSupport = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "sync" in ServiceWorkerRegistration.prototype;

      setStatus((prev) => ({ ...prev, isSupported: supported }));

      if (supported) {
        // Obtener estado inicial
        await updateSyncStatus();
      }
    };

    checkSupport();
  }, []);

  // Escuchar mensajes del Service Worker
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "SYNC_COMPLETE") {
        console.log("[BackgroundSync] Sync completed:", event.data);

        setStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastSync: new Date(),
          pendingCount: event.data.failed,
        }));

        // Actualizar estado
        updateSyncStatus();

        // Notificar al usuario
        if (event.data.success > 0) {
          if (typeof window !== "undefined" && (window as any).toast) {
            (window as any).toast.success(
              `✅ ${event.data.success} cambio(s) sincronizado(s)`
            );
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  // Actualizar estado de sincronización
  const updateSyncStatus = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === "SYNC_STATUS") {
          setStatus((prev) => ({
            ...prev,
            pendingCount: event.data.pendingCount,
          }));
          setPendingRequests(event.data.pending || []);
        }
      };

      registration.active?.postMessage(
        { type: "GET_SYNC_STATUS" },
        [messageChannel.port2]
      );
    } catch (error) {
      console.error("[BackgroundSync] Error getting status:", error);
    }
  }, []);

  // Forzar sincronización manual
  const forceSync = useCallback(async () => {
    if (!status.isSupported) {
      console.log("[BackgroundSync] Not supported");
      return false;
    }

    try {
      setStatus((prev) => ({ ...prev, isSyncing: true }));

      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === "SYNC_STARTED") {
          console.log("[BackgroundSync] Sync started");
        }
      };

      registration.active?.postMessage(
        { type: "FORCE_SYNC" },
        [messageChannel.port2]
      );

      return true;
    } catch (error) {
      console.error("[BackgroundSync] Error forcing sync:", error);
      setStatus((prev) => ({ ...prev, isSyncing: false }));
      return false;
    }
  }, [status.isSupported]);

  // Limpiar cola de sincronización
  const clearSyncQueue = useCallback(async () => {
    if (!status.isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === "SYNC_QUEUE_CLEARED") {
          console.log(
            `[BackgroundSync] Cleared ${event.data.cleared} items`
          );
          updateSyncStatus();
        }
      };

      registration.active?.postMessage(
        { type: "CLEAR_SYNC_QUEUE" },
        [messageChannel.port2]
      );

      return true;
    } catch (error) {
      console.error("[BackgroundSync] Error clearing queue:", error);
      return false;
    }
  }, [status.isSupported, updateSyncStatus]);

  return {
    ...status,
    pendingRequests,
    forceSync,
    clearSyncQueue,
    updateStatus: updateSyncStatus,
  };
}

// Hook simplificado para solo verificar si hay pendientes
export function useSyncIndicator() {
  const [hasPending, setHasPending] = useState(false);
  const { pendingCount, updateStatus } = useBackgroundSync();

  useEffect(() => {
    setHasPending(pendingCount > 0);
  }, [pendingCount]);

  useEffect(() => {
    // Actualizar cada 10 segundos
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, [updateStatus]);

  return hasPending;
}
