// Detección de las FASES de cada turno para presentar el replay de forma
// entendible: Inicio → Robo → DON → Principal. El log no las marca explícito,
// pero las inferimos de los eventos (draw card, draw don, primera jugada).

import { ParsedReplay } from "@/types/replay";
import { Side } from "@/types/simulator";
import { SideMap } from "@/lib/replay/reduce";

export type PhaseId = "start" | "draw" | "don" | "main";

export interface PhaseInfo {
  turn: number;
  player: string;
  side: Side | null;
  phase: PhaseId;
  label: string;
  icon: string;
}

const PHASE_META: Record<PhaseId, { label: string; icon: string }> = {
  start: { label: "Inicio del turno", icon: "🔄" },
  draw: { label: "Fase de robo", icon: "🃏" },
  don: { label: "Fase de DON!!", icon: "💎" },
  main: { label: "Fase principal", icon: "⚔️" },
};

const shortName = (p: string) => p.split("#")[0];

/** Fase del turno en un índice dado. */
export function getPhase(
  parsed: ParsedReplay,
  index: number,
  sideMap: SideMap
): PhaseInfo | null {
  const turn =
    parsed.turns.find((t) => index >= t.startEvent && index <= t.endEvent) ??
    parsed.turns[parsed.turns.length - 1];
  if (!turn) return null;

  // Marcadores dentro del turno.
  let drawIdx = -1;
  let donIdx = -1;
  let mainIdx = -1;
  for (let i = turn.startEvent; i <= turn.endEvent; i += 1) {
    const e = parsed.events[i];
    if (drawIdx === -1 && e.kind === "draw" && e.drawType !== "don") drawIdx = i;
    else if (donIdx === -1 && e.kind === "draw" && e.drawType === "don") donIdx = i;
    else if (
      mainIdx === -1 &&
      (e.kind === "deploy" ||
        e.kind === "attackDeclare" ||
        e.kind === "attachDon" ||
        e.kind === "ability")
    ) {
      mainIdx = i;
    }
  }

  const markers: { at: number; phase: PhaseId }[] = [
    { at: turn.startEvent, phase: "start" },
  ];
  if (drawIdx >= 0) markers.push({ at: drawIdx, phase: "draw" });
  if (donIdx >= 0) markers.push({ at: donIdx, phase: "don" });
  if (mainIdx >= 0) markers.push({ at: mainIdx, phase: "main" });
  markers.sort((a, b) => a.at - b.at);

  let phase: PhaseId = "start";
  for (const m of markers) if (index >= m.at) phase = m.phase;

  return {
    turn: turn.index,
    player: shortName(turn.player),
    side: sideMap[turn.player] ?? null,
    phase,
    label: PHASE_META[phase].label,
    icon: PHASE_META[phase].icon,
  };
}
