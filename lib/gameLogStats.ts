// Game log statistics calculator - optimized for GameLog structure
import { PrismaClient } from "@prisma/client";
import { GameLogStats, LeaderStats, OpponentLeaderStats } from "@/types";

const prisma = new PrismaClient();

export interface GameLogStatsResult {
  generalStats: GameLogStats;
  leaderStats: LeaderStats[];
  opponentLeaderStats: OpponentLeaderStats[];
  cardPerformance: CardPerformanceStats[];
}

export interface CardPerformanceStats {
  cardId: number;
  cardName: string;
  cardSrc: string;
  cardCategory: string;
  winsWithCard: number;
  lossesWithCard: number;
  totalGamesWithCard: number;
  winRateWithCard: number;
}

/**
 * Calcula todas las estadísticas de un usuario de forma optimizada
 */
export async function calculateGameLogStats(
  userId: number
): Promise<GameLogStatsResult> {
  try {
    // Ejecutar todas las consultas principales en paralelo
    const [
      generalStatsData,
      leaderStatsData,
      opponentStatsData,
      cardStatsData,
    ] = await Promise.all([
      calculateGeneralStats(userId),
      calculateLeaderStats(userId),
      calculateOpponentStats(userId),
      calculateCardPerformance(userId),
    ]);

    return {
      generalStats: generalStatsData,
      leaderStats: leaderStatsData,
      opponentLeaderStats: opponentStatsData,
      cardPerformance: cardStatsData,
    };
  } catch (error) {
    console.error("Error calculating game log stats:", error);
    throw error;
  }
}

/**
 * Calcula estadísticas generales usando consultas agregadas
 */
async function calculateGeneralStats(userId: number): Promise<GameLogStats> {
  // Usar múltiples consultas count para obtener estadísticas
  const [totalGames, wins, firstPlayerGames, firstPlayerWins] =
    await Promise.all([
      prisma.gameLog.count({ where: { userId } }),
      prisma.gameLog.count({ where: { userId, isWin: true } }),
      prisma.gameLog.count({ where: { userId, wentFirst: true } }),
      prisma.gameLog.count({ where: { userId, wentFirst: true, isWin: true } }),
    ]);

  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  const firstPlayerWinRate =
    firstPlayerGames > 0 ? (firstPlayerWins / firstPlayerGames) * 100 : 0;

  const secondPlayerGames = totalGames - firstPlayerGames;
  const secondPlayerWins = wins - firstPlayerWins;
  const secondPlayerWinRate =
    secondPlayerGames > 0 ? (secondPlayerWins / secondPlayerGames) * 100 : 0;

  return {
    totalGames,
    wins,
    losses,
    winRate: Math.round(winRate * 100) / 100,
    firstPlayerGames,
    firstPlayerWins,
    firstPlayerWinRate: Math.round(firstPlayerWinRate * 100) / 100,
    secondPlayerGames,
    secondPlayerWins,
    secondPlayerWinRate: Math.round(secondPlayerWinRate * 100) / 100,
  };
}

/**
 * Calcula estadísticas de líderes usando GROUP BY para optimizar
 */
async function calculateLeaderStats(userId: number): Promise<LeaderStats[]> {
  // Usar consulta SQL cruda para mejor rendimiento con GROUP BY
  const leaderStatsRaw = await prisma.$queryRaw<
    Array<{
      deckId: number;
      totalGames: bigint;
      wins: bigint;
    }>
  >`
    SELECT 
      \`deckId\`,
      COUNT(*) as totalGames,
      SUM(CASE WHEN \`isWin\` = true THEN 1 ELSE 0 END) as wins
    FROM \`GameLog\` 
    WHERE \`userId\` = ${userId}
    GROUP BY \`deckId\`
    ORDER BY COUNT(*) DESC
  `;

  // Obtener información de los decks en batch
  const deckIds = leaderStatsRaw.map((stat) => stat.deckId);
  const decks = await prisma.deck.findMany({
    where: { id: { in: deckIds } },
    include: {
      deckCards: {
        include: {
          card: {
            include: {
              colors: true,
            },
          },
        },
        where: {
          card: {
            category: "Leader",
          },
        },
        take: 1,
      },
    },
  });

  // Mapear datos con información de líderes
  return leaderStatsRaw
    .map((stat) => {
      const deck = decks.find((d) => d.id === stat.deckId);
      const leader = deck?.deckCards[0]?.card;
      const totalGames = Number(stat.totalGames);
      const wins = Number(stat.wins);
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      return {
        deckId: stat.deckId,
        deckName: deck?.name || "Unknown Deck",
        leaderId: leader?.id || 0,
        leaderName: leader?.name || "Unknown Leader",
        leaderSrc: leader?.src || "",
        totalGames,
        wins,
        winRate: Math.round(winRate * 100) / 100,
      };
    })
    .sort((a, b) => b.winRate - a.winRate);
}

