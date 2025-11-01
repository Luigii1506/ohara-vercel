"use client";

import { useEffect } from "react";
import { useBadge } from "@/hooks/useBadge";

interface NotificationBadgeProps {
  unreadCount: number;
}

/**
 * Componente que actualiza el badge del icono de la app
 * cuando hay notificaciones no leídas
 */
export function NotificationBadge({ unreadCount }: NotificationBadgeProps) {
  const { setBadge, clearBadge, isSupported } = useBadge();

  useEffect(() => {
    if (!isSupported) return;

    if (unreadCount > 0) {
      setBadge(unreadCount);
    } else {
      clearBadge();
    }
  }, [unreadCount, setBadge, clearBadge, isSupported]);

  return null; // Este componente no renderiza nada visible
}

/**
 * Ejemplo de uso con contexto de notificaciones
 */
export function NotificationBadgeExample() {
  // En una app real, esto vendría de un contexto o estado global
  // Ejemplo: useSelector(state => state.notifications.unread)
  const unreadNotifications = 0;

  return <NotificationBadge unreadCount={unreadNotifications} />;
}
