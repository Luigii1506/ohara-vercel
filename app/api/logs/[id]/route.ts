export const dynamic = 'force-dynamic';

// Modified 2025-01-31 - Refactored to use centralized auth system
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// GET - Obtener un log específico por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const logId = parseInt(params.id);

    if (isNaN(logId)) {
      return NextResponse.json({ error: "Invalid log ID" }, { status: 400 });
    }

    // Obtener el log con todas las relaciones
    const gameLog = await prisma.gameLog.findUnique({
      where: {
        id: logId,
        userId: user.id, // Asegurar que el log pertenece al usuario
      },
      include: {
        deck: {
          include: {
            deckCards: {
              include: {
                card: {
                  include: {
                    colors: true,
                    types: true,
                    effects: true,
                  },
                },
              },
              orderBy: {
                card: {
                  category: "asc",
                },
              },
            },
          },
        },
        opponentLeader: {
          include: {
            colors: true,
            types: true,
          },
        },
        finalHandCards: {
          include: {
            card: {
              include: {
                colors: true,
                types: true,
                effects: true,
              },
            },
          },
          orderBy: {
            card: { cost: "asc" },
          },
        },
      },
    });

    if (!gameLog) {
      return NextResponse.json(
        { error: "Game log not found" },
        { status: 404 }
      );
    }

    // Obtener las cartas de la mano final
    const finalHand = gameLog.finalHandCards.map((card) => card.card);

    // Obtener el líder del deck
    const deckLeader = gameLog.deck.deckCards.find(
      (deckCard) => deckCard.card.category === "Leader"
    )?.card;

    return NextResponse.json({
      ...gameLog,
      deckLeader,
      finalHand,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE - Eliminar un log específico
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const logId = parseInt(params.id);

    if (isNaN(logId)) {
      return NextResponse.json({ error: "Invalid log ID" }, { status: 400 });
    }

    // Verificar que el log pertenece al usuario antes de eliminar
    const gameLog = await prisma.gameLog.findUnique({
      where: {
        id: logId,
        userId: user.id,
      },
    });

    if (!gameLog) {
      return NextResponse.json(
        { error: "Game log not found" },
        { status: 404 }
      );
    }

    // Eliminar el log (las cartas asociadas se eliminan automáticamente por CASCADE)
    await prisma.gameLog.delete({
      where: { id: logId },
    });

    return NextResponse.json({ message: "Game log deleted successfully" });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PUT - Actualizar un log específico
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const logId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(logId)) {
      return NextResponse.json({ error: "Invalid log ID" }, { status: 400 });
    }

    const {
      opponentLeaderId,
      isWin,
      wentFirst,
      opponentName,
      comments,
      playedAt,
      finalHand,
    } = body;

    // Verificar que el log pertenece al usuario
    const existingLog = await prisma.gameLog.findUnique({
      where: {
        id: logId,
        userId: user.id,
      },
    });

    if (!existingLog) {
      return NextResponse.json(
        { error: "Game log not found" },
        { status: 404 }
      );
    }

    // Actualizar con transacción
    const updatedLog = await prisma.$transaction(async (tx) => {
      // Actualizar el log principal
      const log = await tx.gameLog.update({
        where: { id: logId },
        data: {
          opponentLeaderId: opponentLeaderId
            ? parseInt(opponentLeaderId)
            : undefined,
          isWin: typeof isWin === "boolean" ? isWin : undefined,
          wentFirst: typeof wentFirst === "boolean" ? wentFirst : undefined,
          opponentName: opponentName !== undefined ? opponentName : undefined,
          comments: comments !== undefined ? comments : undefined,
          playedAt: playedAt ? new Date(playedAt) : undefined,
        },
      });

      // Si se proporcionan nuevas cartas de mano final, actualizar
      if (finalHand !== undefined) {
        // Eliminar cartas existentes
        await tx.gameLogCard.deleteMany({
          where: { gameLogId: logId },
        });

        // Agregar nuevas cartas de mano final (solo si hay cartas)
        if (finalHand && finalHand.length > 0) {
          await tx.gameLogCard.createMany({
            data: finalHand.map((cardId: number) => ({
              gameLogId: logId,
              cardId: parseInt(cardId.toString()),
            })),
          });
        }
      }

      return log;
    });

    // Obtener el log completo actualizado
    const completeLog = await prisma.gameLog.findUnique({
      where: { id: logId },
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
            card: {
              include: {
                colors: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(completeLog);
  } catch (error) {
    return handleAuthError(error);
  }
}
