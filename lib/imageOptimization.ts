/**
 * Utilidades para optimización de imágenes
 * Soporta: Cloudflare R2, KeyCDN, Cloudinary, Imgix, S3, Cloudflare Images
 * Actualizado: 2025-01-06
 *
 * MIGRACIÓN R2:
 * - Primary: Cloudflare R2 + Workers (images.oharatcg.com)
 * - Fallback: KeyCDN (oharatcg-21eab.kxcdn.com)
 */

export type ImageSize =
  | "tiny"
  | "xs"
  | "thumb"
  | "small"
  | "medium"
  | "large"
  | "original";

interface ImageOptimizationConfig {
  tiny: { width: 20; height: 28; quality: 40 }; // LQIP - Low Quality Image Placeholder (blur)
  xs: { width: 100; height: 140; quality: 60 }; // Ultra fast initial load
  thumb: { width: 200; height: 280; quality: 70 }; // Grid thumbnails
  small: { width: 300; height: 420; quality: 75 };
  medium: { width: 600; height: 840; quality: 80 };
  large: { width: 800; height: 1120; quality: 85 };
  original: { width: null; height: null; quality: 90 };
}

const IMAGE_CONFIG: ImageOptimizationConfig = {
  tiny: { width: 20, height: 28, quality: 40 },
  xs: { width: 100, height: 140, quality: 60 },
  thumb: { width: 200, height: 280, quality: 70 },
  small: { width: 300, height: 420, quality: 75 },
  medium: { width: 600, height: 840, quality: 80 },
  large: { width: 800, height: 1120, quality: 85 },
  original: { width: null, height: null, quality: 90 },
};

/**
 * Optimiza URL de imagen
 * Soporta: Cloudflare R2, KeyCDN, Cloudinary, Imgix, S3, Cloudflare Images
 *
 * ESTRATEGIA DE MIGRACIÓN:
 * 1. Si es URL de R2 → usar size suffix pre-generado (cards/image-thumb.webp)
 * 2. Si es URL antigua (KeyCDN) → agregar parámetros de transformación
 * 3. Fallback automático si falla
 */
export const getOptimizedImageUrl = (
  url: string | undefined,
  size: ImageSize = "medium"
): string => {
  if (!url) return "";

  const config = IMAGE_CONFIG[size];

  try {
    const urlObj = new URL(url);

    // ============================================
    // CLOUDFLARE R2 (NUEVO - PRIMARY)
    // ============================================
    // R2 URLs: https://images.oharatcg.com/* or https://pub-xxxxx.r2.dev/* or https://xxx.workers.dev/*
    if (
      urlObj.hostname.includes("oharatcg.com") ||
      urlObj.hostname.includes(".r2.dev") ||
      urlObj.hostname.includes(".workers.dev")
    ) {
      // R2 usa pre-generated sizes con suffix
      // Ejemplo: cards/OP01-001-thumb.webp, cards/OP01-001-medium.webp
      const sizeSuffix = getSizeSuffix(size);
      const pathname = urlObj.pathname;

      // Si ya tiene suffix, retornar as-is
      if (pathname.includes(sizeSuffix)) {
        return url;
      }

      // Agregar suffix al nombre del archivo
      const ext = pathname.substring(pathname.lastIndexOf("."));
      const basePath = pathname.substring(0, pathname.lastIndexOf("."));

      // Cambiar extensión a WebP si no lo es ya
      const outputExt = ext.toLowerCase() === ".gif" ? ext : ".webp";

      return `${urlObj.origin}${basePath}${sizeSuffix}${outputExt}`;
    }

    // ============================================
    // KeyCDN (LEGACY - FALLBACK)
    // ============================================
    if (
      urlObj.hostname.includes("kxcdn.com") ||
      urlObj.hostname.includes("oharatcg")
    ) {
      const params = new URLSearchParams();

      if (config.width) params.set("width", config.width.toString());
      if (config.height) params.set("height", config.height.toString());
      params.set("quality", config.quality.toString());
      params.set("format", "webp"); // Usar WebP para mejor compresión
      params.set("fit", "contain"); // Mantener proporciones
      params.set("position", "center");
      params.set("enlarge", "0"); // No agrandar más allá del original
      params.set("progressive", "1"); // JPEG progresivo

      return `${url}?${params.toString()}`;
    }

    // Cloudinary
    if (urlObj.hostname.includes("cloudinary.com")) {
      const path = urlObj.pathname;
      const transformations = [];

      if (config.width) {
        transformations.push(`w_${config.width}`);
        transformations.push("c_limit"); // Limit to width, maintain aspect ratio
      }
      transformations.push(`q_${config.quality}`);
      transformations.push("f_auto"); // Auto format (WebP/AVIF support)

      const transformStr = transformations.join(",");
      const newPath = path.replace("/upload/", `/upload/${transformStr}/`);

      return `${urlObj.protocol}//${urlObj.hostname}${newPath}`;
    }

    // Imgix
    if (urlObj.hostname.includes("imgix.net")) {
      const params = new URLSearchParams();
      if (config.width) params.set("w", config.width.toString());
      params.set("q", config.quality.toString());
      params.set("auto", "format,compress");

      return `${url}?${params.toString()}`;
    }

    // DigitalOcean Spaces / S3 compatible
    if (
      urlObj.hostname.includes("digitaloceanspaces.com") ||
      urlObj.hostname.includes("amazonaws.com")
    ) {
      // Si usas un procesador de imágenes, agregar parámetros aquí
      // Por ahora retornar original
      return url;
    }

    // Cloudflare Images
    if (urlObj.hostname.includes("imagedelivery.net")) {
      // Cloudflare Images usa variantes en el path
      // /cdn-cgi/image/width=300,quality=75/url
      const variant = config.width
        ? `width=${config.width},quality=${config.quality},format=auto`
        : `quality=${config.quality},format=auto`;

      return url.replace(
        /\/cdn-cgi\/image\/[^/]+\//,
        `/cdn-cgi/image/${variant}/`
      );
    }

    // Default: retornar URL original
    return url;
  } catch (error) {
    // Si hay error parseando URL, retornar original
    console.warn("Error optimizando URL de imagen:", error);
    return url;
  }
};

