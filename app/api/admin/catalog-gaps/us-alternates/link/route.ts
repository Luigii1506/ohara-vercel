export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/catalog-gaps/us-alternates/link
 * Body: { origin: "tcgplayer" | "events", productId?, missingCardId?, cardId }
 *
 * "Ya la tengo, ES ESTA": linkea el candidato a una carta que ya tengo, en vez
 * de crear una nueva.
 *  - tcgplayer → deja la carta linkeada al producto (Card.tcgplayerProductId +
 *    TcgCatalogProduct.linkedCardId), y sale del listado de faltantes.
 *  - events → marca el MissingCard como aprobado (ya cubierto por esa carta).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = String(body.origin ?? "");
    const cardId = Number(body.cardId);
    if (!Number.isFinite(cardId)) {
      return NextResponse.json({ error: "cardId inválido" }, { status: 400 });
    }
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, code: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Carta no encontrada" }, { status: 404 });
    }

    if (origin === "events") {
      const mcId = Number(body.missingCardId);
      if (!Number.isFinite(mcId)) {
        return NextResponse.json({ error: "missingCardId inválido" }, { status: 400 });
      }
      await prisma.missingCard.update({
        where: { id: mcId },
        data: { isApproved: true },
      });
      return NextResponse.json({ ok: true, linkedTo: cardId, mode: "event-approved" });
    }

    // origin tcgplayer
    const pid = Number(body.productId);
    if (!Number.isFinite(pid)) {
      return NextResponse.json({ error: "productId inválido" }, { status: 400 });
    }

    // Si otra carta ya tiene ese productId (unique), lo liberamos primero.
    const holder = await prisma.card.findFirst({
      where: { tcgplayerProductId: String(pid), NOT: { id: cardId } },
      select: { id: true },
    });
    if (holder) {
      await prisma.card.update({
        where: { id: holder.id },
        data: { tcgplayerProductId: null, tcgplayerLinkStatus: null },
      });
    }

    await prisma.card.update({
      where: { id: cardId },
      data: { tcgplayerProductId: String(pid), tcgplayerLinkStatus: true },
    });
    await prisma.tcgCatalogProduct.update({
      where: { productId: pid },
      data: { linkedCardId: cardId, linkedAt: new Date() },
    });

    return NextResponse.json({ ok: true, linkedTo: cardId, mode: "tcg-linked" });
  } catch (error: any) {
    console.error("[us-alternates/link] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo linkear" },
      { status: 500 }
    );
  }
}
