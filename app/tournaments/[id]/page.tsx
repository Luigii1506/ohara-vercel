import { Metadata } from "next";
import { notFound } from "next/navigation";
import TournamentDetailClient from "./TournamentDetailClient";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tournamentId = parseInt(params.id, 10);

  if (isNaN(tournamentId)) {
    return {
      title: "Torneo no encontrado",
    };
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      eventDate: true,
      region: true,
      playerCount: true,
    },
  });

  if (!tournament) {
    return {
      title: "Torneo no encontrado",
    };
  }

  return {
    title: `${tournament.name} - Torneo One Piece TCG`,
    description: `Resultados completos del torneo ${tournament.name}. ${tournament.playerCount || 0} jugadores, ${tournament.region || "Internacional"}. Explora todos los decks y estadísticas.`,
    openGraph: {
      title: `${tournament.name} - Torneo One Piece TCG`,
      description: `Resultados completos del torneo ${tournament.name}. ${tournament.playerCount || 0} jugadores.`,
    },
  };
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const tournamentId = parseInt(params.id, 10);

  if (isNaN(tournamentId)) {
    notFound();
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
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

  if (!tournament) {
    notFound();
  }

  // Calculate prices and convert date to string
  const tournamentsWithPrices = {
    ...tournament,
    eventDate: tournament.eventDate.toISOString(),
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
  };

  return <TournamentDetailClient tournament={tournamentsWithPrices} />;
}
