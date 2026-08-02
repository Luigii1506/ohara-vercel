export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  classifyAlternateArt,
  splitDisclaimer,
} from "@/lib/services/tcgplayerCardData";

/**
 * GET /api/admin/catalog-audit
 *
 * Audita el alternateArt de nuestras cartas alternas US linkeadas a TCGplayer
 * comparando contra la clasificación de TCGplayer. Categoriza por confianza:
 *
 *   adopt    — tú vacío/genérico, TCGplayer específico → fix seguro
 *   conflict — ambos con valor específico, distinto     → revisar a mano
 *   (keep)   — tú más específico, TCGplayer genérico     → no se muestra
 *
 * Query: category (adopt|conflict|all), setCode, targetAlt, search, page, pageSize
 */

// Valores "genéricos" (poco específicos) del alternateArt.
const GENERIC = new Set(["", "alternate art", "full art", "parallel", "manga art"]);

type Finding = {
  cardId: number;
  code: string;
  ourAlt: string;
  tcgAlt: string;
  tcgName: string;
  disclaimer: string | null;
  category: "adopt" | "conflict";
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const category = sp.get("category") ?? "adopt";
    const setCode = sp.get("setCode") ?? "";
    const targetAlt = sp.get("targetAlt") ?? "";
    const search = (sp.get("search") ?? "").trim().toUpperCase();
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? "60") || 60));

    // Cartas alternas US linkeadas a TCGplayer.
    const cards = await prisma.card.findMany({
      where: {
        tcgplayerProductId: { not: null },
        isFirstEdition: false,
        OR: [{ region: "US" }, { region: null }],
      },
      select: { id: true, code: true, alternateArt: true, tcgplayerProductId: true },
    });

    const pids = cards
      .map((c) => Number(c.tcgplayerProductId))
      .filter((n) => Number.isFinite(n));

    // Producto TCGplayer: name + Description (extraído del jsonb, sin cargar todo).
    const prodRows: { productId: number; name: string; description: string | null }[] =
      pids.length
        ? await prisma.$queryRawUnsafe(
            `SELECT "productId", name,
               (SELECT e->>'value' FROM jsonb_array_elements(metadata->'extendedData') e
                WHERE e->>'name' = 'Description' LIMIT 1) AS description
             FROM "TcgCatalogProduct" WHERE "productId" IN (${pids.join(",")})`
          )
        : [];
    const pm = new Map(prodRows.map((p) => [p.productId, p]));

    const findings: Finding[] = [];
    const stats = { adopt: 0, conflict: 0, keep: 0 };
    const byTarget = new Map<string, number>();

    for (const c of cards) {
      const p = pm.get(Number(c.tcgplayerProductId));
      if (!p) continue;
      const { disclaimer } = splitDisclaimer(p.description);
      const tcgAlt = classifyAlternateArt(p.name, disclaimer);
      const our = (c.alternateArt ?? "").trim();
      if (our.toLowerCase() === tcgAlt.toLowerCase()) continue;

      const ourGen = GENERIC.has(our.toLowerCase());
      const tcgGen = GENERIC.has(tcgAlt.toLowerCase());

      let cat: "adopt" | "conflict" | "keep";
      if (ourGen && !tcgGen) cat = "adopt";
      else if (ourGen && tcgGen) cat = our === "" ? "adopt" : "conflict";
      else if (!ourGen && tcgGen) cat = "keep";
      else cat = "conflict";

      stats[cat] += 1;
      if (cat === "keep") continue;
      byTarget.set(tcgAlt, (byTarget.get(tcgAlt) ?? 0) + 1);
      findings.push({
        cardId: c.id,
        code: c.code,
        ourAlt: our || "(vacío)",
        tcgAlt,
        tcgName: p.name,
        disclaimer,
        category: cat,
      });
    }

    // Filtros UI.
    let filtered = findings;
    if (category === "adopt" || category === "conflict")
      filtered = filtered.filter((f) => f.category === category);
    if (setCode)
      filtered = filtered.filter((f) => f.code.toUpperCase().startsWith(setCode.toUpperCase()));
    if (targetAlt) filtered = filtered.filter((f) => f.tcgAlt === targetAlt);
    if (search)
      filtered = filtered.filter(
        (f) => f.code.includes(search) || f.tcgName.toUpperCase().includes(search)
      );

    filtered.sort((a, b) => a.code.localeCompare(b.code));
    const total = filtered.length;
    const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

    const byTargetAlt = Array.from(byTarget.entries())
      .map(([alt, count]) => ({ alt, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      stats: { ...stats, linkedCards: cards.length, byTargetAlt },
    });
  } catch (error: any) {
    console.error("[catalog-audit] GET failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Audit failed" },
      { status: 500 }
    );
  }
}
