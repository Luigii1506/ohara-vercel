export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  classifyEventAlternate,
  cleanEventTitleForSet,
  normalizeDashes,
} from "@/lib/services/events/eventAltArt";

/**
 * GET /api/admin/catalog-gaps/us-alternates/event-suggestions?missingCardId=X
 *
 * Da el contexto para armar el picker de set + arte alterno del modal, ANTES
 * de crear la carta: qué variante detectamos, qué SET recomendamos (el pack
 * real, ej. "CS 26-27 Event Pack" — no el título completo del evento, que
 * mezcla packs distintos bajo un solo nombre genérico), si ese set ya existe,
 * y cuántas otras cartas pendientes son del MISMO pack (para que el operador
 * sepa que puede reusar el mismo set en varias de un tirón).
 */

/** Títulos que el detector deja cuando NO encontró un nombre de pack real —
 * no sirven como nombre de set, hay que pedirle al operador que elija uno. */
const isGenericPackTitle = (title: string, code: string): boolean => {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (t === "featured card list") return true;
  if (t === code.toLowerCase()) return true;
  return false;
};

export async function GET(req: NextRequest) {
  try {
    const mcId = Number(req.nextUrl.searchParams.get("missingCardId"));
    if (!Number.isFinite(mcId)) {
      return NextResponse.json({ error: "missingCardId inválido" }, { status: 400 });
    }

    const mc = await prisma.missingCard.findUnique({
      where: { id: mcId },
      include: {
        events: { include: { event: { select: { id: true, title: true, startDate: true } } } },
      },
    });
    if (!mc) {
      return NextResponse.json({ error: "Carta de evento no encontrada" }, { status: 404 });
    }

    const code = (mc.code ?? "").toUpperCase();
    const events = mc.events
      .map((e) => e.event)
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .sort((a, b) => {
        const ta = a.startDate ? a.startDate.getTime() : 0;
        const tb = b.startDate ? b.startDate.getTime() : 0;
        return tb - ta || b.id - a.id;
      });
    const primaryEvent = events[0] ?? null;
    const eventTitle = primaryEvent?.title ?? "";

    const suggestedAlternateArt = classifyEventAlternate(mc.title, eventTitle, mc.imageUrl);

    // El pack real (mc.title) es la mejor recomendación de set — pero solo si
    // no es un título genérico de respaldo ("Featured Card List").
    const packTitle = isGenericPackTitle(mc.title, code) ? null : mc.title.trim();
    const fallbackTitle = cleanEventTitleForSet(eventTitle);
    const suggestedSetTitle = packTitle || fallbackTitle;

    // Ignora el tipo de guion al comparar ("26-27" vs "26–27" vs "26ｰ27") —
    // si no, el mismo pack real aparece como "no existe" y se duplica el set.
    const target = normalizeDashes(suggestedSetTitle).toLowerCase();
    const setCandidates = await prisma.set.findMany({ select: { id: true, title: true } });
    const existingSet =
      setCandidates.find((s) => normalizeDashes(s.title).toLowerCase() === target) ?? null;

    // Otras cartas del MISMO pack (mismo título exacto) todavía sin revisar —
    // para que el operador sepa que puede reusar este mismo set en varias.
    const siblingCount = packTitle
      ? await prisma.missingCard.count({
          where: {
            id: { not: mcId },
            isApproved: false,
            title: { equals: mc.title, mode: "insensitive" },
          },
        })
      : 0;

    return NextResponse.json({
      code,
      cardTitle: mc.title,
      eventTitle,
      suggestedAlternateArt,
      suggestedSetTitle,
      isGenericPack: !packTitle,
      existingSetId: existingSet?.id ?? null,
      existingSetTitle: existingSet?.title ?? null,
      siblingCount,
    });
  } catch (error: any) {
    console.error("[event-suggestions] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo calcular la sugerencia" },
      { status: 500 }
    );
  }
}
