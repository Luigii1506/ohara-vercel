export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadCardImageToR2 } from "@/lib/r2/uploadCardImage";
import {
  classifyEventAlternate,
  resolveEventCardSetId,
  cleanEventTitleForSet,
  normalizeDashes,
} from "@/lib/services/events/eventAltArt";

/**
 * POST /api/admin/catalog-gaps/us-alternates/create-from-event
 * Body: { missingCardId: number }
 *
 * Crea la ALTERNA de una carta de premio (evento) clonando la base US:
 *  - clasifica el tipo (Winner/Finalist/Top Player/Serial/Treasure Cup…) con el
 *    título de la carta + el del evento + el filename de la imagen;
 *  - resuelve el SET matcheando la variante contra los sets del evento (los
 *    packs de premio), o crea un set desde el título del evento;
 *  - sube la imagen del evento a R2;
 *  - deja la carta linkeada y marca el MissingCard como aprobado (sale del queue).
 */

/**
 * Encuentra (o crea) un set a partir de un título. Compara ignorando el tipo
 * de guion — el sitio oficial no es consistente entre hyphen normal, en-dash
 * y el signo de prolongación katakana halfwidth para años tipo "26-27"
 * (confirmado real: sin esto se creaban sets duplicados por esa sola
 * diferencia de caracter).
 */
