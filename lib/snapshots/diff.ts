export interface SnapshotDiffCardEntry {
  cardId: number;
  code: string;
  name: string;
  src: string;
  quantity: number;
  isSold: boolean;
  soldPrice: number | null;
  customPrice: number | null;
}

export interface SnapshotQuantityChange {
  cardId: number;
  code: string;
  name: string;
  from: number;
  to: number;
}

export interface SnapshotDiffResult {
  added: SnapshotDiffCardEntry[];
  removed: SnapshotDiffCardEntry[];
  newlySold: SnapshotDiffCardEntry[];
  newlyAvailable: SnapshotDiffCardEntry[];
  quantityChanged: SnapshotQuantityChange[];
  soldRevenue: number;
}

/**
 * Compara dos estados de cartas (dos snapshots, o un snapshot vs. el estado
 * actual en vivo) y devuelve qué cambió entre "before" y "after".
 *
 * Simplificación conocida: compara por cardId, así que dos filas distintas
 * con el mismo cardId (ej. la misma carta en dos slots separados) se tratan
 * como una sola entrada agregada.
 */
export function diffSnapshotCards(
  before: SnapshotDiffCardEntry[],
  after: SnapshotDiffCardEntry[]
): SnapshotDiffResult {
  const beforeMap = new Map(before.map((c) => [c.cardId, c]));
  const afterMap = new Map(after.map((c) => [c.cardId, c]));

  const added: SnapshotDiffCardEntry[] = [];
  const newlySold: SnapshotDiffCardEntry[] = [];
  const newlyAvailable: SnapshotDiffCardEntry[] = [];
  const quantityChanged: SnapshotQuantityChange[] = [];
  let soldRevenue = 0;

  for (const [cardId, afterEntry] of Array.from(afterMap)) {
    const beforeEntry = beforeMap.get(cardId);

    if (!beforeEntry) {
      added.push(afterEntry);
      continue;
    }

    if (!beforeEntry.isSold && afterEntry.isSold) {
      newlySold.push(afterEntry);
      soldRevenue +=
        (afterEntry.soldPrice ?? afterEntry.customPrice ?? 0) *
        afterEntry.quantity;
    } else if (beforeEntry.isSold && !afterEntry.isSold) {
      newlyAvailable.push(afterEntry);
    }

    if (beforeEntry.quantity !== afterEntry.quantity) {
      quantityChanged.push({
        cardId,
        code: afterEntry.code,
        name: afterEntry.name,
        from: beforeEntry.quantity,
        to: afterEntry.quantity,
      });
    }
  }

  const removed: SnapshotDiffCardEntry[] = [];
  for (const [cardId, beforeEntry] of Array.from(beforeMap)) {
    if (!afterMap.has(cardId)) {
      removed.push(beforeEntry);
    }
  }

  return { added, removed, newlySold, newlyAvailable, quantityChanged, soldRevenue };
}
