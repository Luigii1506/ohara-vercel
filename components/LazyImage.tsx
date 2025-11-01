import React, { useState, useEffect, useRef } from "react";
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
  enableBlurPlaceholder?: boolean; // Progressive loading: blur → full image
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  priority = false,
  size = "medium",
  customOptions,
  enableBlurPlaceholder = true,
}) => {
  const [blurSrc, setBlurSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(
    priority ? src || fallbackSrc : null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(priority);
  const [showBlur, setShowBlur] = useState(enableBlurPlaceholder);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generar URL optimizada para KeyCDN
  const getOptimizedSrc = (originalSrc: string): string => {
    if (!originalSrc) return fallbackSrc;

    if (customOptions) {
      // Usar parámetros personalizados para KeyCDN
      const params = new URLSearchParams();
      if (customOptions.width)
        params.set("width", customOptions.width.toString());
      if (customOptions.height)
        params.set("height", customOptions.height.toString());
      if (customOptions.quality)
        params.set("quality", customOptions.quality.toString());
      if (customOptions.format) params.set("format", customOptions.format);
      if (customOptions.fit) params.set("fit", customOptions.fit);
      if (customOptions.position)
        params.set("position", customOptions.position);
      if (customOptions.enlarge !== undefined)
        params.set("enlarge", customOptions.enlarge.toString());
      if (customOptions.progressive !== undefined)
        params.set("progressive", customOptions.progressive.toString());

      return `${originalSrc}?${params.toString()}`;
    } else {
      // Usar tamaño predefinido
      return getOptimizedImageUrl(originalSrc, size);
    }
  };

  // IntersectionObserver para lazy loading
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    if (!imgRef.current) return;

    const currentRef = imgRef.current;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        rootMargin: "400px", // Reduced from 800px for better performance
        threshold: 0.01,
      }
    );

    const timeoutId = setTimeout(() => {
      if (currentRef && observerRef.current) {
        observerRef.current.observe(currentRef);
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority]);

  // Cargar blur placeholder primero (LQIP - Low Quality Image Placeholder)
  useEffect(() => {
    if (!enableBlurPlaceholder || !src) return;

    // Load tiny blur image immediately for priority images
    if (priority) {
      const tinyUrl = getOptimizedImageUrl(src, "tiny");
      setBlurSrc(tinyUrl);
    }
  }, [src, priority, enableBlurPlaceholder]);

  // Cargar imagen optimizada cuando esté en viewport
  useEffect(() => {
    if (!isInView) return;

    if (src) {
      // Load blur placeholder if not already loaded
      if (enableBlurPlaceholder && !blurSrc) {
        const tinyUrl = getOptimizedImageUrl(src, "tiny");
        setBlurSrc(tinyUrl);
      }

      // Load full quality image
      const optimizedSrc = getOptimizedSrc(src);
      setImageSrc(optimizedSrc);
    } else {
      setImageSrc(fallbackSrc);
    }
  }, [isInView, src, fallbackSrc, size, customOptions, enableBlurPlaceholder, blurSrc]);

  const handleLoad = () => {
    setIsLoading(false);
    setShowBlur(false); // Hide blur when full image loads
  };

  const handleError = () => {
    // Fallback a imagen original si la optimizada falla
    if (src && imageSrc !== src) {
      setImageSrc(src);
    } else {
      setImageSrc(fallbackSrc);
    }
    setIsLoading(false);
    setShowBlur(false);
  };

  return (
    <div ref={imgRef} className={`relative w-full ${className}`}>
      {/* LQIP Blur Placeholder - loads instantly (~1KB) */}
      {showBlur && blurSrc && (
        <img
          src={blurSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-105"
          loading="eager"
          aria-hidden="true"
        />
      )}

      {/* Skeleton mientras carga (fallback si no hay blur) */}
      {isLoading && !blurSrc && imageSrc && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse rounded" />
      )}

      {/* Imagen real de alta calidad */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={handleLoad}
          onError={handleError}
          className={`relative w-full transition-opacity duration-500 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Placeholder si aún no se carga */}
      {!imageSrc && (
        <div className="w-full aspect-[2/3] bg-gray-200 rounded flex items-center justify-center">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default LazyImage;
