export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RECONCILE_REGIONS } from "@/lib/services/catalogReconcile";
import { getTcgCatalogHealth } from "@/lib/services/tcgCatalogHealth";

/**
 * GET /api/admin/catalog-gaps
 *
 * Lista paginada + estadísticas de los huecos de cobertura (CatalogGap).
 *
 * Query params:
 *   kind          MISSING_ALL | REGION_PARITY | all   (default all)
 *   status        open | resolved | ignored | all      (default open)
 *   missingRegion US|JP|CN|KR|FR                        (filtra por región faltante)
 *   setCode       OP15 | ST31 | P …
 *   search        texto en code o name
 *   page, pageSize
 *   sort          code | set | missingCount            (default set)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind") ?? "all";
    const status = sp.get("status") ?? "open";
    const missingRegion = sp.get("missingRegion") ?? "";
    const setCode = sp.get("setCode") ?? "";
    const source = sp.get("source") ?? "";
    const newUs = sp.get("newUs") === "1";
    const search = (sp.get("search") ?? "").trim();
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? "50") || 50));
    const sort = sp.get("sort") ?? "set";

    const where: any = {};
    if (kind === "MISSING_ALL" || kind === "REGION_PARITY") where.kind = kind;
    if (status === "open") {
      where.resolved = false;
      where.ignored = false;
    } else if (status === "resolved") where.resolved = true;
    else if (status === "ignored") where.ignored = true;
    if (missingRegion) where.missingRegions = { has: missingRegion };
    if (setCode) where.setCode = setCode;
    if (source === "tcgplayer" || source === "dotgg") where.source = source;
    // "Nuevas US": cartas del mercado US (TCGplayer) que nos faltan en US.
    if (newUs) {
      where.source = "tcgplayer";
      where.missingRegions = { has: "US" };
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy =
      sort === "code"
        ? [{ code: "asc" as const }]
        : [{ setCode: "asc" as const }, { code: "asc" as const }];

    const [rows, total, health] = await Promise.all([
      prisma.catalogGap.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.catalogGap.count({ where }),
      getTcgCatalogHealth(),
    ]);

    // ---- Estadísticas globales (independientes de los filtros) ----
    const openBase = { resolved: false, ignored: false };
    const [missingAll, regionParity, resolvedCount, ignoredCount, totalOpen] =
      await Promise.all([
        prisma.catalogGap.count({ where: { ...openBase, kind: "MISSING_ALL" } }),
        prisma.catalogGap.count({ where: { ...openBase, kind: "REGION_PARITY" } }),
        prisma.catalogGap.count({ where: { resolved: true } }),
        prisma.catalogGap.count({ where: { ignored: true } }),
        prisma.catalogGap.count({ where: openBase }),
      ]);

    // Prioridad: cartas nuevas del mercado US (TCGplayer) que faltan en US.
    const newUsMissing = await prisma.catalogGap.count({
      where: { ...openBase, source: "tcgplayer", missingRegions: { has: "US" } },
    });

    // Faltantes por región (entre gaps abiertos).
    const byRegion: Record<string, number> = {};
    await Promise.all(
      RECONCILE_REGIONS.map(async (r) => {
        byRegion[r] = await prisma.catalogGap.count({
          where: { ...openBase, missingRegions: { has: r } },
        });
      })
    );

    // Top sets con más huecos abiertos.
    const bySetRaw = await prisma.catalogGap.groupBy({
      by: ["setCode"],
      where: openBase,
      _count: { _all: true },
    });
    const bySet = bySetRaw
      .map((r) => ({ setCode: r.setCode ?? "?", count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const lastRun = await prisma.catalogGap.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    });

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      stats: {
        totalOpen,
        missingAll,
        regionParity,
        newUsMissing,
        resolved: resolvedCount,
        ignored: ignoredCount,
        byRegion,
        bySet,
        lastRun: lastRun?.lastSeenAt ?? null,
        regions: RECONCILE_REGIONS,
        health,
      },
    });
  } catch (error: any) {
    console.error("[catalog-gaps] GET failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load catalog gaps" },
      { status: 500 }
    );
  }
}
