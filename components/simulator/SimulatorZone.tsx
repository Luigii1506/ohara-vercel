"use client";

import React, { ChangeEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import { shallow } from "zustand/shallow";
import { useSimulatorStore } from "@/store/simulatorStore";
import { ZoneId } from "@/types/simulator";
import SimulatorCard from "./SimulatorCard";
import { cn } from "@/lib/utils";

interface SimulatorZoneProps {
  zoneId: ZoneId;
}

const layoutClass: Record<string, string> = {
  grid: "grid gap-2",
  list: "flex gap-2 overflow-x-auto",
  stack: "flex flex-wrap gap-2",
};

const SimulatorZone: React.FC<SimulatorZoneProps> = ({ zoneId }) => {
  const zone = useSimulatorStore((state) => state.zones[zoneId]);
  const updateZoneNote = useSimulatorStore((state) => state.updateZoneNote, shallow);
  const { isOver, setNodeRef } = useDroppable({
    id: zoneId,
  });

  if (!zone) return null;

  const cardCount = zone.cardUids.length;
  const noteValue = (zone.metadata as { note?: string })?.note ?? "";

  const handleNoteChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateZoneNote(zoneId, event.target.value);
  };

  const renderContent = () => {
    if (zone.layout === "notes") {
      return (
        <textarea
          value={noteValue}
          onChange={handleNoteChange}
          placeholder="Notas rápidas..."
          className="h-24 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
        />
      );
    }

    if (cardCount === 0) {
      return (
        <div className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-white/40">
          Arrastra cartas aquí
        </div>
      );
    }

    const layout = zone.layout ?? "stack";
    const gridStyle =
      layout === "grid"
        ? {
            gridTemplateColumns: `repeat(${zone.capacity ?? 5}, minmax(0, 1fr))`,
          }
        : undefined;

    return (
      <div
        className={cn(
          layoutClass[layout] ?? layoutClass.stack,
          layout === "list" && "pb-2"
        )}
        style={gridStyle}
      >
        {zone.cardUids.map((uid) => (
          <SimulatorCard key={uid} cardUid={uid} />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-3 transition-all duration-150",
        isOver && "border-white/30 bg-white/10 shadow-lg"
      )}
    >
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
        <span>
          {zone.label} · {zone.owner === "player" ? "Tú" : "Oponente"}
        </span>
        {zone.layout !== "notes" && (
          <span className="font-semibold text-white">
            {cardCount}
            {zone.capacity ? ` / ${zone.capacity}` : ""}
          </span>
        )}
      </div>
      {renderContent()}
    </div>
  );
};

export default SimulatorZone;

