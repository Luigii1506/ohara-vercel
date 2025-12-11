export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missingCardId = parseInt(params.id);
    const body = await req.json();
    const { cardId } = body;

    if (!cardId) {
      return NextResponse.json(
        { error: "cardId is required" },
        { status: 400 }
      );
    }

    // Verificar que la carta existe
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        sets: {
          include: {
            set: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Obtener todos los EventMissingCard para este MissingCard
    const missingCardLinks = await prisma.eventMissingCard.findMany({
      where: { missingCardId },
      include: {
        event: true,
        missingCard: true,
      },
    });

    if (missingCardLinks.length === 0) {
      return NextResponse.json(
        { error: "No event links found for this missing card" },
        { status: 404 }
      );
    }

    const missingCardData = missingCardLinks[0].missingCard;
    console.log(`🔄 Processing approval for: ${missingCardData?.code} - ${missingCardData?.title}`);
    console.log(`📋 Creating EventCards for ${missingCardLinks.length} event(s)`);

    // Crear EventCard para cada evento
    const createdEventCards = [];
    for (const link of missingCardLinks) {
      // Verificar si ya existe un EventCard para evitar duplicados
      const existingEventCard = await prisma.eventCard.findFirst({
        where: {
          eventId: link.eventId,
          cardId: cardId,
        },
      });

      if (!existingEventCard) {
        const eventCard = await prisma.eventCard.create({
          data: {
            eventId: link.eventId,
            cardId: cardId,
          },
        });
        createdEventCards.push(eventCard);
        console.log(`✅ EventCard created for event ${link.eventId}`);
      } else {
        console.log(`⚠️ EventCard already exists for event ${link.eventId}, skipping`);
      }
    }

    // Eliminar todos los EventMissingCard para este MissingCard
    await prisma.eventMissingCard.deleteMany({
      where: { missingCardId },
    });

    console.log(`✅ All EventMissingCard entries deleted`);

    // Eliminar el MissingCard
    await prisma.missingCard.delete({
      where: { id: missingCardId },
    });

    console.log(`✅ MissingCard deleted completely`);

    return NextResponse.json({
      success: true,
      cardId: card.id,
      cardCode: card.code,
      eventsProcessed: missingCardLinks.length,
      eventCardsCreated: createdEventCards.length,
      eventIds: missingCardLinks.map((link) => link.eventId),
    });
  } catch (error) {
    console.error("❌ Approval error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Approval failed",
      },
      { status: 500 }
    );
  }
}
