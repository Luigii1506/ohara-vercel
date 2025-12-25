"use client";

import React, { useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { shallow } from "zustand/shallow";
import { useSimulatorStore } from "@/store/simulatorStore";
import { Side, ZoneId } from "@/types/simulator";
import SimulatorZone from "./SimulatorZone";
import { cn } from "@/lib/utils";

const SIDE_ZONE_LAYOUT: Record<Side, ZoneId[][]> = {
  opponent: [
    ["opponent-life"],
    ["opponent-hand"],
    ["opponent-back-row"],
    ["opponent-front-row"],
    ["opponent-leader", "opponent-stage", "opponent-don"],
    ["opponent-deck", "opponent-trash", "opponent-notes"],
  ],
  player: [
    ["player-life"],
    ["player-hand"],
    ["player-back-row"],
    ["player-front-row"],
    ["player-leader", "player-stage", "player-don"],
    ["player-deck", "player-trash", "player-notes"],
  ],
};

const boardBackgrounds: Record<Side, string> = {
  player: "from-emerald-950/60 to-slate-900/40",
  opponent: "from-rose-950/60 to-slate-900/40",
};

const SimulatorBoard: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const { activePerspective, moveCard, turnOwner, life, donAvailable } =
    useSimulatorStore(
      (state) => ({
        activePerspective: state.activePerspective,
        moveCard: state.moveCard,
        turnOwner: state.turnOwner,
        life: state.life,
        donAvailable: state.donAvailable,
      }),
      shallow
    );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !active?.id) return;
    if (active.data?.current?.type !== "card") return;
    moveCard(active.id as string, over.id as ZoneId);
  };

  const [topSide, bottomSide] = useMemo<Side[]>(() => {
    if (activePerspective === "player") {
      return ["opponent", "player"];
    }
    return ["player", "opponent"];
  }, [activePerspective]);

  const renderRow = (zoneIds: ZoneId[]) => (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${zoneIds.length}, minmax(0, 1fr))`,
      }}
    >
      {zoneIds.map((zoneId) => (
        <SimulatorZone key={zoneId} zoneId={zoneId} />
      ))}
    </div>
  );

  const renderSide = (side: Side) => (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-gradient-to-b p-4",
        boardBackgrounds[side]
      )}
    >
      <div className="mb-4 flex items-center justify-between text-xs uppercase text-white/60">
        <div>
          <p className="text-lg font-semibold text-white">
            {side === "player" ? "Tu campo" : "Campo rival"}
          </p>
          <p>Life {life[side]} · DON {donAvailable[side]}</p>
        </div>
        {turnOwner === side && (
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
            Turno activo
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {SIDE_ZONE_LAYOUT[side].map((row, index) => (
          <React.Fragment key={`${side}-${row.join("-")}-${index}`}>
            {renderRow(row)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      sensors={sensors}
      collisionDetection={closestCenter}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-4 text-center text-sm text-white/70">
          Perspectiva actual:{" "}
          <span className="font-semibold text-white">
            {activePerspective === "player" ? "Tu lado" : "Lado del oponente"}
          </span>
        </div>

        {renderSide(topSide)}

        <div className="flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-black/40 p-4 text-center text-sm text-white/60">
          <div>
            <p className="text-xs uppercase tracking-wide">Control de turno</p>
            <p className="text-lg font-semibold text-white">
              {turnOwner === "player" ? "Tu turno" : "Turno del oponente"}
            </p>
          </div>
        </div>

        {renderSide(bottomSide)}
      </div>
    </DndContext>
  );
};

export default SimulatorBoard;

