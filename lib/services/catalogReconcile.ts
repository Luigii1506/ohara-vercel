/**
 * Reconciliación de catálogo (Capa 1 del plan de cobertura total).
 *
 * Compara un catálogo maestro (DotGG, inglés) + nuestras propias cartas por
 * región contra lo que tenemos, y registra los huecos en la tabla `CatalogGap`:
 *
 *   - MISSING_ALL   : código base que existe en el master pero en NINGUNA de
 *                     nuestras regiones (contenido nuevo que no tenemos).
 *   - REGION_PARITY : código que tenemos en alguna región pero falta en otras
 *                     (paridad regional — ej. lo tiene US pero no CN/KR/FR).
 *
 * Es idempotente: hace upsert por `code`, actualiza regiones + lastSeenAt, y
 * marca `resolved=true` los gaps que ya se llenaron. No toca `Card` ni
 * `MissingCard` (esos viven en otros flujos). Solo lectura salvo CatalogGap.
 */
import { prisma } from "@/lib/prisma";

const DOTGG_URL =
  "https://api.dotgg.gg/cgfw/getcards?game=onepiece&mode=indexed";

export const RECONCILE_REGIONS = ["US", "JP", "CN", "KR", "FR"] as const;
export type ReconcileRegion = (typeof RECONCILE_REGIONS)[number];

export type ReconcileSummary = {
  dryRun: boolean;
  masterBaseCodes: number;
  tcgBaseCodes: number;
  ourBaseCodes: number;
  missingAll: number;
  regionParity: number;
  newUsMissing: number; // cartas del mercado US (TCGplayer) que faltan en US
  created: number;
  updated: number;
  resolved: number;
  missingRegionTotals: Record<ReconcileRegion, number>;
  sampleMissingAll: string[];
  sampleNewUs: string[];
};

/** Prefijo de set a partir del código (OP14-054 → OP14, P-040 → P). */
function setOf(code: string): string {
  const m = code.match(/^([A-Za-z]+\d+|[A-Za-z]+)(?=-|\d)/);
  if (m) return m[1].toUpperCase();
  const dash = code.indexOf("-");
  return (dash > 0 ? code.slice(0, dash) : code).toUpperCase();
}

// DotGG codifica alt-arts como CODE_P1 / CODE_R1; nosotros los guardamos como
// `alternateArt` sobre el mismo código base. Normalizamos para comparar.
const stripVariant = (code: string) => code.replace(/_[A-Za-z]\d+$/i, "");

// Los DON!! con id numérico de DotGG (DON-434340…) son ruido: modelamos DON
// aparte. Los excluimos de la detección de huecos.
const isDonNoise = (code: string) => /^DON-?\d{4,}$/i.test(code);

type MasterCard = { code: string; name: string | null };

/** Baja el catálogo maestro (DotGG) y devuelve códigos BASE únicos con nombre. */
async function fetchMaster(): Promise<Map<string, MasterCard>> {
  const res = await fetch(DOTGG_URL);
  if (!res.ok) throw new Error(`DotGG HTTP ${res.status}`);
  const payload = (await res.json()) as { names: string[]; data: any[][] };
  const idIdx = payload.names.indexOf("id");
  const nameIdx = payload.names.indexOf("name");

  const master = new Map<string, MasterCard>();
  for (const row of payload.data) {
    const raw = String(row[idIdx] ?? "").toUpperCase();
    if (!raw) continue;
    const code = stripVariant(raw);
    if (isDonNoise(code)) continue;
    if (!master.has(code)) {
      master.set(code, { code, name: nameIdx >= 0 ? (row[nameIdx] ?? null) : null });
    }
  }
  return master;
}

/** Carga nuestras cartas base por región → Map<code, Set<region>>.
 *  `region = null` se trata como US (convención del admin `regionOf` y del
 *  script backfill-card-region-us: las cartas sin región son del catálogo US). */
