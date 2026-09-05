export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/events/verify?id=123
 * GET /api/admin/events/verify?url=https://en.onepiece-cardgame.com/events/...
 *
 * Vista de solo-lectura para AUDITAR un evento: todo lo que tenemos
 * registrado (confirmado Y pendiente) con imágenes, para comparar visualmente
 * contra la página real del sitio oficial — a diferencia de /admin/events/[id]
 * (que es el editor: solo texto, solo confirmado, para linkear/desvincular).
 */

/** Normaliza una URL para comparar sin que un "/" final o el protocolo la hagan fallar. */
const normalizeUrl = (url: string): string =>
  url.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();

export async function GET(req: NextRequest) {
  try {
    const idParam = req.nextUrl.searchParams.get("id");
    const urlParam = req.nextUrl.searchParams.get("url");

    let eventId: number | null = null;

    if (idParam && Number.isFinite(Number(idParam))) {
      eventId = Number(idParam);
    } else if (urlParam) {
      const target = normalizeUrl(urlParam);
      // sourceUrl no siempre coincide byte-a-byte (protocolo, "/" final) — se
      // trae todo lo que "contenga" el path y se compara normalizado en JS,
      // en vez de confiar en un exact-match que casi nunca da.
      const pathFragment = target.split("/").slice(1).join("/").split("?")[0];
      const candidates = await prisma.event.findMany({
        where: pathFragment
          ? { sourceUrl: { contains: pathFragment, mode: "insensitive" } }
          : { sourceUrl: { not: null } },
        select: { id: true, sourceUrl: true },
      });
      const match = candidates.find(
        (c) => c.sourceUrl && normalizeUrl(c.sourceUrl) === target
      );
      eventId = match?.id ?? candidates[0]?.id ?? null;
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "No encontré ningún evento con ese id/URL" },
        { status: 404 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        cards: {
          include: {
            card: {
              select: {
                id: true,
                name: true,
                code: true,
                src: true,
                alternateArt: true,
                rarity: true,
                region: true,
                sets: { select: { setId: true } },
              },
            },
          },
        },
        sets: {
          include: {
            set: {
              select: { id: true, title: true, code: true, image: true },
            },
          },
        },
        missingSets: {
          orderBy: { createdAt: "desc" },
          include: { missingSet: true },
        },
        missingCards: {
          orderBy: { createdAt: "desc" },
          include: { missingCard: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      id: event.id,
      slug: event.slug,
      title: event.title,
      sourceUrl: event.sourceUrl,
      imageUrl: event.imageUrl,
      eventThumbnail: event.eventThumbnail,
      region: event.region,
      status: event.status,
      eventType: event.eventType,
      category: event.category,
      startDate: event.startDate,
      location: event.location,
      isApproved: event.isApproved,
      cards: event.cards
        .filter((entry) => entry.card)
        .map((entry) => ({
          id: entry.card!.id,
          code: entry.card!.code,
          name: entry.card!.name,
          src: entry.card!.src,
          alternateArt: entry.card!.alternateArt,
          rarity: entry.card!.rarity,
          region: entry.card!.region,
          setIds: entry.card!.sets.map((s) => s.setId),
        })),
      sets: event.sets
        .filter((entry) => entry.set)
        .map((entry) => ({
          id: entry.set!.id,
          title: entry.set!.title,
          code: entry.set!.code,
          image: entry.set!.image,
        })),
      missingSets: event.missingSets
        .filter((entry) => entry.missingSet)
        .map((entry) => ({
          id: entry.missingSet!.id,
          title: entry.missingSet!.title,
          translatedTitle: entry.missingSet!.translatedTitle,
          images: Array.isArray(entry.missingSet!.imagesJson)
            ? (entry.missingSet!.imagesJson as string[])
            : [],
          isApproved: entry.missingSet!.isApproved,
        })),
      missingCards: event.missingCards
        .filter((entry) => entry.missingCard)
        .map((entry) => ({
          id: entry.missingCard!.id,
          code: entry.missingCard!.code,
          title: entry.missingCard!.title,
          imageUrl: entry.missingCard!.imageUrl,
          canonicalKey: entry.missingCard!.canonicalKey,
          isApproved: entry.missingCard!.isApproved,
        })),
    });
  } catch (error: any) {
    console.error("[events/verify] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo cargar el evento" },
      { status: 500 }
    );
  }
}
