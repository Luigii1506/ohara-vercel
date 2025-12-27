import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 15;
    const safeLimit = Number.isNaN(limit)
      ? 15
      : Math.min(Math.max(limit, 1), 50);
    const cursor = searchParams.get("cursor");

    // Filters
    const type = searchParams.get("type"); // REGIONAL, CHAMPIONSHIP, TREASURE_CUP
    const minSize = searchParams.get("minSize"); // 32, 64
    const days = searchParams.get("days"); // 30 (últimos 30 días)
    const hasWinner = searchParams.get("hasWinner"); // true/false
    const search = searchParams.get("search"); // búsqueda de texto

    // Build where clause
    const where: Prisma.TournamentWhereInput = {
      status: "COMPLETED",
    };

    // Type filter
    if (type && type !== "all") {
      where.type = type as "REGIONAL" | "CHAMPIONSHIP" | "TREASURE_CUP";
    }

    // Min player count filter
    if (minSize) {
      const minPlayers = parseInt(minSize, 10);
      if (!isNaN(minPlayers)) {
        where.playerCount = { gte: minPlayers };
      }
    }

    // Recency filter (last N days)
    if (days) {
      const daysNum = parseInt(days, 10);
      if (!isNaN(daysNum)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);
        where.eventDate = { gte: cutoffDate };
      }
    }

    // Winner filter
    if (hasWinner === "true") {
      where.OR = [
        { winnerName: { not: null } },
        { decks: { some: { standing: 1 } } },
      ];
    }

    // Search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { region: { contains: searchTerm, mode: "insensitive" } },
            { country: { contains: searchTerm, mode: "insensitive" } },
            { format: { contains: searchTerm, mode: "insensitive" } },
            { winnerName: { contains: searchTerm, mode: "insensitive" } },
            {
              decks: {
                some: {
                  OR: [
                    { playerName: { contains: searchTerm, mode: "insensitive" } },
                    { archetypeName: { contains: searchTerm, mode: "insensitive" } },
                    {
                      leaderCard: {
                        name: { contains: searchTerm, mode: "insensitive" },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: { eventDate: "desc" },
      take: safeLimit + 1, // Fetch one extra to check if there's more
      ...(cursor && { cursor: { id: parseInt(cursor, 10) }, skip: 1 }),
      include: {
        source: {
          select: {
            name: true,
            slug: true,
          },
        },
        decks: {
          orderBy: {
            standing: "asc",
          },
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                uniqueUrl: true,
                deckCards: {
                  include: {
                    card: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                        src: true,
                        imageKey: true,
                        marketPrice: true,
                        category: true,
                        rarity: true,
                        colors: {
                          select: {
                            color: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            leaderCard: {
              select: {
                id: true,
                name: true,
                code: true,
                src: true,
                imageKey: true,
                colors: {
                  select: {
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Check if there are more results
    const hasMore = tournaments.length > safeLimit;
    const resultsToReturn = hasMore ? tournaments.slice(0, -1) : tournaments;
    const nextCursor = hasMore
      ? resultsToReturn[resultsToReturn.length - 1]?.id
      : null;

    // Calcular precio total de cada deck
    const tournamentsWithPrices = resultsToReturn.map((tournament) => ({
      ...tournament,
      decks: tournament.decks.map((tournamentDeck) => {
        let totalPrice = 0;
        if (tournamentDeck.deck?.deckCards) {
          totalPrice = tournamentDeck.deck.deckCards.reduce((sum, deckCard) => {
            const price = deckCard.card.marketPrice
              ? parseFloat(deckCard.card.marketPrice.toString())
              : 0;
            return sum + price * deckCard.quantity;
          }, 0);
        }

        return {
          ...tournamentDeck,
          totalPrice: totalPrice.toFixed(2),
        };
      }),
    }));

    return NextResponse.json(
      {
        tournaments: tournamentsWithPrices,
        nextCursor,
        hasMore,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournaments" },
      { status: 500 }
    );
  }
}
