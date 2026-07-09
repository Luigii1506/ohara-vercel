"use client";

import React, { ChangeEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSimulatorStore } from "@/store/simulatorStore";
import { ZoneId } from "@/types/simulator";
import SimulatorCard from "./SimulatorCard";
import { cn } from "@/lib/utils";

export type ZoneVariant =
  | "characters"
  | "leader"
  | "slot"
  | "pile"
  | "don"
  | "hand"
  | "notes";

interface SimulatorZoneProps {
  zoneId: ZoneId;
  variant: ZoneVariant;
}

// Ancho/contenedor por variante. Mantiene el tablero compacto.
const containerByVariant: Record<ZoneVariant, string> = {
  characters: "flex-1 min-w-0",
  don: "flex-[1.3] min-w-0",
  leader: "w-[84px] shrink-0",
  slot: "w-[76px] shrink-0",
  pile: "w-[62px] shrink-0",
  hand: "w-full",
  notes: "w-[120px] shrink-0",
};

const minHeightByVariant: Record<ZoneVariant, string> = {
  characters: "min-h-[118px]",
  don: "min-h-[118px]",
  leader: "min-h-[118px]",
  slot: "min-h-[118px]",
  pile: "min-h-[118px]",
  hand: "min-h-[120px]",
  notes: "min-h-[118px]",
};

const SimulatorZone: React.FC<SimulatorZoneProps> = ({ zoneId, variant }) => {
  const zone = useSimulatorStore((state) => state.zones[zoneId]);
  const updateZoneNote = useSimulatorStore((state) => state.updateZoneNote);
  const { isOver, setNodeRef } = useDroppable({ id: zoneId });

  if (!zone) return null;

  const uids = zone.cardUids;
  const count = uids.length;
  const noteValue = (zone.metadata as { note?: string })?.note ?? "";

  const handleNoteChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    updateZoneNote(zoneId, e.target.value);

  const renderInner = () => {
    if (variant === "notes") {
      return (
        <textarea
          value={noteValue}
          onChange={handleNoteChange}
          placeholder="Notas…"
          className="h-[92px] w-full resize-none rounded-md border border-white/10 bg-black/30 p-1.5 text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
      );
    }

    if (count === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-center text-[10px] font-medium uppercase tracking-wide text-white/25">
          {zone.label}
        </div>
      );
    }

    // Pilas y slots de 1: solo se ve la carta de arriba + contador.
    if (variant === "pile" || variant === "leader" || variant === "slot") {
      const topUid = uids[uids.length - 1];
      return (
        <div className="relative flex flex-1 items-center justify-center">
          <SimulatorCard cardUid={topUid} />
          {count > 1 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1.5 text-[10px] font-bold text-white ring-1 ring-white/20">
              {count}
            </span>
          )}
        </div>
      );
    }

    if (variant === "characters") {
      return (
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {uids.map((uid) => (
            <SimulatorCard key={uid} cardUid={uid} />
          ))}
        </div>
      );
    }

    if (variant === "don") {
      return (
        <div className="flex flex-1 flex-wrap content-start gap-1">
          {uids.map((uid) => (
            <div key={uid} className="w-[40px]">
              <SimulatorCard cardUid={uid} />
            </div>
          ))}
        </div>
      );
    }

    // hand
    return (
      <div className="flex flex-1 items-end gap-1.5 overflow-x-auto pb-1">
        {uids.map((uid) => (
          <div key={uid} className="w-[68px] shrink-0">
            <SimulatorCard cardUid={uid} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col rounded-lg border bg-white/[0.03] p-1.5 transition-colors",
        containerByVariant[variant],
        minHeightByVariant[variant],
        isOver
          ? "border-emerald-400/60 bg-emerald-400/10"
          : "border-white/10"
      )}
    >
      {/* Etiqueta + contador (discreto) */}
      {variant !== "notes" && (
        <div className="mb-1 flex items-center justify-between px-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/35">
          <span className="truncate">{zone.label}</span>
          {count > 0 && (
            <span className="text-white/60">
              {count}
              {zone.capacity ? `/${zone.capacity}` : ""}
            </span>
          )}
        </div>
      )}
      {renderInner()}
    </div>
  );
};

export default SimulatorZone;
