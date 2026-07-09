// Reconstrucción EXACTA del tablero desde el stream de deltas RZ1 del log.
//
// Cada línea "RZ1|seq|player|code|zonaOrigen|posOrigen|zonaDestino|posDestino|…"
// registra el movimiento físico de UNA carta. Procesando el stream sabemos en
// qué zona está cada carta en todo momento — sin interpretar keywords.
//
// Zonas (campo): 0=deck, 1=mano, 2=personajes, 3=vida, 5=cost area(DON), 6=trash.

import { ParsedReplay, Rz1Player } from "@/types/replay";

export const RZ_ZONE = { DECK: 0, HAND: 1, CHAR: 2, LIFE: 3, COST: 5, TRASH: 6 } as const;

export interface RZ1Zones {
  hand: string[];
  char: string[];
  life: string[];
  trash: string[];
}

const emptyZones = (): RZ1Zones => ({ hand: [], char: [], life: [], trash: [] });

const ZONE_KEY: Record<number, keyof RZ1Zones | undefined> = {
  1: "hand",
  2: "char",
  3: "life",
  6: "trash",
};

const removeOne = (arr: string[], code: string) => {
  const i = arr.indexOf(code);
  if (i !== -1) arr.splice(i, 1);
};

/** Reconstruye las zonas de ambos jugadores procesando los deltas RZ1 hasta uptoIndex. */
export function reconstructFromRZ1(
  parsed: ParsedReplay,
  uptoIndex: number
): Record<Rz1Player, RZ1Zones> {
  const board: Record<Rz1Player, RZ1Zones> = { 1: emptyZones(), 2: emptyZones() };
  const end = Math.min(uptoIndex, parsed.events.length - 1);

  for (let i = 0; i <= end; i += 1) {
    const ev = parsed.events[i];
    if (ev.kind !== "rz1") continue;
    if (ev.token === "Don" || !/^[A-Z0-9-]+$/.test(ev.token)) continue; // solo cartas
    const z = board[ev.player];
    if (!z) continue;
    const srcZone = ev.fields[0];
    const dstZone = ev.fields[2];
    const srcKey = ZONE_KEY[srcZone];
    const dstKey = ZONE_KEY[dstZone];
    // Sacar de la zona origen (si la rastreamos).
    if (srcKey) removeOne(z[srcKey], ev.token);
    // Poner en la zona destino (si la rastreamos).
    if (dstKey) z[dstKey].push(ev.token);
  }

  return board;
}
