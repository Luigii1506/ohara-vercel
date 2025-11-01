"use client";

import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { Cloud, CloudOff, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";

export function SyncIndicator() {
  const {
    isSupported,
    pendingCount,
    isSyncing,
    lastSync,
    pendingRequests,
    forceSync,
    updateStatus,
  } = useBackgroundSync();

  const [isOnline, setIsOnline] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Actualizar cuando cambia el estado online/offline
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Esperar 1 segundo y luego actualizar estado
      const timer = setTimeout(() => {
        updateStatus();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, updateStatus]);

  if (!isSupported) {
    return null;
  }

  // No mostrar si no hay nada pendiente y está online
  if (pendingCount === 0 && isOnline && !isSyncing) {
    return null;
  }

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (!isOnline) {
      return <CloudOff className="w-4 h-4" />;
    }
    if (pendingCount > 0) {
      return <Clock className="w-4 h-4" />;
    }
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (isSyncing) {
      return "Sincronizando...";
    }
    if (!isOnline) {
      return `${pendingCount} cambio(s) pendiente(s) (Sin conexión)`;
    }
    if (pendingCount > 0) {
      return `${pendingCount} cambio(s) esperando sincronización`;
    }
    return "Sincronizado";
  };

  const getStatusColor = () => {
    if (isSyncing) return "bg-blue-500/10 border-blue-500/20 text-blue-400";
    if (!isOnline)
      return "bg-orange-500/10 border-orange-500/20 text-orange-400";
    if (pendingCount > 0)
      return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
    return "bg-green-500/10 border-green-500/20 text-green-400";
  };

  return (
    <>
      {/* Indicador compacto */}
      <div
        className={`fixed bottom-20 right-4 z-40 ${getStatusColor()} border rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:shadow-lg transition-all duration-200`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {/* Panel de detalles */}
      {showDetails && (
        <div className="fixed bottom-36 right-4 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl w-80 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Estado de Sincronización
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Estado:</span>
              <span
                className={`font-medium ${
                  isOnline ? "text-green-400" : "text-orange-400"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {lastSync && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-white/70">Última sync:</span>
                <span className="text-white/50 text-xs">
                  {lastSync.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Pending requests */}
          {pendingCount > 0 && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-sm text-white/70 mb-2">
                Cambios pendientes ({pendingCount}):
              </div>
              <div className="space-y-2">
                {pendingRequests.slice(0, 10).map((req) => (
                  <div
                    key={req.id}
                    className="bg-white/5 rounded p-2 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 font-medium">
                        {req.type === "deck"
                          ? "Deck"
                          : req.type === "collection"
                          ? "Colección"
                          : "Otro"}
                      </span>
                      <span className="text-white/50">
                        {new Date(req.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-white/50 truncate">{req.method} {req.url.split('/').pop()}</div>
                  </div>
                ))}
                {pendingRequests.length > 10 && (
                  <div className="text-white/50 text-xs text-center">
                    + {pendingRequests.length - 10} más...
                  </div>
                )}
              </div>
            </div>
          )}

          {pendingCount === 0 && !isSyncing && (
            <div className="p-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-white/70 text-sm">
                Todo sincronizado
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={async () => {
                await forceSync();
                setTimeout(() => updateStatus(), 1000);
              }}
              disabled={!isOnline || isSyncing || pendingCount === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar ahora
                </>
              )}
            </button>

            {!isOnline && (
              <p className="text-orange-400 text-xs text-center mt-2">
                Se sincronizará automáticamente cuando vuelva la conexión
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Indicador simple solo para la UI
export function SimpleSyncIndicator() {
  const { pendingCount, isSyncing } = useBackgroundSync();

  if (pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-orange-400">
      {isSyncing ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" />
          <span>{pendingCount} pendiente(s)</span>
        </>
      )}
    </div>
  );
}
