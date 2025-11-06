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

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  priority = false,
  size = "medium",
  customOptions,
}) => {
  const isMissingSrc = !src || src.includes("example.com/missing");
  const [imageSrc, setImageSrc] = useState<string | null>(
    priority && src && !isMissingSrc
      ? getOptimizedSrc(src, size, customOptions)
      : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    priority ? false : true
  );
  const [isInView, setIsInView] = useState(priority);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  function getOptimizedSrc(
    originalSrc: string,
    requestedSize: ImageSize,
    options?: LazyImageProps["customOptions"]
  ) {
    if (!originalSrc) return fallbackSrc;

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

    return getOptimizedImageUrl(originalSrc, requestedSize);
  }

  useEffect(() => {
    if (!priority) return;

    if (!src || isMissingSrc) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    setImageSrc(getOptimizedSrc(src, size, customOptions));
    setIsLoading(false);
  }, [customOptions, fallbackSrc, isMissingSrc, priority, size, src]);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const node = wrapperRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting || entry.intersectionRatio > 0;
          setIsInView(visible);
        });
      },
      {
        rootMargin: "200px",
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  useEffect(() => {
    if (!isInView) {
      if (imageRef.current) {
        imageRef.current.src = "";
        imageRef.current = null;
      }
      if (src && imageSrc) {
        setImageSrc(null);
        setIsLoading(true);
      }
      return;
    }

    if (!src || isMissingSrc) {
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      return;
    }

    const optimized = getOptimizedSrc(src, size, customOptions);
    if (optimized !== imageSrc) {
      setIsLoading(true);
      setImageSrc(optimized);
    }
  }, [
    customOptions,
    fallbackSrc,
    imageSrc,
    isInView,
    size,
    src,
  ]);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    imageRef.current = event.currentTarget;
    setIsLoading(false);
  };

  const handleError = () => {
    imageRef.current = null;
    if (src && imageSrc !== src) {
      setImageSrc(src);
    } else {
      setImageSrc(fallbackSrc);
    }
    setIsLoading(false);
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <div className="relative w-full overflow-hidden aspect-[3/4] rounded">
        <img
          src={fallbackSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          loading="lazy"
        />

        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
        )}

        {imageSrc && imageSrc !== fallbackSrc && (
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
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        )}
      </div>
    </div>
  );
};

export default LazyImage;