/**
 * Calcula estadísticas contra líderes oponentes
 */
async function calculateOpponentStats(
  userId: number
): Promise<OpponentLeaderStats[]> {
  // Usar consulta SQL cruda para GROUP BY
  const opponentStatsRaw = await prisma.$queryRaw<
    Array<{
      opponentLeaderId: number;
      totalGames: bigint;
      wins: bigint;
    }>
  >`
    SELECT 
      \`opponentLeaderId\`,
      COUNT(*) as totalGames,
      SUM(CASE WHEN \`isWin\` = true THEN 1 ELSE 0 END) as wins
    FROM \`GameLog\` 
    WHERE \`userId\` = ${userId}
    GROUP BY \`opponentLeaderId\`
    ORDER BY COUNT(*) DESC
  `;

  // Obtener información de los líderes oponentes en batch
  const leaderIds = opponentStatsRaw.map((stat) => stat.opponentLeaderId);
  const leaders = await prisma.card.findMany({
    where: { id: { in: leaderIds } },
    include: {
      colors: true,
    },
  });

  // Mapear datos con información de líderes
  return opponentStatsRaw
    .map((stat) => {
      const leader = leaders.find((l) => l.id === stat.opponentLeaderId);
      const totalGames = Number(stat.totalGames);
      const wins = Number(stat.wins);
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      return {
        opponentLeaderId: stat.opponentLeaderId,
        opponentLeaderName: leader?.name || "Unknown Leader",
        opponentLeaderSrc: leader?.src || "",
        totalGames,
        wins,
        winRate: Math.round(winRate * 100) / 100,
      };
    })
    .sort((a, b) => b.totalGames - a.totalGames);
}

/**
 * Calcula rendimiento de cartas en mano final
 */
async function calculateCardPerformance(
  userId: number
): Promise<CardPerformanceStats[]> {
  // Consulta optimizada para obtener estadísticas de cartas
  const cardStatsRaw = await prisma.$queryRaw<
    Array<{
      cardId: number;
      totalGames: bigint;
      wins: bigint;
    }>
  >`
    SELECT 
      glc.\`cardId\`,
      COUNT(*) as totalGames,
      SUM(CASE WHEN gl.\`isWin\` = true THEN 1 ELSE 0 END) as wins
    FROM \`GameLogCard\` glc
    INNER JOIN \`GameLog\` gl ON glc.\`gameLogId\` = gl.id
    WHERE gl.\`userId\` = ${userId}
    GROUP BY glc.\`cardId\`
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `;

  // Obtener información de las cartas en batch
  const cardIds = cardStatsRaw.map((stat) => stat.cardId);
  const cards = await prisma.card.findMany({
    where: { id: { in: cardIds } },
  });

  // Mapear datos con información de cartas
  return cardStatsRaw
    .map((stat) => {
      const card = cards.find((c) => c.id === stat.cardId);
      const totalGames = Number(stat.totalGames);
      const wins = Number(stat.wins);
      const losses = totalGames - wins;
      const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      return {
        cardId: stat.cardId,
        cardName: card?.name || "Unknown Card",
        cardSrc: card?.src || "",
        cardCategory: card?.category || "Unknown",
        winsWithCard: wins,
        lossesWithCard: losses,
        totalGamesWithCard: totalGames,
        winRateWithCard: Math.round(winRate * 100) / 100,
      };
    })
    .sort((a, b) => b.totalGamesWithCard - a.totalGamesWithCard);
}

/**
 * Función de utilidad para obtener estadísticas rápidas (solo generales)
 */
export async function getQuickStats(userId: number): Promise<GameLogStats> {
  return await calculateGeneralStats(userId);
}

/**
 * Función de utilidad para obtener solo estadísticas de líderes
 */
export async function getLeaderStatsOnly(
  userId: number
): Promise<LeaderStats[]> {
  return await calculateLeaderStats(userId);
}
