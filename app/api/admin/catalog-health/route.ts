export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RECONCILE_REGIONS } from "@/lib/services/catalogReconcile";

// Regiones que sí tienen alguna fuente de "conteo declarado" persistida en
// SetSource (Limitless para US, Official Sync para JP/FR/ASIA-EN). KR/CN no
// tienen scraper de sitio oficial todavía — para esas dos solo mostramos
// conteo de CatalogGap (gaps a nivel de código, ya cubre las 5 regiones).
const REGIONS_WITH_DECLARED_COUNT = new Set(["US", "JP", "FR", "ASIA-EN"]);

function normalizeRegionLabel(region: string | null): string {
  return region && region.trim() ? region : "US";
}

export async function GET() {
  try {
    const cardCountsRaw = await prisma.card.groupBy({
      by: ["region"],
      _count: { _all: true },
    });
    const cardCountsByRegion: Record<string, number> = {};
    for (const row of cardCountsRaw) {
      const region = normalizeRegionLabel(row.region);
      cardCountsByRegion[region] =
        (cardCountsByRegion[region] ?? 0) + row._count._all;
    }

    const setSources = await prisma.setSource.findMany({
      where: { declaredCount: { not: null } },
      select: {
        setId: true,
        source: true,
        sourceUrl: true,
        declaredCount: true,
        lastCheckedAt: true,
        set: { select: { id: true, title: true, code: true, region: true } },
      },
    });

    // Contar solo las cartas de LA MISMA región que el set — igual que
    // loadDbCardsForSet en limitlessSetSync.ts. Un conteo crudo por
    // CardSet (sin filtrar región) infla el número si alguna carta de otra
    // región quedó también enlazada a este Set, y da coberturas sin
    // sentido (>100%) al compararlo contra una fuente de una sola región.
    const countCardsForSet = async (setId: number, region: string | null) => {
      const regionWhere =
        region && region.trim()
          ? { region }
          : { OR: [{ region: null }, { region: "" }, { region: "US" }] };
      // Excluir la carta DON!! genérica del set (p.ej. "OP01-DON") —
      // nosotros la modelamos como un miembro más del set, pero
      // Limitless/los sitios oficiales no la cuentan entre las cartas
      // coleccionables del set, así que sin esto todo set queda ~100%+1.
      return prisma.card.count({
        where: {
          sets: { some: { setId } },
          ...regionWhere,
          category: { not: "DON" },
        },
      });
    };

    // Limitless combina "Normal" + "Winner" en una sola página/conteo
    // declarado, pero nosotros los modelamos como dos Sets separados
    // ("X" y "X Winner", estandarizado). Sumar ambos antes de comparar
    // evita falsos "50%" cuando el par ya está completo.
    const winnerSiblingIds = await Promise.all(
      setSources.map((s) =>
        s.set.title.endsWith(" Winner")
          ? Promise.resolve(null)
          : prisma.set
              .findFirst({
                where: { title: `${s.set.title} Winner` },
                select: { id: true },
              })
              .then((found) => found?.id ?? null)
      )
    );

    const ourCountBySetId = new Map<number, number>();
    await Promise.all(
      setSources.map(async (s, index) => {
        let count = await countCardsForSet(s.setId, s.set.region);
        const winnerId = winnerSiblingIds[index];
        if (winnerId) {
          count += await countCardsForSet(winnerId, s.set.region);
        }
        ourCountBySetId.set(s.setId, count);
      })
    );

    const sets = setSources.map((s) => {
      const ourCount = ourCountBySetId.get(s.setId) ?? 0;
      const declaredCount = s.declaredCount ?? 0;
      const coverage =
        declaredCount > 0
          ? Math.round((ourCount / declaredCount) * 100)
          : null;
      return {
        setId: s.setId,
        title: s.set.title,
        code: s.set.code,
        region: normalizeRegionLabel(s.set.region),
        source: s.source,
        sourceUrl: s.sourceUrl,
        declaredCount,
        ourCount,
        coverage,
        lastCheckedAt: s.lastCheckedAt,
      };
    });
    sets.sort((a, b) => (a.coverage ?? 100) - (b.coverage ?? 100));

    const openBase = { resolved: false, ignored: false };
    const gapsByRegion: Record<string, number> = {};
    await Promise.all(
      RECONCILE_REGIONS.map(async (region) => {
        gapsByRegion[region] = await prisma.catalogGap.count({
          where: { ...openBase, missingRegions: { has: region } },
        });
      })
    );

    const regions = RECONCILE_REGIONS.map((region) => ({
      region,
      cardCount: cardCountsByRegion[region] ?? 0,
      openGaps: gapsByRegion[region] ?? 0,
      hasDeclaredCountSource: REGIONS_WITH_DECLARED_COUNT.has(region),
    }));

    return NextResponse.json({ regions, sets });
  } catch (error: any) {
    console.error("Error en GET /api/admin/catalog-health:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
