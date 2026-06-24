import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { scrapeAmazonProduct } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 120;

// Detecta un src ya corregido por este flujo: contiene -V<13 dígitos>
// (sirve tanto para el formato viejo CODE-V{ts}.webp como el nuevo
//  CODE-V{ts}-{id}.webp).
const VERSIONED_RE = /-V\d{13}/i;

// Región objetivo de la corrección (decisión: solo US). Se puede sobreescribir
// vía body.region si en el futuro se quiere JP/CN.
const DEFAULT_TARGET_REGION = "US";

const normAlt = (v?: string | null) =>
  v && v.trim() ? v.trim() : null;
const keyOf = (code: string, alt: string | null) =>
  `${code}::${(alt ?? "BASE").toLowerCase()}`;

/**
 * Planifica la corrección de imágenes de un set (solo una región, base + alternas).
 * Scrapea Limitless y empareja por (code + alternateArt) con las cartas
 * existentes de esa región dentro del set. NO escribe ni sube nada.
 *
 * Body: { url: string, setId: number, region?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { url, setId, region } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta 'url'" }, { status: 400 });
    }
    if (!setId || Number.isNaN(Number(setId))) {
      return NextResponse.json({ error: "Falta 'setId'" }, { status: 400 });
    }
    const targetRegion =
      typeof region === "string" && region.trim()
        ? region.trim()
        : DEFAULT_TARGET_REGION;

    const set = await prisma.set.findUnique({
      where: { id: Number(setId) },
      select: { id: true, code: true, region: true, title: true },
    });
    if (!set) {
      return NextResponse.json({ error: "Set no encontrado" }, { status: 404 });
    }

    const scraped = await scrapeAmazonProduct(url, set.code ?? "");
    if (!scraped || scraped.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron cartas en la URL" },
        { status: 422 }
      );
    }

    // Scrapeadas: base Y alternas, indexadas por code+alternateArt.
    const scrapedByKey = new Map<
      string,
      { code: string; alternateArt: string | null; src: string }
    >();
    for (const card of scraped) {
      const code = (card._id || card.code || "").trim();
      if (!code || !card.src) continue;
      const alt = normAlt(card.alternateArt);
      const key = keyOf(code, alt);
      if (!scrapedByKey.has(key)) {
        scrapedByKey.set(key, { code, alternateArt: alt, src: card.src });
      }
    }

    // Existentes de la región objetivo dentro del set (base + alternas).
    const existing = await prisma.card.findMany({
      where: { region: targetRegion, sets: { some: { setId: set.id } } },
      select: { id: true, code: true, src: true, alternateArt: true },
    });
    const existingByKey = new Map<
      string,
      { id: number; code: string; src: string | null; alternateArt: string | null }
    >();
    for (const c of existing) {
      const key = keyOf(c.code, normAlt(c.alternateArt));
      if (!existingByKey.has(key)) existingByKey.set(key, c);
    }

    const items: {
      code: string;
      alternateArt: string | null;
      cardId: number;
      limitlessSrc: string;
      currentSrc: string | null;
      alreadyVersioned: boolean;
    }[] = [];
    const noMatch: string[] = [];

    for (const [key, s] of Array.from(scrapedByKey.entries())) {
      const dbCard = existingByKey.get(key);
      if (!dbCard) {
        noMatch.push(s.alternateArt ? `${s.code} (${s.alternateArt})` : s.code);
        continue;
      }
      items.push({
        code: s.code,
        alternateArt: s.alternateArt,
        cardId: dbCard.id,
        limitlessSrc: s.src,
        currentSrc: dbCard.src,
        alreadyVersioned: VERSIONED_RE.test(dbCard.src || ""),
      });
    }

    items.sort(
      (a, b) =>
        a.code.localeCompare(b.code) ||
        (a.alternateArt ?? "").localeCompare(b.alternateArt ?? "")
    );

    return NextResponse.json({
      set: { id: set.id, title: set.title, code: set.code },
      region: targetRegion,
      scrapedCount: scrapedByKey.size,
      existingCount: existing.length,
      alreadyVersioned: items.filter((i) => i.alreadyVersioned).length,
      noMatch,
      items,
    });
  } catch (error) {
    console.error("❌ fix-set-images/plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado" },
      { status: 500 }
    );
  }
}
