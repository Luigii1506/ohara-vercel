"use client";

import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

/**
 * 📡 Página Offline Fallback
 *
 * Se muestra cuando:
 * 1. Usuario está offline
 * 2. La página solicitada no está en cache
 * 3. Service Worker no puede servir la página
 */
export default function OfflinePage() {
  const router = useRouter();

  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-100 rounded-full blur-xl opacity-50"></div>
            <div className="relative bg-orange-500 p-6 rounded-full">
              <WifiOff className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Sin Conexión
        </h1>

        {/* Descripción */}
        <p className="text-gray-600 mb-2">
          No pudimos cargar esta página porque no tienes conexión a internet.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Verifica tu conexión WiFi o datos móviles e inténtalo de nuevo.
        </p>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">
            💡 Consejo:
          </h3>
          <p className="text-xs text-blue-700">
            Si visitaste esta página anteriormente mientras estabas conectado,
            debería cargarse desde el caché. Intenta refrescar la página.
          </p>
        </div>

        {/* Acciones */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            size="lg"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Intentar de Nuevo
          </Button>

          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Home className="h-4 w-4 mr-2" />
            Ir al Inicio
          </Button>
        </div>

        {/* Info adicional */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Una vez recuperes la conexión, esta página se actualizará automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
