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
import { useShallow } from "zustand/react/shallow";
import { Heart, Coins } from "lucide-react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { Side, ZoneId } from "@/types/simulator";
import SimulatorZone from "./SimulatorZone";
import { cn } from "@/lib/utils";

const sideTheme: Record<Side, { ring: string; glow: string; label: string }> = {
  player: {
    ring: "ring-emerald-400/40",
    glow: "shadow-[0_0_30px_-12px_rgba(16,185,129,0.6)]",
    label: "Tu campo",
  },
  opponent: {
    ring: "ring-rose-400/40",
    glow: "shadow-[0_0_30px_-12px_rgba(244,63,94,0.6)]",
    label: "Campo rival",
  },
};

const SimulatorBoard: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const { activePerspective, moveCard, turnOwner, turn, life, donAvailable } =
    useSimulatorStore(
      useShallow((state) => ({
        activePerspective: state.activePerspective,
        moveCard: state.moveCard,
        turnOwner: state.turnOwner,
        turn: state.turn,
        life: state.life,
        donAvailable: state.donAvailable,
      }))
    );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !active?.id) return;
    if (active.data?.current?.type !== "card") return;
    moveCard(active.id as string, over.id as ZoneId);
  };

  const [topSide, bottomSide] = useMemo<Side[]>(
    () =>
      activePerspective === "player"
        ? ["opponent", "player"]
        : ["player", "opponent"],
    [activePerspective]
  );

  const z = (side: Side, suffix: string) => `${side}-${suffix}` as ZoneId;

  // Fila de "campo" (la línea trasera del jugador): vida, líder, stage,
  // área de costo (DON), deck, cementerio y notas.
  const renderField = (side: Side) => (
    <div className="flex items-stretch gap-2">
      <SimulatorZone zoneId={z(side, "life")} variant="pile" />
      <SimulatorZone zoneId={z(side, "leader")} variant="leader" />
      <SimulatorZone zoneId={z(side, "stage")} variant="slot" />
      <SimulatorZone zoneId={z(side, "don")} variant="don" />
      <SimulatorZone zoneId={z(side, "deck")} variant="pile" />
      <SimulatorZone zoneId={z(side, "trash")} variant="pile" />
      <SimulatorZone zoneId={z(side, "notes")} variant="notes" />
    </div>
  );

  const renderSide = (side: Side, isTop: boolean) => {
    const theme = sideTheme[side];
    const isActive = turnOwner === side;
    const characters = (
      <SimulatorZone zoneId={z(side, "front-row")} variant="characters" />
    );
    const field = renderField(side);
    const hand = <SimulatorZone zoneId={z(side, "hand")} variant="hand" />;

    return (
      <section
        className={cn(
          "rounded-2xl border border-white/10 bg-slate-900/40 p-3 ring-1 ring-inset transition-shadow",
          isActive ? cn(theme.ring, theme.glow) : "ring-white/5"
        )}
      >
        <header className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                side === "player" ? "bg-emerald-400" : "bg-rose-400"
              )}
            />
            <span className="text-sm font-semibold text-white">
              {theme.label}
            </span>
            {isActive && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Turno activo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-rose-300">
              <Heart className="h-4 w-4" /> {life[side]}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <Coins className="h-4 w-4" /> {donAvailable[side]}
            </span>
          </div>
        </header>

        {/* Orden espejado: el rival (arriba) muestra personajes abajo (al centro);
            tú (abajo) muestras personajes arriba (al centro). */}
        <div className="flex flex-col gap-2">
          {isTop ? (
            <>
              {hand}
              {field}
              {characters}
            </>
          ) : (
            <>
              {characters}
              {field}
              {hand}
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      sensors={sensors}
      collisionDetection={closestCenter}
    >
      <div id="simulator-board" className="flex flex-col gap-2 rounded-2xl bg-slate-950/30 p-2">
        {renderSide(topSide, true)}

        <div className="flex items-center justify-center gap-3 py-0.5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
            Turno {turn} · {turnOwner === "player" ? "Tú" : "Oponente"}
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        {renderSide(bottomSide, false)}
      </div>
    </DndContext>
  );
};

export default SimulatorBoard;
