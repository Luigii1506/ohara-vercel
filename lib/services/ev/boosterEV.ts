/**
 * Motor de EV ("valor esperado") de productos sellados — "¿cuánto vale un sobre?
 * ¿es oro comprar esta caja?".
 *
 * Idea: por caja (24 sobres) esperamos cierto número de copias de cada
 * rareza/variante (las TASAS). Multiplicando por el precio promedio de mercado
 * de las cartas de ese bucket en el set, obtenemos el valor esperado de una caja
 * y, dividiendo, el de un sobre. El veredicto compara EV contra el precio real.
 *
 * Las TASAS son DEFAULTS editables (basadas en la estructura típica de un booster
 * de One Piece). Ajusta PULL_RATES / PACKS_PER_BOX sin tocar el resto del motor.
 */

/** Buckets de rareza/variante. Los ALT_* son las versiones alternas (parallel /
 *  alt-art / foil) — donde vive casi todo el valor. */
export type EvBucket =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "SUPER_RARE"
  | "SECRET_RARE"
  | "LEADER"
  | "TREASURE_RARE"
  | "SPECIAL_CARD"
  | "ALT_RARE"
  | "ALT_SUPER_RARE"
  | "ALT_SECRET_RARE"
  | "ALT_LEADER";

/** Sobres por caja y cajas por "case" (para cases sellados). */
export const PACKS_PER_BOX = 24;
export const BOXES_PER_CASE = 12;

/**
 * TASAS = copias esperadas de cada bucket POR CAJA (24 sobres = 288 cartas).
 *
 * Calibradas con datos de la comunidad (Bandai NO publica odds oficiales), que
 * convergen en, por caja de 24 sobres:
 *   · Super Rare (base) ~4–5   · Secret Rare (base) ~0.5   · Leader base 2
 *   · Rare ~24                  · Parallels/alt-art TOTALES ~1.5 (incl. Leader
 *     parallel)                 · Special Rare (SP) ~1 por case (0.08/caja)
 *   · Manga Rare "casi nunca"   · el resto Common/Uncommon
 * Los ALT_* (parallels) reparten ese ~1.5 pesando hacia R/SR (más frecuentes) y
 * menos hacia Leader/SEC (raros). EDITABLE: ajusta por set si tienes mejores
 * datos. Fuentes: archivedrops, cardcosmos, tcgtalk (community pull-rate guides).
 */
export const PULL_RATES: Record<EvBucket, number> = {
  COMMON: 144, // ~6/sobre
  UNCOMMON: 72, // ~3/sobre
  RARE: 24, // ~1/sobre (base)
  LEADER: 2, // 2 líderes base por caja
  SUPER_RARE: 5, // 4–5 SR base por caja
  SECRET_RARE: 0.5, // ~1 cada 2 cajas
  TREASURE_RARE: 0.05,
  SPECIAL_CARD: 0.08, // SP ~1 por case
  // Parallels / alt-art: ~1.5 en total por caja
  ALT_RARE: 0.6,
  ALT_SUPER_RARE: 0.55,
  ALT_SECRET_RARE: 0.08,
  ALT_LEADER: 0.25,
};

/** Umbrales del veredicto (EV / precio). */
export const EV_VERDICT = {
  oroRatio: 1.0, // EV ≥ precio → conviene ("oro")
  fairRatio: 0.85, // 0.85–1.0 → justo
} as const;

export type EvVerdict = "oro" | "justo" | "caro";

export interface CardForEv {
  rarity: string | null;
  alternateArt: string | null;
  // number | string | Prisma.Decimal | null (estructural para no importar Prisma).
  marketPrice: number | string | { toString(): string } | null;
  code?: string | null;
}

/** Prefijo de set de un código: "OP15-118" → "OP15", "P-040" → "P". */
export function codePrefix(code: string | null | undefined): string {
  const m = (code ?? "").toUpperCase().match(/^([A-Z]+\d*|[A-Z]+)/);
  return m ? m[1] : "";
}

