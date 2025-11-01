"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Mapa de colores por ruta
const THEME_COLORS: Record<string, string> = {
  "/": "#1a1a1a", // Home - Negro
  "/card-list": "#2c1810", // Cards - Marrón oscuro (mapas)
  "/deckbuilder": "#1e3a8a", // Deck builder - Azul
  "/collection": "#065f46", // Collection - Verde
  "/market": "#7c2d12", // Market - Naranja oscuro
  "/tier-list": "#7e22ce", // Tier list - Púrpura
  "/login": "#1a1a1a", // Login - Negro
  "/profile": "#1e293b", // Profile - Gris azulado
  "/seller": "#991b1b", // Seller - Rojo oscuro
};

// Color por defecto
const DEFAULT_COLOR = "#1a1a1a";

export function DynamicThemeColor() {
  const pathname = usePathname();

  useEffect(() => {
    // Obtener el color basado en la ruta
    let themeColor = DEFAULT_COLOR;

    // Buscar coincidencia exacta primero
    if (pathname && THEME_COLORS[pathname]) {
      themeColor = THEME_COLORS[pathname];
    } else if (pathname) {
      // Buscar coincidencia por prefijo (para rutas dinámicas)
      const matchedRoute = Object.keys(THEME_COLORS).find((route) =>
        pathname.startsWith(route)
      );
      if (matchedRoute) {
        themeColor = THEME_COLORS[matchedRoute];
      }
    }

    // Actualizar meta tag theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }

    metaThemeColor.setAttribute("content", themeColor);

    // También actualizar para iOS Safari
    let appleStatusBar = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    );
    if (appleStatusBar) {
      // Determinar si usar black o black-translucent basado en el color
      const brightness = getBrightness(themeColor);
      appleStatusBar.setAttribute(
        "content",
        brightness > 128 ? "default" : "black-translucent"
      );
    }
  }, [pathname]);

  return null; // Este componente no renderiza nada
}

// Helper para calcular brillo de un color hex
function getBrightness(hexColor: string): number {
  // Remover #
  const hex = hexColor.replace("#", "");

  // Convertir a RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calcular brillo (fórmula de luminancia)
  return (r * 299 + g * 587 + b * 114) / 1000;
}
