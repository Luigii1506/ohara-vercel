// Hidratación de códigos → datos de carta para el visor de replay.
//
// El reducer sólo conoce el código (OP11-040). Aquí resolvemos cada código a su
// carta canónica (nombre + imagen) vía /api/cards/by-codes y rellenamos el campo
// `card` de cada CardInstance para que el SimulatorBoard muestre las imágenes.

import { ParsedReplay } from "@/types/replay";
import { CardWithCollectionData, Card } from "@/types";
import { SimulationState } from "@/types/simulator";

export interface MinimalCard {
  id: number;
  code: string;
  name: string;
  src: string;
  category: string;
  cost: string | null;
  power: string | null;
  life?: string | null;
}

export type CardMap = Record<string, MinimalCard>;

/** Todos los códigos únicos que aparecen en el replay (líderes + eventos). */
export function collectCodes(parsed: ParsedReplay): string[] {
  const set = new Set<string>();
  for (const card of Object.values(parsed.header.leaders)) {
    if (card?.code) set.add(card.code);
  }
  for (const ev of parsed.events) {
    switch (ev.kind) {
      case "draw":
        if (ev.card?.code) set.add(ev.card.code);
        break;
      case "deploy":
        set.add(ev.card.code);
        break;
      case "attachDon":
        if (ev.target.code) set.add(ev.target.code);
        break;
      case "attackDeclare":
        set.add(ev.attacker.code);
        set.add(ev.defender.code);
        break;
      case "block":
        set.add(ev.blocker.code);
        break;
      case "destroy":
      case "counter":
        set.add(ev.card.code);
        break;
      case "checkpoint":
        ev.cards.forEach((c) => set.add(c));
        break;
      case "handReveal":
        ev.cards.forEach((c) => set.add(c));
        break;
      case "ability":
        if (ev.source.code) set.add(ev.source.code);
        ev.targets.forEach((t) => t.code && set.add(t.code));
        break;
      default:
        break;
    }
  }
  return Array.from(set);
}

/** Pide al backend el mapa código → carta mínima. */
export async function fetchCardMap(codes: string[]): Promise<CardMap> {
  if (codes.length === 0) return {};
  const res = await fetch("/api/cards/by-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes }),
  });
  if (!res.ok) throw new Error("No se pudieron resolver las cartas");
  const data = (await res.json()) as { cards: CardMap };
  return data.cards ?? {};
}

/**
 * Rellena `card` en cada CardInstance del estado usando el mapa de cartas.
 * Devuelve un NUEVO estado (no muta el original). Las instancias sin código
 * (reversos del deck) quedan como están → se ven boca abajo.
 */
export function hydrateState(state: SimulationState, cardMap: CardMap): SimulationState {
  const cards: SimulationState["cards"] = {};
  for (const [uid, inst] of Object.entries(state.cards)) {
    const code = inst.cardId as string | undefined;
    const found = code ? cardMap[code] : undefined;
    cards[uid] = found
      ? {
          ...inst,
          // Adaptamos la carta mínima a la forma que consume SimulatorCard
          // (usa `card.name` y `card.src`).
          card: found as unknown as CardWithCollectionData | Card,
        }
      : inst;
  }
  return { ...state, cards };
}
