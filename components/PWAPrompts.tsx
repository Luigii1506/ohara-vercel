"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Verificar si el usuario ya rechazó la instalación
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    // Si lo rechazó hace menos de 3 días, no mostrar
    if (dismissedTime && Date.now() - dismissedTime < threeDays) {
      return;
    }

    // Capturar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);

      // Mostrar el prompt después de 30 segundos (para no ser intrusivo)
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Mostrar el prompt nativo
    deferredPrompt.prompt();

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_install_prompt", {
        outcome: outcome,
      });
    }

    // Limpiar el prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Guardar que el usuario rechazó
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_install_dismissed");
    }
  };

  // Si está instalado o no hay prompt, no mostrar nada
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom">
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10 rounded-lg shadow-2xl p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center">
            <img
              src="/icons/icon-72x72.png"
              alt="Ohara TCG"
              className="w-10 h-10"
            />
          </div>

          <div className="flex-1 pr-6">
            <h3 className="font-bold text-white text-lg mb-1">
              Instalar Ohara TCG
            </h3>
            <p className="text-white/70 text-sm mb-3">
              Acceso rápido, modo offline y mejor experiencia. ¡Instala la app!
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg"
              >
                Instalar
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Verificar si hay un SW esperando
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Escuchar por nuevas actualizaciones
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setShowUpdate(true);

              // Track analytics
              if (typeof window !== "undefined" && (window as any).gtag) {
                (window as any).gtag("event", "pwa_update_available");
              }
            }
          });
        });
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    };

    checkForUpdates();

    // Verificar por actualizaciones cada 1 hora
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) return;

    // Enviar mensaje al SW para que se active
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_update_accepted");
    }

    // Escuchar por la activación del nuevo SW
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  };

  const handleDismiss = () => {
    setShowUpdate(false);

    // Track analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_update_dismissed");
    }
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-top">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg shadow-2xl p-4 text-white">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-blue-600"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Nueva versión disponible</h3>
            <p className="text-white/90 text-sm mb-3">
              Hay una actualización lista. Recarga para obtener las últimas
              mejoras.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg"
              >
                Actualizar ahora
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-white/80 hover:text-white transition-colors"
              >
                Después
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PWAPrompts() {
  return (
    <>
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
    </>
  );
}
