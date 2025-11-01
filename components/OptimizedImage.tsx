import React, { useState, useRef, useEffect, useMemo } from "react";
import { useImagePreload, useIsImageCached } from "@/hooks/useImagePreload";
import { getOptimizedImageUrl, ImageSize } from "@/lib/imageOptimization";

interface OptimizedImageProps {
  src?: string;
  fallbackSrc: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: ImageSize;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  priority = false,
  size = 'small',
}) => {
  const optimizedSrc = useMemo(() =>
    getOptimizedImageUrl(src, size),
    [src, size]
  );

  const [isVisible, setIsVisible] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const isCached = useIsImageCached(optimizedSrc);

  // ⚡ Precargar con React Query
  const { data: preloadedSrc } = useImagePreload(
    optimizedSrc,
    isVisible || isCached || priority
  );

  // ⚡ IntersectionObserver optimizado
  useEffect(() => {
    if (priority || !imgRef.current) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px", threshold: 0.01 }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // ⚡ Mostrar imagen optimizada o fallback
  const imageSrc = preloadedSrc || optimizedSrc || fallbackSrc;

  return (
    <div className={`relative w-full ${className}`}>
      {/* ⚡ Skeleton - solo si NO está cargada */}
      {!isLoaded && (
        <div
          className="w-full rounded-lg overflow-hidden relative bg-gradient-to-br from-slate-100 to-slate-50"
          style={{ paddingBottom: '140%' }}
        >
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"
          />
        </div>
      )}

      {/* ⚡ Imagen - siempre renderizada, controlada por opacity */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
        className={`w-full transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0 absolute'
        }`}
      />

      <style jsx>{`
        @keyframes shimmer {
          to { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default OptimizedImage;