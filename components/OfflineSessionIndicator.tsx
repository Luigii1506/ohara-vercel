"use client";

import { useOfflineSession } from "@/hooks/useOfflineSession";
import { WifiOff, User } from "lucide-react";

export function OfflineSessionIndicator() {
  const { session, isOffline, isLoading } = useOfflineSession();

  // No mostrar si está cargando o no hay sesión
  if (isLoading || !session) {
    return null;
  }

  // Solo mostrar si estamos offline con sesión cacheada
  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-orange-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
      <WifiOff className="w-4 h-4" />
      <div className="flex items-center gap-2">
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">
          Modo offline - {session.user.email}
        </span>
      </div>
    </div>
  );
}

// Indicador simple para navbar
export function SimpleOfflineIndicator() {
  const { isOffline, isAuthenticated } = useOfflineSession();

  if (!isOffline || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
}
