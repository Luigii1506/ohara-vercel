import React, { useEffect, useRef, useState } from "react";
import { getOptimizedImageUrl, ImageSize } from "@/lib/imageOptimization";

interface LazyImageProps {
  src?: string;
  fallbackSrc: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: ImageSize;
  customOptions?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "jpeg" | "png" | "webp";
    fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    position?: "top" | "right" | "bottom" | "left" | "center";
    enlarge?: 0 | 1;
    progressive?: 0 | 1;
  };
}

const MISSING_IMAGE_PATTERN = "example.com/missing";

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  priority = false,
  size = "medium",
  customOptions,
}) => {
  const isMissingSrc = !src || src.includes(MISSING_IMAGE_PATTERN);
  const [imageSrc, setImageSrc] = useState<string | null>(
    priority && src && !isMissingSrc
      ? buildOptimizedSrc(src, fallbackSrc, size, customOptions)
      : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!priority);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isInViewRef = useRef(isInView);
  const failedUrlsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!priority) return;

    if (!src || isMissingSrc) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    const optimized = buildOptimizedSrc(src, fallbackSrc, size, customOptions);

    // Don't try to load URLs that have already failed
    if (failedUrlsRef.current.has(optimized)) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    setImageSrc(optimized);
    setIsLoading(false);
  }, [customOptions, fallbackSrc, isMissingSrc, priority, size, src]);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting || entry.intersectionRatio > 0;
          const shouldPreload =
            entry.boundingClientRect.top < 0 &&
            Math.abs(entry.boundingClientRect.top) < 800;
          setIsInView(visible || shouldPreload);
        });
      },
      {
        rootMargin: "600px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    isInViewRef.current = isInView;
  }, [isInView]);

  // Cleanup: cancelar request pendiente al desmontar componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isInView) {
      // Cancelar request en vuelo si la imagen sale del viewport
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    // Imagen está en viewport - cargar si es necesario
    if (!src || isMissingSrc) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    const optimized = buildOptimizedSrc(src, fallbackSrc, size, customOptions);

    // Don't try to load URLs that have already failed
    if (failedUrlsRef.current.has(optimized)) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    // Actualizar la imagen si cambió la URL
    if (optimized !== imageSrc) {
      // Crear nuevo AbortController para este request
      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      setImageSrc(optimized);
    }
  }, [customOptions, fallbackSrc, imageSrc, isInView, isMissingSrc, size, src]);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    imageRef.current = event.currentTarget;
    setIsLoading(false);
    // Limpiar AbortController cuando imagen carga exitosamente
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  };

  const handleError = () => {
    if (imageSrc) {
      // Mark this URL as failed to prevent retry loops
      failedUrlsRef.current.add(imageSrc);
      console.warn(`Failed to load image: ${imageSrc}`);
    }
    imageRef.current = null;
    setImageSrc(null);
    setIsLoading(false);
    // Limpiar AbortController en caso de error
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative w-full overflow-hidden aspect-[3/4] rounded">
        <img
          src={fallbackSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          loading="lazy"
        />

        {isLoading && imageSrc && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
        )}

        {imageSrc && (
          <img
            ref={(node) => {
              imageRef.current = node;
            }}
            src={imageSrc}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onLoad={handleLoad}
            onError={handleError}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        )}
      </div>
    </div>
  );
};

export default LazyImage;
const buildOptimizedSrc = (
  originalSrc: string,
  fallback: string,
  size: ImageSize,
  options?: LazyImageProps["customOptions"]
) => {
  if (!originalSrc) return fallback;

  if (options) {
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

    return `${originalSrc}?${params.toString()}`;
  }

  return getOptimizedImageUrl(originalSrc, size);
};