/**
 * Sets "curados" (reimpresiones/promos) que LEGÍTIMAMENTE mezclan cartas de
 * muchos sets: ahí no hay que filtrar por prefijo. Ej. "One Piece The Best",
 * "Premium Booster", "Anime 25th Collection", promos.
 */
export function isCuratedSet(name: string | null | undefined): boolean {
  const n = (name ?? "").toLowerCase();
  return /\bbest\b|premium|collection|promo|promotional|limited|misc|anniversary|memorial|the best/.test(
    n
  );
}

/**
 * Pool de cartas que REALMENTE puede salir del sobre de este set. En un booster
 * normal el pool es su prefijo dominante; la cola foránea (cartas mal linkeadas
 * de otros sets) se descarta para no inflar el EV. En sets curados se conserva
 * todo (su mezcla es real).
 */
export function selectEvPool<T extends { code?: string | null }>(
  cards: T[],
  setName?: string | null
): T[] {
  if (cards.length === 0) return cards;
  if (isCuratedSet(setName)) return cards;

  // Prefijo dominante por conteo.
  const byPrefix = new Map<string, number>();
  for (const c of cards) {
    const p = codePrefix(c.code);
    if (!p) continue;
    byPrefix.set(p, (byPrefix.get(p) ?? 0) + 1);
  }
  if (byPrefix.size <= 1) return cards;
  const dominant = Array.from(byPrefix.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
  return cards.filter((c) => codePrefix(c.code) === dominant);
}

/** Mapea el bucket base a partir del string de rareza. */
function baseBucket(rarity: string | null): EvBucket | null {
  const r = (rarity ?? "").toLowerCase().trim();
  if (r === "common" || r === "c") return "COMMON";
  if (r === "uncommon" || r === "uc") return "UNCOMMON";
  if (r === "rare" || r === "r") return "RARE";
  if (r === "super rare" || r === "sr") return "SUPER_RARE";
  if (r === "secret rare" || r === "sec") return "SECRET_RARE";
  if (r === "leader" || r === "l") return "LEADER";
  if (r === "treasure rare" || r === "tr") return "TREASURE_RARE";
  if (r === "special card" || r === "sp" || r === "spc") return "SPECIAL_CARD";
  if (r === "promo" || r === "pr" || r === "p") return null; // promos no salen en sobres
  return null;
}

/** Bucket final de una carta (aplica la capa ALT si es alterna). */
export function bucketOf(card: CardForEv): EvBucket | null {
  const base = baseBucket(card.rarity);
  if (!base) return null;
  if (!card.alternateArt) return base;
  // Versión alterna → bucket ALT_* si existe; si no, cae al base.
  switch (base) {
    case "RARE":
      return "ALT_RARE";
    case "SUPER_RARE":
      return "ALT_SUPER_RARE";
    case "SECRET_RARE":
      return "ALT_SECRET_RARE";
    case "LEADER":
      return "ALT_LEADER";
    default:
      return base; // ALT de common/uncommon: sin bucket propio, usa el base
  }
}

const num = (
  v: number | string | { toString(): string } | null
): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v as any);
  return Number.isFinite(n) ? n : null;
};

export interface BucketStat {
  bucket: EvBucket;
  count: number; // cartas del bucket en el set
  priced: number; // cuántas tienen precio
  avgPrice: number; // precio promedio (de las que tienen precio)
  ratePerBox: number; // copias esperadas por caja
  evPerBox: number; // avgPrice × ratePerBox
}

/** Estadísticas por bucket de un pool de cartas (un set). */
export function computeBucketStats(cards: CardForEv[]): BucketStat[] {
  const agg = new Map<EvBucket, { count: number; priced: number; sum: number }>();
  for (const c of cards) {
    const b = bucketOf(c);
    if (!b) continue;
    const e = agg.get(b) ?? { count: 0, priced: 0, sum: 0 };
    e.count++;
    const p = num(c.marketPrice);
    if (p != null) {
      e.priced++;
      e.sum += p;
    }
    agg.set(b, e);
  }
  const stats: BucketStat[] = [];
  for (const [bucket, e] of Array.from(agg.entries())) {
    const avgPrice = e.priced > 0 ? e.sum / e.priced : 0;
    const ratePerBox = PULL_RATES[bucket] ?? 0;
    stats.push({
      bucket,
      count: e.count,
      priced: e.priced,
      avgPrice,
      ratePerBox,
      evPerBox: avgPrice * ratePerBox,
    });
  }
  // Ordena por aporte de valor desc.
  return stats.sort((a, b) => b.evPerBox - a.evPerBox);
}

