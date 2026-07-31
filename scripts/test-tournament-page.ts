import { prisma } from "../lib/prisma";

async function main() {
  const tournamentId = 1;

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
    console.log("Tournament not found");
    return;
  }

  console.log(`Tournament: ${tournament.name}`);
  console.log(`Decks fetched: ${tournament.decks.length}`);
  console.log("\nDeck list:");
  tournament.decks.forEach((deck, i) => {
    console.log(
      `${i + 1}. ${deck.playerName} (Standing: ${deck.standing || "N/A"})`
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
