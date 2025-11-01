"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
}

export function ShareButton({
  title,
  text,
  url,
  className = "",
}: ShareButtonProps) {
  const [isSupported, setIsSupported] = useState(true);

  const handleShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      setIsSupported(false);
      // Fallback: copiar al portapapeles
      try {
        await navigator.clipboard.writeText(
          `${title}\n${text}\n${url || window.location.href}`
        );
        alert("Enlace copiado al portapapeles!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
      return;
    }

    try {
      await navigator.share({
        title,
        text,
        url: url || window.location.href,
      });

      // Track analytics
      if ((window as any).gtag) {
        (window as any).gtag("event", "content_shared", {
          content_type: "card",
          item_id: url,
        });
      }
    } catch (error) {
      // Usuario canceló el share
      console.log("Share cancelled");
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 ${className}`}
      title={isSupported ? "Compartir" : "Copiar enlace"}
    >
      <Share2 size={20} />
      {isSupported ? "Compartir" : "Copiar enlace"}
    </button>
  );
}
