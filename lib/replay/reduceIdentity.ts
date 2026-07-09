// Reducer de IDENTIDAD desde el stream de deltas RZ1.
//
// A diferencia de reduceRZ1 (que solo rastrea pertenencia por multiconjunto),
// aquí cada carta física conserva un uid PERSISTENTE desde que aparece y a través
// de todos sus movimientos (deck→mano→personaje→trash…). Como el plegado es
// determinista (contador reiniciado por llamada), los uids son estables entre
// índices adyacentes → sin parpadeo, y da precisión exacta a mitad de turno para
// las cartas boca arriba (mano/personajes).
//
// Zonas RZ1: 0=deck, 1=mano, 2=personajes, 3=vida, 5=cost, 6=trash.

import { ParsedReplay, Rz1Player } from "@/types/replay";

export interface IdCard {
  uid: string;
  code: string;
  rested: boolean;
}

export type IdZones = Record<number, IdCard[]>;

const TRACKED = [0, 1, 2, 3, 6];
const newZones = (): IdZones => ({ 0: [], 1: [], 2: [], 3: [], 6: [] });

/** Reconstruye las zonas de ambos jugadores con uids persistentes hasta uptoIndex. */
export function reconstructIdentity(
  parsed: ParsedReplay,
  uptoIndex: number
): Record<Rz1Player, IdZones> {
  const players: Record<Rz1Player, IdZones> = { 1: newZones(), 2: newZones() };
  let counter = 0;
  const end = Math.min(uptoIndex, parsed.events.length - 1);

  for (let i = 0; i <= end; i += 1) {
    const ev = parsed.events[i];
    if (ev.kind !== "rz1") continue;
    if (ev.token === "Don" || !/^[A-Z0-9-]+$/.test(ev.token)) continue;
    const z = players[ev.player];
    if (!z) continue;

    const srcZone = ev.fields[0];
    const dstZone = ev.fields[2];
    const dstPos = ev.fields[3];
    const rested = ev.fields[4] === 2; // se afina luego; por ahora heurístico

    // Obtener la carta física (preservando su uid si ya existía).
    let card: IdCard;
    if (TRACKED.includes(srcZone) && z[srcZone]) {
      const arr = z[srcZone];
      // Buscar por código (cualquier copia; para el tablero son intercambiables).
      const idx = arr.findIndex((c) => c.code === ev.token);
      if (idx !== -1) {
        card = arr[idx];
        arr.splice(idx, 1);
        card.code = ev.token; // revelar si venía boca abajo
      } else {
        card = { uid: `id${counter++}`, code: ev.token, rested: false };
      }
    } else {
      // Desde deck u origen no rastreado → carta nueva revelada.
      card = { uid: `id${counter++}`, code: ev.token, rested: false };
    }
    card.rested = rested;

    // Insertar en la zona destino (si la rastreamos).
    if (TRACKED.includes(dstZone) && z[dstZone]) {
      const arr = z[dstZone];
      const pos = Math.min(Math.max(dstPos, 0), arr.length);
      arr.splice(pos, 0, card);
    }
  }

  return players;
}
