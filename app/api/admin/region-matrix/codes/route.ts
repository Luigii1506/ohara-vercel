export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCollectionOrderKey } from "@/lib/cards/sort";
import { REGION_OPTIONS } from "@/lib/regions";

// Cartas "de utilería" que no deben contar como catálogo real: alternas de
// demostración/preview (alternateArt "Demo Version"), impresiones
// pre-errata reemplazadas por una reimpresión corregida, y cualquier carta
// que venga del set "Demo Deck". Ninguna de las tres es la carta que un
// coleccionista busca — ensucian el conteo de regiones/exclusivas.
// COALESCE es obligatorio: "col ILIKE ..." da NULL (no false) cuando col es
// NULL, y NOT NULL sigue siendo NULL — sin esto, WHERE NOT(...) descarta
// TODAS las filas con alternateArt/disclaimer nulos (la inmensa mayoría).
const EXCLUDE_DEMO_ERRATA = Prisma.sql`(
  COALESCE("alternateArt", '') ILIKE '%demo%'
  OR COALESCE(disclaimer, '') ILIKE '%errata%'
  OR EXISTS (
    SELECT 1 FROM "CardSet" cs
    JOIN "Set" s ON s.id = cs."setId"
    WHERE cs."cardId" = "Card".id AND s.title ILIKE '%demo deck%'
  )
)`;

type RepresentativeRow = {
  id: number;
  code: string;
  name: string;
  src: string;
  imageKey: string | null;
  setCode: string;
  category: string;
  collectionOrder: string;
  order: string;
};

type AggregateRow = {
  code: string;
  regions: string[] | null;
  hasExclusive: boolean;
  totalVariants: number;
};

const REGION_CODES = REGION_OPTIONS.map((option) => option.code);

// GET: catálogo completo de códigos únicos (una carta base representativa
// por código) con la cobertura de regiones y bandera de exclusiva, para
// alimentar la grilla de /admin/region-matrix.
export async function GET() {
  try {
    const [representatives, aggregates] = await Promise.all([
      prisma.$queryRaw<RepresentativeRow[]>`
        SELECT DISTINCT ON (code)
          id, code, name, src, "imageKey", "setCode", category, "collectionOrder", "order"
        FROM "Card"
        WHERE NOT ${EXCLUDE_DEMO_ERRATA}
        ORDER BY code,
          "isFirstEdition" DESC,
          ("baseCardId" IS NULL) DESC,
          (region = 'US') DESC,
          id ASC
      `,
      prisma.$queryRaw<AggregateRow[]>`
        SELECT code,
          array_agg(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region <> '') AS regions,
          bool_or("isRegionalExclusive") AS "hasExclusive",
          count(*)::int AS "totalVariants"
        FROM "Card"
        WHERE NOT ${EXCLUDE_DEMO_ERRATA}
        GROUP BY code
      `,
    ]);

    const aggByCode = new Map(aggregates.map((row) => [row.code, row]));

    const items = representatives
      .map((rep) => {
        const agg = aggByCode.get(rep.code);
        // Filtramos a solo las regiones "canónicas" (REGION_OPTIONS) — un
        // puñado de cartas legacy tienen region="EN"/"CN-S" sueltos que no
        // son una región real del selector, y no deben inflar el conteo.
        const regions = REGION_CODES.filter((code) =>
          (agg?.regions ?? []).includes(code)
        );
        const missingRegions = REGION_CODES.filter(
          (code) => !regions.includes(code)
        );

        return {
          id: rep.id,
          code: rep.code,
          name: rep.name,
          src: rep.src,
          imageKey: rep.imageKey,
          setCode: rep.setCode,
          category: rep.category,
          regions,
          missingRegions,
          hasExclusive: agg?.hasExclusive ?? false,
          totalVariants: agg?.totalVariants ?? 0,
          sortKey: getCollectionOrderKey({
            id: rep.id,
            code: rep.code,
            setCode: rep.setCode,
            category: rep.category,
            collectionOrder: rep.collectionOrder,
            order: rep.order,
            baseCardId: null,
          } as any),
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...item }) => item);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("Error building region-matrix code catalog:", error);
    return NextResponse.json(
      { error: "Failed to load code catalog." },
      { status: 500 }
    );
  }
}
