export const dynamic = 'force-dynamic';

// Modified 2025-01-31 - Refactored to use centralized auth system
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

const prisma = new PrismaClient();

// GET - Obtener logs del usuario con filtros y paginación
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const deckId = searchParams.get("deckId");
    const opponentLeaderId = searchParams.get("opponentLeaderId");
    const result = searchParams.get("result"); // "win" | "loss"
    const playerOrder = searchParams.get("playerOrder"); // "first" | "second"

    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {
      userId: user.id,
    };

    if (deckId) where.deckId = parseInt(deckId);
    if (opponentLeaderId) where.opponentLeaderId = parseInt(opponentLeaderId);
    if (result) where.isWin = result === "win";
    if (playerOrder) where.wentFirst = playerOrder === "first";

    // Obtener logs con paginación
    const logs = await prisma.gameLog.findMany({
      where,
      include: {
        deck: {
          include: {
            deckCards: {
              include: {
                card: {
                  include: {
                    colors: true,
                  },
                },
              },
            },
          },
        },
        opponentLeader: {
          include: {
            colors: true,
          },
        },
        finalHandCards: {
          include: {
            card: true,
          },
        },
      },
      orderBy: {
        playedAt: "desc",
      },
      skip,
      take: limit,
    });

    const totalLogs = await prisma.gameLog.count({ where });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST - Crear nuevo log de partida
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const {
      deckId,
      opponentLeaderId,
      isWin,
      wentFirst,
      opponentName,
      comments,
      playedAt,
      finalHand, // Array opcional de cardIds
    } = body;

    // Validaciones básicas
    if (
      !deckId ||
      !opponentLeaderId ||
      typeof isWin !== "boolean" ||
      typeof wentFirst !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validar mano final si se proporciona
    if (finalHand && (!Array.isArray(finalHand) || finalHand.length > 5)) {
      return NextResponse.json(
        { error: "Final hand must be an array with maximum 5 cards" },
        { status: 400 }
      );
    }

    // Verificar que el deck pertenece al usuario
    const deck = await prisma.deck.findFirst({
      where: {
        id: deckId,
        userId: user.id,
      },
    });

    if (!deck) {
      return NextResponse.json(
        { error: "Deck not found or not owned by user" },
        { status: 404 }
      );
    }

    // Verificar que el líder oponente existe
    const opponentLeader = await prisma.card.findUnique({
      where: { id: opponentLeaderId },
    });

    if (!opponentLeader) {
      return NextResponse.json(
        { error: "Opponent leader not found" },
        { status: 404 }
      );
    }

    // Crear el log de partida en una transacción
    const gameLog = await prisma.$transaction(async (tx) => {
      // Crear el log principal
      const log = await tx.gameLog.create({
        data: {
          userId: user.id,
          deckId,
          opponentLeaderId,
          isWin,
          wentFirst,
          opponentName: opponentName || null,
          comments: comments || null,
          playedAt: playedAt ? new Date(playedAt) : new Date(),
        },
      });

      // Crear registros para las cartas de la mano final (solo si se proporcionan)
      if (finalHand && finalHand.length > 0) {
        await tx.gameLogCard.createMany({
          data: finalHand.map((cardId: number) => ({
            gameLogId: log.id,
            cardId,
          })),
        });
      }

      return log;
    });

    // Obtener el log completo con todas las relaciones
    const completeLog = await prisma.gameLog.findUnique({
      where: { id: gameLog.id },
      include: {
        deck: {
          include: {
            deckCards: {
              include: {
                card: {
                  include: {
                    colors: true,
                  },
                },
              },
            },
          },
        },
        opponentLeader: {
          include: {
            colors: true,
          },
        },
        finalHandCards: {
          include: {
            card: true,
          },
        },
      },
    });

    return NextResponse.json(completeLog, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