async function findOrCreateEventSet(rawTitle: string | null): Promise<number> {
  const title = cleanEventTitleForSet(rawTitle);
  const target = normalizeDashes(title).toLowerCase();
  const candidates = await prisma.set.findMany({ select: { id: true, title: true } });
  const existing = candidates.find((s) => normalizeDashes(s.title).toLowerCase() === target);
  if (existing) return existing.id;
  const created = await prisma.set.create({
    data: { title, image: "", code: null, releaseDate: new Date(), isOpen: false },
    select: { id: true },
  });
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mcId = Number(body.missingCardId);
    if (!Number.isFinite(mcId)) {
      return NextResponse.json({ error: "missingCardId inválido" }, { status: 400 });
    }
    // Overrides del modal: el operador puede elegir un set existente, escribir
    // uno nuevo, o corregir el arte alterno detectado — en vez de confiar
    // ciegamente en la clasificación automática.
    const overrideSetId = Number(body.overrideSetId);
    const overrideSetTitle =
      typeof body.overrideSetTitle === "string" ? body.overrideSetTitle.trim() : "";
    const overrideAlternateArt =
      typeof body.overrideAlternateArt === "string" ? body.overrideAlternateArt.trim() : "";

    const mc = await prisma.missingCard.findUnique({
      where: { id: mcId },
      include: {
        events: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                sets: { select: { set: { select: { id: true, title: true } } } },
              },
            },
          },
        },
      },
    });
    if (!mc) {
      return NextResponse.json({ error: "Carta de evento no encontrada" }, { status: 404 });
    }

    const code = (mc.code ?? "").toUpperCase();
    if (!code || code === "DON!!") {
      return NextResponse.json(
        { error: "Esta carta (DON!! / sin código) aún no se puede crear automáticamente" },
        { status: 422 }
      );
    }

    // Base US para clonar (las cartas de evento se ofrecen solo si tenemos el código).
    const base = await prisma.card.findFirst({
      where: { code, isFirstEdition: true, OR: [{ region: "US" }, { region: null }] },
      include: { types: true, colors: true, effects: true, conditions: true, texts: true },
    });
    if (!base) {
      return NextResponse.json(
        { error: `No hay carta base US para ${code}; créala primero.` },
        { status: 422 }
      );
    }

    // La carta puede estar en varios eventos (ej. Japan Expo 2025 y 2026).
    // Preferimos el MÁS RECIENTE (por startDate; a falta de fecha, mayor id) para
    // el nombre del set, y buscamos un pack real en CUALQUIER evento.
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

    // 1) Variante (tipo de alterna) — el operador puede corregirla a mano.
    const variant = overrideAlternateArt || classifyEventAlternate(mc.title, eventTitle, mc.imageUrl);

    // 2) Set: si el operador ya eligió uno (existente o nombre nuevo), se usa
    // tal cual. Si no, la heurística automática: busca un pack real que
    // matchee la variante en cualquier evento; si no hay, usa un set
    // derivado del nombre del evento más reciente.
    let setId: number | null = null;
    if (Number.isFinite(overrideSetId) && overrideSetId > 0) {
      setId = overrideSetId;
    } else if (overrideSetTitle) {
      setId = await findOrCreateEventSet(overrideSetTitle);
    } else {
      for (const ev of events) {
        const evSets = ev.sets.map((es) => ({ id: es.set.id, title: es.set.title }));
        setId = resolveEventCardSetId(variant, evSets);
        if (setId) break;
      }
      if (!setId) setId = await findOrCreateEventSet(eventTitle);
    }

    // 3) Imagen del evento → R2 (nombre único para bustear el caché immutable).
    if (!mc.imageUrl) {
      return NextResponse.json(
        { error: "Esta carta de evento no tiene imagen para usar" },
        { status: 422 }
      );
    }
    const filename = `${code}-evt${mcId}-${Date.now().toString(36)}`;
    let r2Url: string;
    try {
      ({ r2Url } = await uploadCardImageToR2(mc.imageUrl, filename, true));
    } catch (e) {
      return NextResponse.json(
        { error: `No se pudo subir la imagen: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    // 4) Crea la alterna clonando la base.
    const card = await prisma.card.create({
      data: {
        name: base.name,
        code: base.code,
        setCode: base.setCode,
        src: r2Url,
        imageKey: null,
        cost: base.cost,
        power: base.power,
        attribute: base.attribute,
        counter: base.counter,
        category: base.category,
        life: base.life,
        rarity: base.rarity,
        illustrator: base.illustrator,
        alternateArt: variant,
        status: base.status,
        triggerCard: base.triggerCard,
        alias: base.alias,
        order: base.order,
        isFirstEdition: false,
        isPro: base.isPro,
        region: base.region ?? "US",
        baseCardId: base.id,
        types: base.types.length ? { create: base.types.map((t) => ({ type: t.type })) } : undefined,
        colors: base.colors.length ? { create: base.colors.map((c) => ({ color: c.color })) } : undefined,
        effects: base.effects.length ? { create: base.effects.map((e) => ({ effect: e.effect })) } : undefined,
        conditions: base.conditions.length ? { create: base.conditions.map((c) => ({ condition: c.condition })) } : undefined,
        texts: base.texts.length ? { create: base.texts.map((t) => ({ text: t.text })) } : undefined,
        sets: { create: { setId } },
        // Vincula la carta a TODOS los eventos donde apareció esta carta de
        // premio (puede repetirse en más de uno) — sin esto, "aprobar" la
        // sacaba de la cola pero nunca quedaba como "carta confirmada" del
        // evento (ej. en /admin/events/verify se veía "0 cartas confirmadas"
        // aunque ya estuviera resuelta).
        eventCards: { create: events.map((ev) => ({ eventId: ev.id })) },
      },
      select: { id: true },
    });

    // 5) Saca el MissingCard del queue (aprobado) para que no se re-ofrezca.
    await prisma.missingCard.update({
      where: { id: mcId },
      data: { isApproved: true },
    });

    const set = await prisma.set.findUnique({
      where: { id: setId },
      select: { title: true },
    });

    return NextResponse.json({
      cardId: card.id,
      mode: "event-alternate",
      alternateArt: variant,
      setId,
      setTitle: set?.title ?? null,
      matchedEventSet: events.some((ev) =>
        ev.sets.some((es) => es.set.id === setId)
      ),
    });
  } catch (error: any) {
    console.error("[create-from-event] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear la alterna del evento" },
      { status: 500 }
    );
  }
}
