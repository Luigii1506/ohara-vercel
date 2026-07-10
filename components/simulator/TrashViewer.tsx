"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CardInstance } from "@/types/simulator";
import { SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";
import { cn } from "@/lib/utils";

interface Props {
  cards: CardInstance[];
  side: "player" | "opponent";
  onClose: () => void;
}

// Visor del Trash: carrusel horizontal (izquierda → derecha) para inspeccionar
// las cartas del cementerio. Abre/cierra con la misma animación del mulligan.
const TrashViewer: React.FC<Props> = ({ cards, side, onClose }) => {
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Más recientes primero.
  const ordered = [...cards].reverse();

  return (
    <div
      className={cn(
        "absolute inset-0 z-[45] flex flex-col rounded-xl bg-slate-950/90 backdrop-blur-sm transition-opacity duration-300",
        closing ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      onClick={close}
    >
      <style>{`
        @keyframes mulliDealIn {
          0%   { opacity: 0; transform: translate(45%, -70%) scale(.55) rotate(14deg); }
          100% { opacity: 1; transform: none; }
        }
      `}</style>

      <div
        className="flex shrink-0 items-center justify-between px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <span>🗑️ Trash</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
              side === "player" ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
            )}
          >
            {side === "player" ? "Tú" : "Oponente"}
          </span>
          <span className="text-white/40">
            · {cards.length} carta{cards.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={close}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
        >
          <X className="h-3.5 w-3.5" /> Cerrar (Esc)
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {ordered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            El cementerio está vacío.
          </div>
        ) : (
          <div className="flex h-full flex-wrap content-center items-center justify-center gap-3">
            {ordered.map((c, i) => {
              const src = (c.card as { src?: string } | undefined)?.src;
              const name = (c.card as { name?: string } | undefined)?.name;
              return (
                <div
                  key={c.uid}
                  className="relative w-[8vw] max-w-[92px] shrink-0 overflow-hidden rounded-md shadow-lg ring-1 ring-black/50 transition-transform duration-200 hover:z-10 hover:scale-[2.2]"
                  style={{
                    aspectRatio: "5 / 7",
                    animation: "mulliDealIn .5s cubic-bezier(.2,.8,.2,1) both",
                    animationDelay: `${Math.min(i, 25) * 60}ms`,
                  }}
                  title={name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src || SIMULATOR_CARD_FALLBACK}
                    alt={name ?? ""}
                    className="h-full w-full object-cover object-top"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = SIMULATOR_CARD_FALLBACK;
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashViewer;
