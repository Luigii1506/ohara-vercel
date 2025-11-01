"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SharePage() {
  const router = useRouter();
  const [sharedData, setSharedData] = useState<{
    title?: string;
    text?: string;
    url?: string;
    images?: File[];
  } | null>(null);

  useEffect(() => {
    // Obtener datos del share desde la URL
    const params = new URLSearchParams(window.location.search);

    const title = params.get("title") || undefined;
    const text = params.get("text") || undefined;
    const url = params.get("url") || undefined;

    setSharedData({ title, text, url });

    // Si es una URL de carta, redirigir
    if (url && url.includes("card")) {
      // Extraer ID de carta si es posible
      const match = url.match(/card[/-](\w+)/);
      if (match) {
        router.push(`/card/${match[1]}`);
        return;
      }
    }

    // Si es texto de deck, abrir deck builder
    if (text && text.includes("deck")) {
      router.push("/deckbuilder");
      return;
    }
  }, [router]);

  if (!sharedData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Procesando contenido compartido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-4">
          Contenido Compartido
        </h1>

        {sharedData.title && (
          <div className="mb-4">
            <label className="text-white/70 text-sm">Título:</label>
            <p className="text-white">{sharedData.title}</p>
          </div>
        )}

        {sharedData.text && (
          <div className="mb-4">
            <label className="text-white/70 text-sm">Texto:</label>
            <p className="text-white">{sharedData.text}</p>
          </div>
        )}

        {sharedData.url && (
          <div className="mb-4">
            <label className="text-white/70 text-sm">URL:</label>
            <p className="text-white break-all">{sharedData.url}</p>
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => router.push("/")}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
          >
            Ir al inicio
          </button>
          <button
            onClick={() => router.push("/card-list")}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
          >
            Ver cartas
          </button>
        </div>
      </div>
    </div>
  );
}
