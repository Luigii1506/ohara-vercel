export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDotggPrintings } from "@/lib/services/dotggCatalog";

/**
 * GET /api/admin/catalog-gaps/us-alternates
 *
 * Detecta ALTERNAS US faltantes: impresiones que TCGplayer tiene para un
 * código que ya tenemos en US, pero que no están linkeadas a ninguna carta
 * nuestra → candidatas a alt-arts que nos faltan.
 *
 * Señal principal: por código, tcgTotal (impresiones en TCGplayer) vs ourCount
 * (nuestras cartas US). Si tcgTotal > ourCount, faltan alt-arts.
 *
 * Query: setCode, rarity, search, onlyMissing (1), page, pageSize
 */
function setOf(code: string): string {
  const m = code.match(/^([A-Za-z]+\d+|[A-Za-z]+)(?=-|\d)/);
  if (m) return m[1].toUpperCase();
  const dash = code.indexOf("-");
  return (dash > 0 ? code.slice(0, dash) : code).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const setCode = sp.get("setCode") ?? "";
    const rarity = sp.get("rarity") ?? "";
    const search = (sp.get("search") ?? "").trim().toUpperCase();
    const onlyMissing = sp.get("onlyMissing") === "1";
    const onlyCorroborated = sp.get("corroborated") === "1";
    const sourceFilter = sp.get("source") ?? ""; // tcgplayer | dotgg | events
    const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
    const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? "60") || 60));

    // 1) Nuestras cartas US por código (base + alternas). null = US.
    const ourRows = await prisma.card.groupBy({
      by: ["code"],
      where: { OR: [{ region: "US" }, { region: null }] },
      _count: { _all: true },
    });
    const ourCount = new Map<string, number>();
    for (const r of ourRows) if (r.code) ourCount.set(r.code.toUpperCase(), r._count._all);

    // 2) Total de impresiones TCGplayer por código (cartas, no selladas).
    const tcgTotals = await prisma.tcgCatalogProduct.groupBy({
      by: ["number"],
      where: { isSealed: false, productStatus: "active", number: { not: null } },
      _count: { _all: true },
    });
    const tcgTotal = new Map<string, number>();
    for (const r of tcgTotals) if (r.number) tcgTotal.set(r.number, r._count._all);

    // 2b) Impresiones que conoce DotGG por código (base + variantes _P1/_R1).
    let dotgg = new Map<string, { total: number }>();
    try {
      dotgg = await getDotggPrintings();
    } catch (e) {
      console.warn("[us-alternates] DotGG no disponible:", (e as Error).message);
    }

    // 3) Productos TCGplayer SIN linkear cuyo código lo tenemos en US → candidatos.
    const unlinked = await prisma.tcgCatalogProduct.findMany({
      where: {
        isSealed: false,
        productStatus: "active",
        linkedCardId: null,
        number: { not: null },
      },
      select: {
        productId: true,
        number: true,
        name: true,
        rarity: true,
        cardType: true,
        imageUrl: true,
        url: true,
      },
    });

    // 2c) Cartas detectadas en EVENTOS (prize/winner/judge/serial que no se
    // venden) cuyo código lo tenemos en US → alt-arts que ninguna otra fuente da.
    const eventCards = await prisma.missingCard.findMany({
      where: { isApproved: false },
      select: { id: true, code: true, title: true, imageUrl: true },
    });
    const eventByCode = new Map<string, typeof eventCards>();
    for (const m of eventCards) {
      const code = (m.code ?? "").toUpperCase();
      if (!ourCount.has(code)) continue;
      const arr = eventByCode.get(code) ?? [];
      arr.push(m);
      eventByCode.set(code, arr);
    }

    // Fuentes que reportan más impresiones/versiones de las que tenemos, por código.
    const sourcesFor = (code: string, our: number): string[] => {
      const s: string[] = [];
      if ((tcgTotal.get(code) ?? 0) > our) s.push("tcgplayer");
      if ((dotgg.get(code)?.total ?? 0) > our) s.push("dotgg");
      if (eventByCode.has(code)) s.push("events");
      return s;
    };

    let candidates = unlinked
      .filter((p) => p.number && ourCount.has(p.number)) // código que sí tenemos
      .map((p) => {
        const code = p.number!;
        const our = ourCount.get(code) ?? 0;
        const total = tcgTotal.get(code) ?? 0;
        const dotggT = dotgg.get(code)?.total ?? 0;
        const expected = Math.max(total, dotggT);
        const sources = sourcesFor(code, our);
        return {
          productId: p.productId,
          origin: "tcgplayer" as string,
          code,
          setCode: setOf(code),
          name: p.name,
          rarity: p.rarity,
          cardType: p.cardType,
          imageUrl: p.imageUrl,
          url: p.url,
          ourCount: our,
          tcgTotal: total,
          dotggTotal: dotggT,
          expected,
          sources,
          likelyMissing: expected > our || eventByCode.has(code),
        };
      });

    // Añadir las de eventos como filas propias (prize/alt-arts no vendidas).
    for (const [code, cards] of Array.from(eventByCode.entries())) {
      const our = ourCount.get(code) ?? 0;
      for (const m of cards) {
        candidates.push({
          productId: -m.id, // sintético para el key de React
          origin: "events",
          code,
          setCode: setOf(code),
          name: m.title ?? code,
          rarity: null,
          cardType: null,
          imageUrl: m.imageUrl || null,
          url: null,
          ourCount: our,
          tcgTotal: tcgTotal.get(code) ?? 0,
          dotggTotal: dotgg.get(code)?.total ?? 0,
          expected: Math.max(tcgTotal.get(code) ?? 0, dotgg.get(code)?.total ?? 0),
          sources: sourcesFor(code, our),
          likelyMissing: true,
        });
      }
    }

    // Stats (antes de filtros de UI).
    const totalCandidates = candidates.length;
    const likelyMissing = candidates.filter((c) => c.likelyMissing).length;
    const corroborated = candidates.filter((c) => c.sources.length >= 2).length;
    const fromEvents = candidates.filter((c) => c.origin === "events").length;
    const codesAffected = new Set(candidates.map((c) => c.code)).size;
    const bySetMap = new Map<string, number>();
    const byRarityMap = new Map<string, number>();
    for (const c of candidates) {
      if (c.likelyMissing) {
        bySetMap.set(c.setCode, (bySetMap.get(c.setCode) ?? 0) + 1);
        const rk = c.rarity ?? "?";
        byRarityMap.set(rk, (byRarityMap.get(rk) ?? 0) + 1);
      }
    }
    const bySet = Array.from(bySetMap.entries()).map(([setCode, count]) => ({ setCode, count })).sort((a, b) => b.count - a.count);
    const byRarity = Array.from(byRarityMap.entries()).map(([r, count]) => ({ rarity: r, count })).sort((a, b) => b.count - a.count);

    // Filtros de UI.
    if (onlyMissing) candidates = candidates.filter((c) => c.likelyMissing);
    if (onlyCorroborated) candidates = candidates.filter((c) => c.sources.length >= 2);
    if (sourceFilter) candidates = candidates.filter((c) => c.sources.includes(sourceFilter));
    if (setCode) candidates = candidates.filter((c) => c.setCode === setCode);
    if (rarity) candidates = candidates.filter((c) => (c.rarity ?? "?") === rarity);
    if (search) candidates = candidates.filter((c) => c.code.includes(search) || (c.name ?? "").toUpperCase().includes(search));

    // Orden: primero corroboradas (2+ fuentes), luego las que faltan, luego código.
    candidates.sort(
      (a, b) =>
        b.sources.length - a.sources.length ||
        Number(b.likelyMissing) - Number(a.likelyMissing) ||
        a.code.localeCompare(b.code)
    );

    const total = candidates.length;
    const rows = candidates.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      stats: { totalCandidates, likelyMissing, corroborated, fromEvents, codesAffected, bySet, byRarity },
    });
  } catch (error: any) {
    console.error("[us-alternates] GET failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load US alternates" },
      { status: 500 }
    );
  }
}
