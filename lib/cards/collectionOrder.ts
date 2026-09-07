import { prisma } from "@/lib/prisma";
import { getPrefixIndex } from "./sort";

/**
 * Misma fórmula que lib/cards/sort.ts (getCollectionOrderKey, la que usan
 * las páginas para auto-sanar cartas sin collectionOrder en cliente) y los
 * scripts scripts/update-collection-order.ts / finish-collection-order.ts —
 * pero server-only y con un tipo de entrada liviano (no CardWithCollectionData,
 * pensado para la UI) para poder llamarla desde cualquier endpoint que crea
 * cartas sin tener que armar un objeto compatible con esa interfaz completa.
 *
 * Se duplica el cuerpo de la fórmula (no se importa de lib/cards/sort.ts)
 * porque esas funciones internas no están exportadas — sí se reusa
 * getPrefixIndex, que ya es pública y no depende de tipos de UI.
 */
const digitsRegex = /\d+/g;

const normalizeCodeSegment = (value: string) =>
  value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(digitsRegex, (match) => match.padStart(4, "0"));

const normalizeAlternateOrder = (value?: string | null) => {
  if (!value) return "zzzz";
  const trimmed = value.trim();
  if (!trimmed) return "zzzz";
  const numeric = trimmed.match(/^\d+/);
  if (numeric) return numeric[0].padStart(4, "0");
  return trimmed.padStart(4, "0");
};

export interface CollectionOrderInput {
  id: number;
  code: string;
  category?: string | null;
  baseCardId?: number | null;
  order?: string | null;
}

/** Calcula el collectionOrder desde cero — requiere el id ya asignado
 * (autoincrement de Postgres), así que solo se puede llamar DESPUÉS del
 * create(). Úsalo solo cuando no hay ningún sibling con el mismo código del
 * que copiar (ver resolveSiblingCollectionOrder). */
export function computeCollectionOrder(card: CollectionOrderInput): string {
  const prefixIndex = getPrefixIndex(card.code, card.category ?? undefined);
  const normalizedCode = normalizeCodeSegment(card.code);
  const isBaseCard = card.baseCardId === null || card.baseCardId === undefined;
  const suffix = isBaseCard
    ? "00"
    : `10_${normalizeAlternateOrder(card.order)}_${String(card.baseCardId ?? "").padStart(6, "0")}`;
  return `${prefixIndex.toString().padStart(2, "0")}_${normalizedCode}_${suffix}_${card.id
    .toString()
    .padStart(6, "0")}`;
}

/**
 * Busca una carta EXISTENTE con el mismo código que ya tenga collectionOrder
 * calculado, para reusarlo tal cual — mismo criterio que ya usan
 * kr/cnOfficialSync: mantiene todas las variantes/regiones del mismo código
 * agrupadas en el orden global, en vez de que cada una saque un id distinto
 * y terminen dispersas. Devuelve null solo cuando el código es genuinamente
 * nuevo (nunca visto en ninguna región/variante) — ahí sí hay que calcular
 * desde cero con computeCollectionOrder() después del create().
 */
export async function resolveSiblingCollectionOrder(
  code: string
): Promise<string | null> {
  if (!code) return null;
  const sibling = await prisma.card.findFirst({
    where: { code, collectionOrder: { not: "" } },
    select: { collectionOrder: true },
  });
  return sibling?.collectionOrder || null;
}

/**
 * Asigna collectionOrder a una carta RECIÉN creada — un segundo paso porque
 * la fórmula necesita el id ya asignado por Postgres. Llamar siempre después
 * de prisma.card.create(), pasando el sibling ya resuelto (o null) desde
 * ANTES del create para no repetir la query.
 */
export async function assignCollectionOrderAfterCreate(
  cardId: number,
  input: Omit<CollectionOrderInput, "id">,
  siblingCollectionOrder: string | null
): Promise<void> {
  const collectionOrder =
    siblingCollectionOrder ?? computeCollectionOrder({ ...input, id: cardId });
  await prisma.card.update({
    where: { id: cardId },
    data: { collectionOrder },
  });
}
