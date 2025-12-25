"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useSimulatorStore, SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";
import LazyImage from "@/components/LazyImage";
import { cn } from "@/lib/utils";
import { shallow } from "zustand/shallow";

interface SimulatorCardProps {
  cardUid: string;
}

const ownerBadge: Record<string, string> = {
  player: "bg-emerald-600",
  opponent: "bg-rose-600",
};

const SimulatorCard: React.FC<SimulatorCardProps> = ({ cardUid }) => {
  const instance = useSimulatorStore((state) => state.cards[cardUid]);
  const { toggleRest, updateCounters, removeCard, cloneCard } = useSimulatorStore(
    (state) => ({
      toggleRest: state.toggleRest,
      updateCounters: state.updateCounters,
      removeCard: state.removeCard,
      cloneCard: state.cloneCard,
    }),
    shallow
  );

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cardUid,
    data: { type: "card", cardUid },
  });

  if (!instance) return null;

  const cardName =
    instance.card?.name || instance.customLabel || `Instancia ${cardUid.slice(-4)}`;
  const cardCode = instance.card?.code;
  const imageSrc = instance.card?.src;
  const counters = instance.counters;

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };

  const handleAction =
    (action: () => void) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action();
    };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-xl border border-white/10 bg-black/30 p-2 shadow-lg transition-all duration-150 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-70",
        instance.rested && "ring-2 ring-yellow-400"
      )}
    >
      <div className="relative">
        <LazyImage
          src={imageSrc}
          fallbackSrc={SIMULATOR_CARD_FALLBACK}
          alt={cardName}
          className={cn("w-full", instance.rested ? "rotate-2" : "")}
          objectFit="cover"
        />
        <div
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white",
            ownerBadge[instance.owner] || "bg-slate-600"
          )}
        >
          {instance.owner === "player" ? "Tú" : "Oponente"}
        </div>
        {instance.rested && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold uppercase text-white tracking-widest">
            Rested
          </div>
        )}
        {counters > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white">
            +{counters}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-2">
        <div>
          <p className="text-sm font-semibold text-white">{cardName}</p>
          {cardCode && <p className="text-xs text-white/60">{cardCode}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="flex flex-1 items-center justify-center rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
            onClick={handleAction(() => toggleRest(cardUid))}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Rest
          </button>
          <button
            className="flex flex-1 items-center justify-center rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
            onClick={handleAction(() => cloneCard(cardUid))}
          >
            <Copy className="mr-1 h-4 w-4" />
            Clone
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-xs text-white">
          <span>Counters</span>
          <div className="flex items-center gap-1">
            <button
              className="rounded-full bg-black/30 p-1"
              onClick={handleAction(() => updateCounters(cardUid, -1))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{counters}</span>
            <button
              className="rounded-full bg-black/30 p-1"
              onClick={handleAction(() => updateCounters(cardUid, 1))}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/30"
          onClick={handleAction(() => removeCard(cardUid))}
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </button>
      </div>
    </div>
  );
};

export default SimulatorCard;