async function loadOurCoverage(): Promise<Map<string, Set<string>>> {
  const rows = await prisma.card.findMany({
    where: {
      isFirstEdition: true,
      OR: [{ region: { in: [...RECONCILE_REGIONS] } }, { region: null }],
    },
    select: { code: true, region: true },
  });
  const byCode = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.code) continue;
    const region = r.region ?? "US";
    const s = byCode.get(r.code) ?? new Set<string>();
    s.add(region);
    byCode.set(r.code, s);
  }
  return byCode;
}

type TcgInfo = {
  productId: number;
  url: string | null;
  imageUrl: string | null;
  name: string | null;
  cardType: string | null;
  rarity: string | null;
};

/** Carga el catálogo espejo de TCGplayer (cartas del mercado US) → Map<code>.
 *  El "Number" (código) vive en metadata.extendedData. Ignora sellados. */
async function loadTcgplayerCatalog(): Promise<Map<string, TcgInfo>> {
  const rows = await prisma.tcgCatalogProduct.findMany({
    where: { isSealed: false, productStatus: "active" },
    select: {
      productId: true,
      name: true,
      cardType: true,
      rarity: true,
      metadata: true,
    },
  });
  const byCode = new Map<string, TcgInfo>();
  for (const r of rows) {
    const meta: any = r.metadata ?? {};
    const ext: any[] = Array.isArray(meta.extendedData) ? meta.extendedData : [];
    const number = ext.find((e) => e?.name === "Number")?.value;
    const code = String(number ?? "").toUpperCase().trim();
    if (!code || !/^[A-Za-z]+-?\d/.test(code)) continue;
    if (isDonNoise(code)) continue;
    // Nos quedamos con un producto por código (el de menor productId = base).
    const prev = byCode.get(code);
    if (!prev || r.productId < prev.productId) {
      byCode.set(code, {
        productId: r.productId,
        url: meta.url ?? null,
        imageUrl: meta.imageUrl ?? null,
        name: r.name ?? null,
        cardType: r.cardType ?? null,
        rarity: r.rarity ?? null,
      });
    }
  }
  return byCode;
}

type ComputedGap = {
  code: string;
  setCode: string;
  name: string | null;
  kind: "MISSING_ALL" | "REGION_PARITY";
  presentRegions: string[];
  missingRegions: string[];
  source: string;
  tcg: TcgInfo | null;
};

/**
 * Ejecuta la reconciliación. Con `dryRun` solo calcula y devuelve el resumen
 * sin escribir en la DB.
 */
