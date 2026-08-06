export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LimitlessDecisionStatus, LimitlessReviewItemKind } from "@prisma/client";

/**
 * POST /api/admin/limitless/reviews/ignore-extra
 * Body: { slug: string; cardId: number; region?: string }
 *
 * Marca una carta "extra" (en tu set pero no en la membresía de Limitless) como
 * ACEPTADA/IGNORADA para ese set. Persiste la decisión en el review item (kind
 * EXTRA) para que el reconcile no la vuelva a listar (ej. un DON que tú sí tienes
 * en un set que Limitless no incluye).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = String(body?.slug ?? "").trim();
    const cardId = Number(body?.cardId);
    const region = String(body?.region ?? "US").trim() || "US";

    if (!slug || !Number.isFinite(cardId)) {
      return NextResponse.json(
        { error: "slug y cardId son requeridos" },
        { status: 400 }
      );
    }

    const review = await prisma.limitlessSetReview.findUnique({
      where: { slug_region: { slug, region } },
      select: { id: true },
    });
    if (!review) {
      return NextResponse.json(
        { error: "No existe un review para ese set; sincronízalo primero." },
        { status: 404 }
      );
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { code: true, name: true, tcgplayerProductId: true },
    });

    const existing = await prisma.limitlessSetReviewItem.findFirst({
      where: {
        reviewId: review.id,
        kind: LimitlessReviewItemKind.EXTRA,
        matchedCardId: cardId,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.limitlessSetReviewItem.update({
        where: { id: existing.id },
        data: { decisionStatus: LimitlessDecisionStatus.IGNORED },
      });
    } else {
      await prisma.limitlessSetReviewItem.create({
        data: {
          reviewId: review.id,
          kind: LimitlessReviewItemKind.EXTRA,
          decisionStatus: LimitlessDecisionStatus.IGNORED,
          code: card?.code ?? String(cardId),
          name: card?.name ?? null,
          matchedCardId: cardId,
          candidateCardIds: [cardId],
          productId: card?.tcgplayerProductId
            ? Number(card.tcgplayerProductId)
            : null,
        },
      });
    }

    // Recalcula el estado del review (queda REVIEWED si ya no hay pendientes).
    const pendingCount = await prisma.limitlessSetReviewItem.count({
      where: {
        reviewId: review.id,
        decisionStatus: LimitlessDecisionStatus.PENDING,
        kind: {
          in: [
            LimitlessReviewItemKind.MISSING,
            LimitlessReviewItemKind.WRONG_SET,
            LimitlessReviewItemKind.EXTRA,
          ],
        },
      },
    });
    await prisma.limitlessSetReview.update({
      where: { id: review.id },
      data: { status: pendingCount > 0 ? "PENDING" : "REVIEWED" },
    });

    return NextResponse.json({ ok: true, cardId });
  } catch (error: any) {
    console.error("[limitless/reviews/ignore-extra] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo ignorar la carta extra" },
      { status: 500 }
    );
  }
}