/**
 * Genera URLs para diferentes tamaños (srcset) específico para KeyCDN
 */
export const generateSrcSet = (url: string | undefined): string => {
  if (!url) return "";

  const sizes: ImageSize[] = ["small", "medium", "large"];
  const srcset = sizes.map((size) => {
    const optimizedUrl = getOptimizedImageUrl(url, size);
    const width = IMAGE_CONFIG[size].width;
    return `${optimizedUrl} ${width}w`;
  });

  return srcset.join(", ");
};

/**
 * Genera URL optimizada específica para KeyCDN con parámetros personalizados
 */
export const getKeyCDNOptimizedUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "jpeg" | "png" | "webp";
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    position?: "top" | "right" | "bottom" | "left" | "center";
    enlarge?: 0 | 1;
    progressive?: 0 | 1;
  } = {}
): string => {
  if (!url) return "";

  const params = new URLSearchParams();

  if (options.width) params.set("width", options.width.toString());
  if (options.height) params.set("height", options.height.toString());
  if (options.quality) params.set("quality", options.quality.toString());
  if (options.format) params.set("format", options.format);
  if (options.fit) params.set("fit", options.fit);
  if (options.position) params.set("position", options.position);
  if (options.enlarge !== undefined)
    params.set("enlarge", options.enlarge.toString());
  if (options.progressive !== undefined)
    params.set("progressive", options.progressive.toString());

  return `${url}?${params.toString()}`;
};

/**
 * Hook para pre-cargar imágenes optimizadas
 * Usable para predictive prefetching (hover, scroll prediction, etc)
 */
export const preloadImage = (
  url: string,
  size: ImageSize = "small"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("No URL provided"));
      return;
    }

    const img = new Image();
    const optimizedUrl = getOptimizedImageUrl(url, size);

    img.onload = () => resolve();
    img.onerror = reject;
    img.src = optimizedUrl;

    // Force high priority for critical images
    if (size === "large" || size === "medium") {
      img.fetchPriority = "high";
    }
  });
};

/**
 * Prefetch de imagen con strategy inteligente
 * - Verifica si ya está en cache antes de descargar
 * - Usa requestIdleCallback para no interferir con interacciones
 * - Ideal para predictive prefetching en hover
 */
export const smartPrefetch = async (
  url: string,
  size: ImageSize = "large",
  immediate = false
): Promise<boolean> => {
  if (!url) return false;

  const optimizedUrl = getOptimizedImageUrl(url, size);

  // Check if already in cache (Service Worker cache)
  if ("caches" in window) {
    try {
      const cache = await caches.open("keycdn-optimized-images");
      const cached = await cache.match(optimizedUrl);
      if (cached) {
        return true; // Already cached, no need to prefetch
      }
    } catch (e) {
      // Cache API not available or error, continue with prefetch
    }
  }

  // Prefetch strategy
  const doPrefetch = () => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = optimizedUrl;
    document.head.appendChild(link);
  };

  if (immediate) {
    doPrefetch();
    return true;
  }

  // Use idle time to prefetch
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => doPrefetch(), { timeout: 2000 });
  } else {
    setTimeout(doPrefetch, 100);
  }

  return true;
};

/**
 * Batch preload con prioridad
 */
export const batchPreloadImages = async (
  urls: string[],
  size: ImageSize = "small",
  priority: number = 20
): Promise<void> => {
  // Precargar las primeras N con alta prioridad
  const priorityUrls = urls.slice(0, priority);
  const restUrls = urls.slice(priority, 50);

  // Cargar primeras en paralelo
  await Promise.allSettled(priorityUrls.map((url) => preloadImage(url, size)));

  // Cargar el resto en idle time
  if (restUrls.length > 0 && "requestIdleCallback" in window) {
    requestIdleCallback(() => {
      Promise.allSettled(restUrls.map((url) => preloadImage(url, size)));
    });
  }
};

/**
 * Get size suffix for R2 pre-generated images
 * Matches the migration script naming convention
 */
function getSizeSuffix(size: ImageSize): string {
  const suffixMap: Record<ImageSize, string> = {
    tiny: "-tiny",
    xs: "-xs",
    thumb: "-thumb",
    small: "-small",
    medium: "-medium",
    large: "-large",
    original: "",
  };

  return suffixMap[size];
}
