export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const user = await requireAuth();

    const leaderCode = params.code;

    // Obtener todos los logs del usuario con líderes que tengan el código especificado
    const logs = await prisma.gameLog.findMany({
      where: {
        userId: user.id,
        deck: {
          deckCards: {
            some: {
              card: {
                category: "Leader",
                code: leaderCode,
              },
            },
          },
        },
      },
      include: {
        deck: {
          include: {
            deckCards: {
              include: {
                card: true,
              },
            },
          },
        },
        opponentLeader: true,
        finalHandCards: {
          include: {
            card: true,
          },
        },
      },
      orderBy: {
        playedAt: "desc",
      },
    });

    if (logs.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron datos para este líder" },
        { status: 404 }
      );
    }

    // Obtener información del líder
    const leaderCard = logs[0].deck?.deckCards?.find(
      (dc: any) =>
        dc.card?.category === "Leader" && dc.card?.code === leaderCode
    )?.card;

    if (!leaderCard) {
      return NextResponse.json(
        { error: "Líder no encontrado" },
        { status: 404 }
      );
    }

    // Calcular estadísticas generales
    const totalGames = logs.length;
    const wins = logs.filter((log: any) => log.isWin).length;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

    // Agrupar por deck
    const deckStats = logs.reduce((acc: any, log: any) => {
      const deckId = log.deckId;
      const deckName = log.deck?.name || "Deck Desconocido";

      if (!acc[deckId]) {
        acc[deckId] = {
          deckId,
          deckName,
          totalGames: 0,
          wins: 0,
          deckCards: log.deck?.deckCards || [],
        };
      }

      acc[deckId].totalGames++;
      if (log.isWin) acc[deckId].wins++;

      return acc;
    }, {});

    const decks = Object.values(deckStats).map((deck: any) => ({
      ...deck,
      winRate: deck.totalGames > 0 ? (deck.wins / deck.totalGames) * 100 : 0,
    }));

    // Estadísticas de matchups contra oponentes con análisis de primer/segundo jugador
    const opponentMatchups = logs.reduce((acc: any, log: any) => {
      const opponentId = log.opponentLeader?.id;
      const opponentName = log.opponentLeader?.name || "Desconocido";
      const opponentSrc = log.opponentLeader?.src || "";

      if (opponentId) {
        if (!acc[opponentId]) {
          acc[opponentId] = {
            opponentName,
            opponentSrc,
            wins: 0,
            total: 0,
            firstPlayerWins: 0,
            firstPlayerTotal: 0,
            secondPlayerWins: 0,
            secondPlayerTotal: 0,
          };
        }

        acc[opponentId].total++;
        if (log.isWin) acc[opponentId].wins++;

        // Estadísticas por orden de turno
        if (log.wentFirst) {
          acc[opponentId].firstPlayerTotal++;
          if (log.isWin) acc[opponentId].firstPlayerWins++;
        } else {
          acc[opponentId].secondPlayerTotal++;
          if (log.isWin) acc[opponentId].secondPlayerWins++;
        }
      }

      return acc;
    }, {});

    const opponentMatchupsArray = Object.values(opponentMatchups)
      .map((matchup: any) => ({
        ...matchup,
        winRate: matchup.total > 0 ? (matchup.wins / matchup.total) * 100 : 0,
      }))
      .filter((matchup: any) => matchup.total >= 1) // Mostrar matchups con al menos 1 partida
      .sort((a: any, b: any) => b.total - a.total);

    // Rendimiento de cartas en mano inicial
    const cardPerformance = logs.reduce((acc: any, log: any) => {
      if (log.finalHandCards && log.finalHandCards.length > 0) {
        log.finalHandCards.forEach((handCard: any) => {
          const cardId = handCard.card.id;
          const cardName = handCard.card.name;
          const cardSrc = handCard.card.src;

          if (!acc[cardId]) {
            acc[cardId] = {
              cardId,
              cardName,
              cardSrc,
              winsWithCard: 0,
              totalGamesWithCard: 0,
            };
          }

          acc[cardId].totalGamesWithCard++;
          if (log.isWin) acc[cardId].winsWithCard++;
        });
      }

      return acc;
    }, {});

    const cardPerformanceArray = Object.values(cardPerformance)
      .map((card: any) => ({
        ...card,
        winRateWithCard:
          card.totalGamesWithCard > 0
            ? (card.winsWithCard / card.totalGamesWithCard) * 100
            : 0,
      }))
      .filter((card: any) => card.totalGamesWithCard >= 3) // Solo cartas con al menos 3 apariciones
      .sort((a: any, b: any) => b.winRateWithCard - a.winRateWithCard);

    // Estadísticas de primer/segundo jugador
    const firstPlayerGames = logs.filter((log: any) => log.wentFirst);
    const secondPlayerGames = logs.filter((log: any) => !log.wentFirst);

    const firstPlayerStats = {
      wins: firstPlayerGames.filter((log: any) => log.isWin).length,
      total: firstPlayerGames.length,
      winRate:
        firstPlayerGames.length > 0
          ? (firstPlayerGames.filter((log: any) => log.isWin).length /
              firstPlayerGames.length) *
            100
          : 0,
    };

    const secondPlayerStats = {
      wins: secondPlayerGames.filter((log: any) => log.isWin).length,
      total: secondPlayerGames.length,
      winRate:
        secondPlayerGames.length > 0
          ? (secondPlayerGames.filter((log: any) => log.isWin).length /
              secondPlayerGames.length) *
            100
          : 0,
    };

    // Batallas recientes (últimas 10)
    const recentBattles = logs.slice(0, 10);

    const leaderStats = {
      leaderName: leaderCard.name,
      leaderSrc: leaderCard.src,
      leaderCode: leaderCard.code,
      totalGames,
      wins,
      winRate,
      decks,
      opponentMatchups: opponentMatchupsArray,
      cardPerformance: cardPerformanceArray,
      recentBattles,
      firstPlayerStats,
      secondPlayerStats,
    };

    return NextResponse.json(leaderStats);
  } catch (error) {
    return handleAuthError(error);
  }
}
