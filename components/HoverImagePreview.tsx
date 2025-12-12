"use client";

import { useState, useCallback } from "react";

export interface HoverPreviewState {
  src: string;
  alt: string;
}

export const useHoverImagePreview = () => {
  const [preview, setPreview] = useState<HoverPreviewState | null>(null);

  const showPreview = useCallback((src?: string | null, alt?: string) => {
    if (!src) return;
    setPreview({ src, alt: alt || "" });
  }, []);

  const hidePreview = useCallback(() => {
    setPreview(null);
  }, []);

  return { preview, showPreview, hidePreview };
};

interface HoverImagePreviewProps {
  preview: HoverPreviewState | null;
  className?: string;
}

export const HoverImagePreviewOverlay = ({
  preview,
  className = "",
}: HoverImagePreviewProps) => {
  if (!preview) return null;
  return (
    <div
      className={`pointer-events-none fixed bottom-6 right-6 z-50 hidden xl:block ${className}`}
    >
      <div className="rounded-xl border bg-background/95 p-3 shadow-2xl">
        <img
          src={preview.src}
          alt={preview.alt}
          className="max-h-[480px] w-auto rounded object-contain"
        />
        {preview.alt && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {preview.alt}
          </p>
        )}
      </div>
    </div>
  );
};