export async function reconcileCatalog(
  opts: { dryRun?: boolean } = {}
): Promise<ReconcileSummary> {
  const dryRun = opts.dryRun ?? false;

  const [master, ours, tcg] = await Promise.all([
    fetchMaster(),
    loadOurCoverage(),
    loadTcgplayerCatalog(),
  ]);

  // Universo de códigos: master (DotGG) + TCGplayer (mercado US) + lo que
  // tenemos (para detectar exclusivas regionales que el inglés no lista).
  const allCodes = new Set<string>(
    Array.from(master.keys())
      .concat(Array.from(tcg.keys()))
      .concat(Array.from(ours.keys()))
  );

  const gaps: ComputedGap[] = [];
  const missingRegionTotals: Record<ReconcileRegion, number> = {
    US: 0, JP: 0, CN: 0, KR: 0, FR: 0,
  };

  for (const code of Array.from(allCodes)) {
    if (isDonNoise(code)) continue;
    const present = ours.get(code) ?? new Set<string>();
    const presentRegions = RECONCILE_REGIONS.filter((r) => present.has(r));
    const missingRegions = RECONCILE_REGIONS.filter((r) => !present.has(r));

    const tcgInfo = tcg.get(code) ?? null;
    // Si TCGplayer lista la carta, es la fuente autorizada del mercado US.
    const source = tcgInfo ? "tcgplayer" : "dotgg";
    const name = master.get(code)?.name ?? tcgInfo?.name ?? null;
    const base = { code, setCode: setOf(code), name, presentRegions, missingRegions, source, tcg: tcgInfo };

    if (presentRegions.length === 0) {
      // No la tenemos en ninguna región → contenido nuevo.
      gaps.push({ ...base, kind: "MISSING_ALL" });
    } else if (missingRegions.length > 0) {
      // La tenemos en algunas regiones pero no en todas → paridad.
      gaps.push({ ...base, kind: "REGION_PARITY" });
    }
    for (const r of missingRegions) {
      if (presentRegions.length > 0) missingRegionTotals[r] += 1;
    }
  }

  const missingAll = gaps.filter((g) => g.kind === "MISSING_ALL").length;
  const regionParity = gaps.filter((g) => g.kind === "REGION_PARITY").length;
  // Cartas del mercado US (TCGplayer) que nos faltan en US: la prioridad.
  const newUs = gaps.filter(
    (g) => g.source === "tcgplayer" && g.missingRegions.includes("US")
  );
  const sampleMissingAll = gaps
    .filter((g) => g.kind === "MISSING_ALL")
    .map((g) => g.code)
    .sort()
    .slice(0, 25);
  const sampleNewUs = newUs.map((g) => g.code).sort().slice(0, 25);

  let created = 0;
  let updated = 0;
  let resolved = 0;

  if (!dryRun) {
    const currentCodes = new Set(gaps.map((g) => g.code));
    const existingCodes = new Set(
      (await prisma.catalogGap.findMany({ select: { code: true } })).map(
        (r) => r.code
      )
    );

    // Upsert de cada hueco vigente (secuencial → una conexión, sin saturar pool).
    for (const g of gaps) {
      const isNew = !existingCodes.has(g.code);
      await prisma.catalogGap.upsert({
        where: { code: g.code },
        update: {
          setCode: g.setCode,
          name: g.name ?? undefined,
          kind: g.kind,
          presentRegions: g.presentRegions,
          missingRegions: g.missingRegions,
          source: g.source,
          tcgProductId: g.tcg?.productId ?? null,
          tcgUrl: g.tcg?.url ?? null,
          imageUrl: g.tcg?.imageUrl ?? null,
          cardType: g.tcg?.cardType ?? null,
          rarity: g.tcg?.rarity ?? null,
          resolved: false,
          lastSeenAt: new Date(),
        },
        create: {
          code: g.code,
          setCode: g.setCode,
          name: g.name,
          kind: g.kind,
          presentRegions: g.presentRegions,
          missingRegions: g.missingRegions,
          source: g.source,
          tcgProductId: g.tcg?.productId ?? null,
          tcgUrl: g.tcg?.url ?? null,
          imageUrl: g.tcg?.imageUrl ?? null,
          cardType: g.tcg?.cardType ?? null,
          rarity: g.tcg?.rarity ?? null,
        },
      });
      if (isNew) created += 1;
      else updated += 1;
    }

    // Huecos que ya no aplican (se llenaron) → resolved=true.
    const stale = await prisma.catalogGap.findMany({
      where: { resolved: false },
      select: { id: true, code: true },
    });
    const toResolve = stale
      .filter((s) => !currentCodes.has(s.code))
      .map((s) => s.id);
    if (toResolve.length) {
      const r = await prisma.catalogGap.updateMany({
        where: { id: { in: toResolve } },
        data: { resolved: true },
      });
      resolved = r.count;
    }
  }

  return {
    dryRun,
    masterBaseCodes: master.size,
    tcgBaseCodes: tcg.size,
    ourBaseCodes: ours.size,
    missingAll,
    regionParity,
    newUsMissing: newUs.length,
    created,
    updated,
    resolved,
    missingRegionTotals,
    sampleMissingAll,
    sampleNewUs,
  };
}
