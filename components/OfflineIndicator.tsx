"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 📡 Componente que muestra estado de conexión
 *
 * - Banner cuando está offline
 * - Toast cuando se recupera conexión
 * - Indicador visual en esquina
 */
export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Acaba de reconectar
      setShowReconnected(true);
      setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  return (
    <>
      {/* Banner Offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white py-3 px-4 shadow-lg animate-slide-down">
          <div className="container mx-auto flex items-center justify-center gap-2">
            <WifiOff className="h-5 w-5" />
            <span className="font-medium">
              Sin conexión a internet - Modo Offline
            </span>
          </div>
        </div>
      )}

      {/* Toast Reconectado */}
      {showReconnected && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white py-3 px-6 rounded-lg shadow-xl animate-slide-up">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">Conexión restablecida</span>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * 🔴 Indicador compacto en esquina (siempre visible)
 */
export const OfflineStatusDot = () => {
  const isOnline = useOnlineStatus();

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      <div
        className={`h-3 w-3 rounded-full transition-all duration-300 ${
          isOnline
            ? "bg-green-500 shadow-green-500/50"
            : "bg-orange-500 shadow-orange-500/50 animate-pulse"
        } shadow-lg`}
      />
      <span className="text-xs font-medium text-gray-600 hidden sm:inline">
        {isOnline ? "En línea" : "Sin conexión"}
      </span>
    </div>
  );
};

/**
 * 📱 Badge compacto para usar en navbar/header
 */
export const OfflineBadge = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
      <WifiOff className="h-3 w-3" />
      <span>Offline</span>
    </div>
  );
};

export default OfflineIndicator;
