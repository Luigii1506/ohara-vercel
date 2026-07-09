// Extrae los datos del mulligan de cada jugador para animar la fase inicial:
// mano robada (5), si hizo mulligan, y la mano final (otras 5) si aplica.

import { ParsedReplay, PlayerRef } from "@/types/replay";
import { Side } from "@/types/simulator";
import { SideMap } from "@/lib/replay/reduce";

export interface MulliganInfo {
  player: PlayerRef;
  side: Side;
  opening: string[]; // las primeras 5 robadas
  mulliganed: boolean;
  final: string[]; // las 5 con las que se queda (== opening si "keep")
}

export function extractMulligans(parsed: ParsedReplay, sideMap: SideMap): MulliganInfo[] {
  const out: MulliganInfo[] = [];

  for (const player of parsed.header.players) {
    const side = sideMap[player];
    if (!side) continue;

    const before = parsed.events.find(
      (e) => e.kind === "handReveal" && e.player === player && e.phase === "before"
    );
    const after = parsed.events.find(
      (e) => e.kind === "handReveal" && e.player === player && e.phase === "after"
    );
    const mulliganEvt = parsed.events.find(
      (e) => e.kind === "mulligan" && e.player === player
    );

    // Robos del deck antes de que empiece el juego (primer End Turn) = fase de
    // mulligan: 5 si se queda, 10 si hizo mulligan (5 iniciales + 5 nuevas).
    const setupDraws: string[] = [];
    for (const e of parsed.events) {
      if (e.kind === "endTurn") break;
      if (e.kind === "draw" && e.player === player && e.drawType === "deck" && e.card) {
        setupDraws.push(e.card.code);
      }
    }

    // Señal de mulligan: robó 10 en la fase de setup, o hay checkpoint/evento.
    const mulliganed =
      Boolean(after || mulliganEvt) || setupDraws.length >= 10;

    // Mano inicial: checkpoint "before" si existe, si no las primeras 5 robadas.
    const opening =
      before && before.kind === "handReveal" ? before.cards : setupDraws.slice(0, 5);

    // Mano final: checkpoint "after" si existe; si hizo mulligan, las cartas
    // 6-10 de los robos; si se queda, la misma inicial.
    const final =
      after && after.kind === "handReveal"
        ? after.cards
        : mulliganed && setupDraws.length >= 10
        ? setupDraws.slice(5, 10)
        : opening;

    out.push({ player, side, opening, mulliganed, final });
  }

  return out;
}
