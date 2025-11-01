"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

export function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Verificar soporte
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (!supported) return;

    // Obtener estado de permiso
    setPermission(Notification.permission);

    // Verificar si ya está suscrito
    checkSubscription();

    // Mostrar prompt después de 2 minutos (si no ha dado permiso)
    const timer = setTimeout(() => {
      if (Notification.permission === "default") {
        setShowPrompt(true);
      }
    }, 2 * 60 * 1000);

    return () => clearTimeout(timer);
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const subscribeToPush = async () => {
    try {
      // Solicitar permiso
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission !== "granted") {
        console.log("Push notification permission denied");
        return;
      }

      // Obtener Service Worker registration
      const registration = await navigator.serviceWorker.ready;

      // Suscribirse a push notifications
      // NOTA: Necesitarás generar VAPID keys para producción
      // Puedes usar: npm run pwa:vapid
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        console.error("VAPID key not configured. Run: npm run pwa:vapid");
        alert("Push notifications no están configuradas. Consulta la documentación.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Enviar subscription al servidor
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      setIsSubscribed(true);
      setShowPrompt(false);

      // Track analytics
      if ((window as any).gtag) {
        (window as any).gtag("event", "push_notification_subscribed");
      }

      // Mostrar notificación de bienvenida
      new Notification("¡Notificaciones activadas!", {
        body: "Ahora recibirás actualizaciones sobre nuevas cartas y sets.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
      });
    } catch (error) {
      console.error("Error subscribing to push:", error);
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notificar al servidor
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setIsSubscribed(false);

        // Track analytics
        if ((window as any).gtag) {
          (window as any).gtag("event", "push_notification_unsubscribed");
        }
      }
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("push-prompt-dismissed", Date.now().toString());

    // Track analytics
    if ((window as any).gtag) {
      (window as any).gtag("event", "push_notification_dismissed");
    }
  };

  if (!isSupported) {
    return null;
  }

  // Botón flotante para gestionar notificaciones
  return (
    <>
      {/* Prompt inicial */}
      {showPrompt && permission === "default" && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom">
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg shadow-2xl p-4 text-white">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-purple-600" />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">
                  Activa las notificaciones
                </h3>
                <p className="text-white/90 text-sm mb-3">
                  Entérate de nuevas cartas, sets y actualizaciones importantes.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={subscribeToPush}
                    className="flex-1 bg-white text-purple-600 font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg"
                  >
                    Activar
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 text-white/80 hover:text-white transition-colors"
                  >
                    No gracias
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botón de configuración (siempre visible si está soportado) */}
      <button
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        className="fixed bottom-24 right-4 z-40 bg-gradient-to-r from-purple-600 to-purple-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
        title={
          isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"
        }
      >
        {isSubscribed ? <Bell size={24} /> : <BellOff size={24} />}
      </button>
    </>
  );
}

// Helper para convertir VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
