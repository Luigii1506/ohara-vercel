// Extrae el "combate activo" en un índice dado para mostrar un panel claro:
// quién ataca a quién, con cuánto poder, los counters que se van sumando, y el
// resultado. Se construye paso a paso a medida que avanza el replay.

import { ParsedReplay, ReplayEvent } from "@/types/replay";
import { Side } from "@/types/simulator";
import { SideMap } from "@/lib/replay/reduce";

export interface CombatInfo {
  attacker: { name: string; code: string; side: Side | null; power?: number };
  defender: { name: string; code: string; side: Side | null; power?: number };
  counters: { name: string; value: number }[];
  counterTotal: number;
  result?: "fail" | "hit" | "destroyed";
  damage?: number;
}

const other = (s: Side | null): Side | null =>
  s === "player" ? "opponent" : s === "opponent" ? "player" : null;

export function getActiveCombat(
  replay: ParsedReplay,
  index: number,
  sideMap: SideMap
): CombatInfo | null {
  const ev = replay.events;
  const upto = Math.min(index, ev.length - 1);

  // Última declaración de ataque <= index (sin cruzar un fin de turno).
  let a = -1;
  for (let i = upto; i >= 0; i -= 1) {
    if (ev[i].kind === "attackDeclare") {
      a = i;
      break;
    }
    if (ev[i].kind === "endTurn") return null;
  }
  if (a < 0) return null;

  const decl = ev[a] as Extract<ReplayEvent, { kind: "attackDeclare" }>;

  // Fin de la ventana del combate: su resolución (falla/daño/destruido) o el
  // siguiente ataque / fin de turno.
  let windowEnd = ev.length - 1;
  for (let i = a + 1; i < ev.length; i += 1) {
    const e = ev[i];
    if (e.kind === "attackDeclare" || e.kind === "endTurn") {
      windowEnd = i - 1;
      break;
    }
    if (e.kind === "attackFail" || e.kind === "damage") {
      windowEnd = i;
      break;
    }
    if (e.kind === "destroy" && e.card.code === decl.defender.code) {
      windowEnd = i;
      break;
    }
  }
  if (index > windowEnd) return null; // el combate ya terminó

  // Reunir la info conocida hasta el índice actual (se va construyendo).
  const counters: { name: string; value: number }[] = [];
  let attackerPower: number | undefined;
  let defenderPower: number | undefined;
  let result: CombatInfo["result"];
  let damage: number | undefined;

  for (let i = a; i <= Math.min(index, windowEnd); i += 1) {
    const e = ev[i];
    if (e.kind === "counter") counters.push({ name: e.card.name, value: e.value });
    else if (e.kind === "combatResult") {
      attackerPower = e.attackerPower;
      defenderPower = e.defenderPower;
    } else if (e.kind === "attackFail") result = "fail";
    else if (e.kind === "damage") {
      result = "hit";
      damage = e.amount;
    } else if (e.kind === "destroy" && e.card.code === decl.defender.code) {
      result = "destroyed";
    }
  }

  const aSide = sideMap[decl.player] ?? null;
  return {
    attacker: { name: decl.attacker.name, code: decl.attacker.code, side: aSide, power: attackerPower },
    defender: {
      name: decl.defender.name,
      code: decl.defender.code,
      side: other(aSide),
      power: defenderPower,
    },
    counters,
    counterTotal: counters.reduce((s, c) => s + c.value, 0),
    result,
    damage,
  };
}
