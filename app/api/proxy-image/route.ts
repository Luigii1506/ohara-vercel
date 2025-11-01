export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * Modified: 2024-01-XX XX:XX - Image proxy endpoint for handling CORS issues with external images
 * Fetches external images server-side and serves them from same domain to avoid CORS
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("Missing image URL parameter", { status: 400 });
  }

  // Validar que sea una URL válida
  try {
    new URL(imageUrl);
  } catch {
    return new NextResponse("Invalid URL format", { status: 400 });
  }

  // Lista de dominios permitidos para proxy (seguridad)
  const allowedDomains = [
    "limitlesstcg.nyc3.digitaloceanspaces.com",
    "digitaloceanspaces.com",
    "limitlesstcg.nyc3.cdn.digitaloceanspaces.com",
    "en.onepiece-cardgame.com",
    "static.dotgg.gg",
    "i.pinimg.com",
    "assets.pokemon.com",
    "bez3ta.com",
    "spellmana.com",
    "oharatcg-21eab.kxcdn.com",
  ];

  const urlObj = new URL(imageUrl);
  const isAllowedDomain = allowedDomains.some(
    (domain) =>
      urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
  );

  if (!isAllowedDomain) {
    return new NextResponse("Domain not allowed", { status: 403 });
  }

  try {
    // Fetch de la imagen externa
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
      return new NextResponse("Failed to fetch image", {
        status: response.status,
      });
    }

    // Verificar que sea una imagen
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 400 });
    }

    // Obtener el buffer de la imagen
    const buffer = await response.arrayBuffer();

    // Crear response con headers apropiados
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache por 24 horas
        "Cross-Origin-Resource-Policy": "cross-origin",
        // NO agregar Access-Control headers aquí ya que se sirve desde el mismo dominio
      },
    });
  } catch (error) {
    console.error("Error proxying image:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
