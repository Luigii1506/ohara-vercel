export const dynamic = 'force-dynamic';

// Modified 2025-01-31 - Refactored to use centralized auth system
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { calculateGameLogStats } from "@/lib/gameLogStats";

// GET - Obtener estadísticas completas del usuario usando la nueva librería optimizada
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    console.log("Calculating stats for userId:", user.id);

    try {
      // Usar la nueva librería optimizada para calcular todas las estadísticas
      const {
        generalStats,
        leaderStats,
        opponentLeaderStats,
        cardPerformance,
      } = await calculateGameLogStats(user.id);

      console.log("Stats calculated successfully:", {
        generalStats: generalStats ? "Present" : "Missing",
        leaderStats: leaderStats ? `${leaderStats.length} items` : "Missing",
        opponentLeaderStats: opponentLeaderStats
          ? `${opponentLeaderStats.length} items`
          : "Missing",
        cardPerformance: cardPerformance
          ? `${cardPerformance.length} items`
          : "Missing",
      });

      return NextResponse.json({
        stats: generalStats,
        leaderStats,
        opponentLeaderStats,
        cardPerformance,
      });
    } catch (statsError) {
      console.error("Error in calculateGameLogStats:", statsError);
      return NextResponse.json(
        {
          error: "Error calculating game statistics",
          details: String(statsError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
