import { CardWithCollectionData } from "@/types";

/**
 * Cache para mejorar performance del ordenamiento
 */
const prefixIndexCache: Record<string, number> = {};

/**
 * Obtiene el índice de prioridad basado en el prefijo del código de carta
 *
 * Orden de prioridad:
 * 0 = OP (One Piece main sets)
 * 1 = EB (Extra Boosters)
 * 2 = ST (Starter Decks)
 * 3 = P  (Promos)
 * 4 = PRB (Promotional Booster)
 * 5 = DON (Don!! cards - forced to appear at the end)
 * 6 = Otros
 *
 * @param code - Código de la carta (ej: "OP01-001", "EB01-001")
 * @returns Índice de prioridad (0-4)
 */
export const getPrefixIndex = (
  code: string,
  category?: string
): number => {
  const cacheKey = `${category ?? "?"}:${code}`;
  if (prefixIndexCache[cacheKey]) return prefixIndexCache[cacheKey];

  let index = 6; // Default para códigos desconocidos
  if (category === "DON") {
    index = 5;
  } else if (code.startsWith("OP")) index = 0;
  else if (code.startsWith("EB")) index = 1;
  else if (code.startsWith("ST")) index = 2;
  else if (code.startsWith("P")) index = 3;
  else if (code.startsWith("PRB")) index = 4;

  prefixIndexCache[cacheKey] = index;
  return index;
};

/**
 * Función de ordenamiento estándar para cartas de la colección
 *
 * Ordena primero por prefijo (OP → EB → ST → P → otros)
 * y luego alfabéticamente por código dentro de cada grupo
 *
 * @param a - Primera carta a comparar
 * @param b - Segunda carta a comparar
 * @returns Número negativo si a < b, positivo si a > b, 0 si son iguales
 *
 * @example
 * ```typescript
 * const cards = [...];
 * const sorted = cards.sort(sortByCollectionOrder);
 * // Resultado: [OP01-001, OP01-002, ..., EB01-001, ..., ST01-001, ..., P-001, ...]
 * ```
 */
export const sortByCollectionOrder = (
  a: CardWithCollectionData,
  b: CardWithCollectionData
): number => {
  const codeA = a.code || a.setCode || "";
  const codeB = b.code || b.setCode || "";
  const idxA = getPrefixIndex(codeA, a.category);
  const idxB = getPrefixIndex(codeB, b.category);

  // Si tienen diferente prefijo, ordenar por prioridad de prefijo
  if (idxA !== idxB) return idxA - idxB;

  // Mismo prefijo, ordenar alfabéticamente por código
  return codeA.localeCompare(codeB);
};

/**
 * Ordena un array de cartas usando el orden estándar de colección
 *
 * @param cards - Array de cartas a ordenar
 * @returns Nuevo array ordenado (no modifica el original)
 *
 * @example
 * ```typescript
 * const unordered = [card1, card2, card3];
 * const ordered = sortCards(unordered);
 * ```
 */
export const sortCards = (
  cards: CardWithCollectionData[]
): CardWithCollectionData[] => {
  return [...cards].sort(sortByCollectionOrder);
};
