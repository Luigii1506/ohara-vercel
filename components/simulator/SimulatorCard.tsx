"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useSimulatorStore, SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";
import { useShallow } from "zustand/react/shallow";
import LazyImage from "@/components/LazyImage";
import { cn } from "@/lib/utils";

interface SimulatorCardProps {
  cardUid: string;
}

const SimulatorCard: React.FC<SimulatorCardProps> = ({ cardUid }) => {
  const instance = useSimulatorStore((state) => state.cards[cardUid]);
  const { toggleRest, updateCounters, removeCard, cloneCard } = useSimulatorStore(
    useShallow((state) => ({
      toggleRest: state.toggleRest,
      updateCounters: state.updateCounters,
      removeCard: state.removeCard,
      cloneCard: state.cloneCard,
    }))
  );

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: cardUid, data: { type: "card", cardUid } });

  if (!instance) return null;

  const cardName =
    instance.card?.name || instance.customLabel || `Carta ${cardUid.slice(-4)}`;
  const imageSrc = instance.card?.src;
  const counters = instance.counters;

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };

  const stop =
    (action: () => void) => (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      action();
    };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group/card relative w-full select-none",
        isDragging && "opacity-60 z-50"
      )}
      title={cardName}
    >
      {/* Imagen (handle de arrastre) */}
      <div
        {...listeners}
        className={cn(
          "relative overflow-hidden rounded-md ring-1 transition-transform duration-150 cursor-grab active:cursor-grabbing",
          instance.owner === "player" ? "ring-emerald-400/40" : "ring-rose-400/40",
          instance.rested && "rotate-[8deg] brightness-90 ring-amber-400/80"
        )}
      >
        <div className="aspect-[5/7] w-full bg-black/40">
          <LazyImage
            src={imageSrc}
            fallbackSrc={SIMULATOR_CARD_FALLBACK}
            alt={cardName}
            className="h-full w-full object-cover"
            objectFit="cover"
          />
        </div>

        {counters > 0 && (
          <span className="absolute bottom-1 right-1 rounded-full bg-amber-500/90 px-1.5 text-[10px] font-bold text-black">
            +{counters}
          </span>
        )}
        {instance.rested && (
          <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 text-[9px] font-bold uppercase text-black">
            rest
          </span>
        )}
      </div>

      {/* Acciones en hover (no estorban; el board queda limpio) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b-md bg-gradient-to-t from-black/90 to-transparent p-1 opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100">
        <button
          className="rounded bg-white/15 p-1 text-white hover:bg-white/30"
          title="Descansar / activar"
          onClick={stop(() => toggleRest(cardUid))}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          className="rounded bg-white/15 p-1 text-white hover:bg-white/30"
          title="Quitar contador"
          onClick={stop(() => updateCounters(cardUid, -1))}
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          className="rounded bg-white/15 p-1 text-white hover:bg-white/30"
          title="Agregar contador"
          onClick={stop(() => updateCounters(cardUid, 1))}
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          className="rounded bg-white/15 p-1 text-white hover:bg-white/30"
          title="Duplicar"
          onClick={stop(() => cloneCard(cardUid))}
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          className="rounded bg-red-500/30 p-1 text-red-100 hover:bg-red-500/50"
          title="Eliminar"
          onClick={stop(() => removeCard(cardUid))}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default SimulatorCard;