export interface BoxEv {
  evBox: number; // valor esperado de una caja
  evPack: number; // valor esperado de un sobre
  buckets: BucketStat[];
}

/** EV de una caja (y de un sobre) a partir del pool de cartas del set. */
export function computeBoxEv(cards: CardForEv[]): BoxEv {
  const buckets = computeBucketStats(cards);
  const evBox = buckets.reduce((acc, b) => acc + b.evPerBox, 0);
  return {
    evBox,
    evPack: evBox / PACKS_PER_BOX,
    buckets,
  };
}

export type EvUnit = "pack" | "box" | "case" | null;

/**
 * Determina qué "unidad" sellada es un producto por su tipo/nombre, para saber
 * contra qué EV comparar su precio.
 */
export function productEvUnit(
  productType: string,
  name: string
): { unit: EvUnit; multiplier: number } {
  const n = (name ?? "").toLowerCase();
  const isCase = /\bcase\b/.test(n);
  if (productType === "BOOSTER") {
    // "Booster Pack" = 1 sobre; "Booster Box" a veces cae aquí.
    if (/box/.test(n) && !/pack/.test(n)) return { unit: "box", multiplier: 1 };
    return { unit: "pack", multiplier: 1 };
  }
  if (productType === "DISPLAY_BOX" || productType === "PREMIUM_BOOSTER_BOX") {
    if (isCase) return { unit: "case", multiplier: BOXES_PER_CASE };
    return { unit: "box", multiplier: 1 };
  }
  return { unit: null, multiplier: 0 };
}

export interface ProductEv {
  applicable: boolean;
  unit: EvUnit;
  ev: number | null; // EV de la unidad del producto
  price: number | null;
  ratio: number | null; // ev / price
  marginPct: number | null; // (ev/price - 1) × 100
  verdict: EvVerdict | null;
  evBox: number;
  evPack: number;
  buckets: BucketStat[];
}

function verdictFor(ratio: number | null): EvVerdict | null {
  if (ratio == null) return null;
  if (ratio >= EV_VERDICT.oroRatio) return "oro";
  if (ratio >= EV_VERDICT.fairRatio) return "justo";
  return "caro";
}

/**
 * EV completo de un producto sellado: elige la unidad (sobre/caja/case) según
 * el tipo/nombre, escala el EV y emite veredicto vs el precio de mercado.
 */
export function computeProductEv(
  product: {
    productType: string;
    name: string;
    marketPrice: number | string | { toString(): string } | null;
  },
  cards: CardForEv[],
  setName?: string | null
): ProductEv {
  const pool = selectEvPool(cards, setName);
  const box = computeBoxEv(pool);
  const { unit, multiplier } = productEvUnit(product.productType, product.name);
  const price = num(product.marketPrice);

  if (!unit || multiplier === 0) {
    return {
      applicable: false,
      unit: null,
      ev: null,
      price,
      ratio: null,
      marginPct: null,
      verdict: null,
      evBox: box.evBox,
      evPack: box.evPack,
      buckets: box.buckets,
    };
  }

  const ev =
    unit === "pack" ? box.evPack : unit === "case" ? box.evBox * multiplier : box.evBox;
  const ratio = price && price > 0 ? ev / price : null;

  return {
    applicable: true,
    unit,
    ev,
    price,
    ratio,
    marginPct: ratio != null ? (ratio - 1) * 100 : null,
    verdict: verdictFor(ratio),
    evBox: box.evBox,
    evPack: box.evPack,
    buckets: box.buckets,
  };
}
